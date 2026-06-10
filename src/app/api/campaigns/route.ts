import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { validateRequired, sanitizeString } from "@/lib/validate";
import { isDealStage } from "@/lib/deal-stages";

export const GET = withAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const stage = searchParams.get("stage");
    const type = searchParams.get("type");
    const search = searchParams.get("search");
    const clientId = searchParams.get("clientId");
    const assignedToId = searchParams.get("assignedToId");

    const campaigns = await prisma.campaign.findMany({
      where: {
        status: status ? (status as never) : { not: "ARCHIVED" as never },
        ...(stage && isDealStage(stage) ? { stage } : {}),
        ...(type ? { type: type as never } : {}),
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

    const missing = validateRequired(body, ["title", "type"]);
    if (missing) return NextResponse.json({ error: missing }, { status: 400 });

    if (!body.clientId && !body.clientName) {
      return NextResponse.json({ error: "clientId or clientName is required" }, { status: 400 });
    }

    const title = sanitizeString(body.title, 300);
    const { type, value, currency } = body;

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
