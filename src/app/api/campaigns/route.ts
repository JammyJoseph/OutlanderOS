import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { validateRequired, sanitizeString } from "@/lib/validate";
import {
  isDealStage,
  isDealType,
  isWorkflowType,
  isJobType,
  dealTypeToCampaignType,
  dealTypesForJob,
  workflowForJobType,
} from "@/lib/deal-stages";

export const GET = withAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const stage = searchParams.get("stage");
    const type = searchParams.get("type");
    // Multi-select type filter: ?types=EVENT,EDITORIAL matches deals that
    // have ANY of the given types (in dealTypes or the legacy type field).
    const types = (searchParams.get("types") ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    // The legacy type column is a Postgres enum — only valid enum values can
    // be used in the fallback comparison for deals without dealTypes.
    const LEGACY_TYPES = [
      "SUPPLIED_ASSET", "BESPOKE_PRODUCTION", "WHITE_LABEL", "EDITORIAL_FEATURE",
      "PRINT_AD", "PARTNERSHIP", "ADVERTORIAL", "EVENT", "EDITORIAL",
    ];
    const legacyTypes = types.filter((t) => LEGACY_TYPES.includes(t));
    const search = searchParams.get("search");
    const clientId = searchParams.get("clientId");
    const assignedToId = searchParams.get("assignedToId");
    // Archived deals are hidden by default; ?includeArchived=true returns
    // them alongside active deals (the UI greys them out).
    const includeArchived = searchParams.get("includeArchived") === "true";

    const campaigns = await prisma.campaign.findMany({
      where: {
        ...(includeArchived ? {} : { archived: false }),
        status: status ? (status as never) : { not: "ARCHIVED" as never },
        ...(stage && isDealStage(stage) ? { stage } : {}),
        ...(type ? { type: type as never } : {}),
        ...(types.length
          ? {
              AND: [
                {
                  OR: [
                    { dealTypes: { hasSome: types } },
                    ...(legacyTypes.length
                      ? [{ dealTypes: { isEmpty: true }, type: { in: legacyTypes as never[] } }]
                      : []),
                  ],
                },
              ],
            }
          : {}),
        ...(clientId ? { clientId } : {}),
        ...(assignedToId ? { assignedToId } : {}),
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: "insensitive" as const } },
                { client: { name: { contains: search, mode: "insensitive" as const } } },
              ],
            }
          : {}),
      },
      include: {
        client: { select: { id: true, name: true, industry: true, brandColor: true } },
        assignedTo: { select: { id: true, name: true, avatarUrl: true, avatar: true } },
        production: { select: { id: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(campaigns);
  } catch (err) {
    console.error("GET /api/campaigns", err);
    return NextResponse.json({ error: "Failed to fetch campaigns" }, { status: 500 });
  }
});

export const POST = withAuth(async (request: NextRequest, _ctx, user) => {
  try {
    const body = await request.json();

    const missing = validateRequired(body, ["title"]);
    if (missing) return NextResponse.json({ error: missing }, { status: 400 });

    if (!body.clientId && !body.clientName) {
      return NextResponse.json({ error: "clientId or clientName is required" }, { status: 400 });
    }

    // Job type is the user-facing classifier set in the New Deal flow; it
    // drives the auto-tags (dealTypes) and the underlying workflowType. Falls
    // back to explicit dealTypes/workflowType for older clients.
    const jobType =
      typeof body.jobType === "string" && isJobType(body.jobType) ? body.jobType : null;

    let dealTypes: string[];
    if (jobType) {
      const extensions: string[] = Array.isArray(body.extensions)
        ? body.extensions.filter((e: unknown): e is string => typeof e === "string")
        : [];
      dealTypes = dealTypesForJob(jobType, extensions);
    } else {
      dealTypes = Array.isArray(body.dealTypes)
        ? body.dealTypes.filter((t: unknown): t is string => typeof t === "string" && isDealType(t))
        : [];
    }
    if (!dealTypes.length && !body.type) {
      return NextResponse.json({ error: "Missing required field: type" }, { status: 400 });
    }

    const title = sanitizeString(body.title, 300);
    const { value, currency } = body;
    const type = dealTypes.length ? dealTypeToCampaignType(dealTypes[0]) : body.type;

    // Workflow type determines the process — creative loop or straight through.
    const workflowType = jobType
      ? workflowForJobType(jobType)
      : typeof body.workflowType === "string" && isWorkflowType(body.workflowType)
        ? body.workflowType
        : "CREATIVE_BRIEF";

    let clientId: string | null = body.clientId || null;
    if (!clientId) {
      const clientName = sanitizeString(body.clientName, 200);
      let client = await prisma.client.findFirst({
        where: { name: { equals: clientName, mode: "insensitive" } },
      });
      if (!client) {
        client = await prisma.client.create({ data: { name: clientName } });
      }
      clientId = client.id;
    }

    const campaign = await prisma.campaign.create({
      data: {
        clientId,
        title,
        type,
        dealTypes,
        workflowType,
        jobType: jobType ?? workflowType,
        // Creative-brief jobs start the creative loop awaiting Outlander's response.
        creativeStatus: workflowType === "CREATIVE_BRIEF" ? "AWAITING_RESPONSE" : null,
        stage: body.stage && isDealStage(body.stage) ? body.stage : "LEAD",
        stageUpdatedAt: new Date(),
        value: value !== undefined && value !== null && value !== "" ? parseFloat(value) : null,
        currency: currency ?? "GBP",
        description: body.description ? sanitizeString(body.description, 4000) : null,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        assignedToId: body.assignedToId || null,
        createdById: user.userId,
      },
      include: {
        client: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    });

    await prisma.dealActivity.create({
      data: {
        campaignId: campaign.id,
        type: "created",
        message: `Deal "${campaign.title}" created for ${campaign.client.name}`,
        userId: user.userId,
        userName: user.name,
      },
    });

    return NextResponse.json(campaign, { status: 201 });
  } catch (err) {
    console.error("POST /api/campaigns", err);
    return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 });
  }
});
