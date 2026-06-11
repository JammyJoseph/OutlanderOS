import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, type AuthUser } from "@/lib/auth";
import { sanitizeString } from "@/lib/validate";
import {
  isDealStage,
  isDealType,
  isBriefStatus,
  isWorkflowType,
  isCreativeStatus,
  dealTypeToCampaignType,
  parseClientBrief,
  parseCreativeResponse,
  parseClientFeedback,
  stagesForWorkflow,
} from "@/lib/deal-stages";

export const GET = withAuth(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        client: true,
        deliverables: true,
        assets: true,
        assignedTo: { select: { id: true, name: true, avatarUrl: true, avatar: true } },
        billingContact: true,
        production: {
          select: {
            id: true,
            status: true,
            title: true,
            budgetTotal: true,
            shootDates: true,
            _count: { select: { teamMembers: true } },
          },
        },
        activities: { orderBy: { createdAt: "desc" }, take: 50 },
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Linked Finance project (CampaignBudget has no back-relation on Campaign).
    const financeBudget = await prisma.campaignBudget.findFirst({
      where: { campaignId: id },
      select: { id: true, status: true, totalBudget: true },
    });

    return NextResponse.json({ ...campaign, financeBudget });
  } catch (err) {
    console.error("GET /api/campaigns/[id]", err);
    return NextResponse.json({ error: "Failed to fetch campaign" }, { status: 500 });
  }
});

async function updateCampaign(
  request: NextRequest,
  { params }: { params?: Promise<Record<string, string>> },
  user: AuthUser
) {
  try {
    const { id } = (await params) ?? {};
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const body = await request.json();
    const {
      status, stage, title, value, currency, type, notes, ioSigned, description,
      dueDate, assignedToId, clientId, dealTypes, briefContent, briefDueDate, briefStatus,
      workflowType, clientBrief, creativeResponse, clientFeedback, creativeStatus,
    } = body;

    const existing = await prisma.campaign.findUnique({
      where: { id },
      select: {
        id: true, stage: true, value: true, title: true, briefStatus: true,
        workflowType: true, creativeStatus: true, clientFeedback: true,
      },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (stage !== undefined && !isDealStage(stage)) {
      return NextResponse.json({ error: `Invalid stage: ${stage}` }, { status: 400 });
    }

    if (workflowType !== undefined && !isWorkflowType(workflowType)) {
      return NextResponse.json({ error: `Invalid workflowType: ${workflowType}` }, { status: 400 });
    }

    if (creativeStatus !== undefined && creativeStatus !== null && !isCreativeStatus(creativeStatus)) {
      return NextResponse.json({ error: `Invalid creativeStatus: ${creativeStatus}` }, { status: 400 });
    }

    // Supplied-assets deals skip the creative + cleared-for-production stages.
    const effectiveWorkflow = workflowType ?? existing.workflowType;
    if (
      stage !== undefined &&
      effectiveWorkflow === "SUPPLIED_ASSETS" &&
      !(stagesForWorkflow("SUPPLIED_ASSETS") as string[]).includes(stage) &&
      stage !== "NEGOTIATING"
    ) {
      return NextResponse.json(
        { error: `Supplied-assets deals skip the ${stage} stage` },
        { status: 400 }
      );
    }

    // Normalise creative-workflow JSON payloads before persisting.
    const nextClientBrief = clientBrief !== undefined
      ? clientBrief === null ? null : parseClientBrief(clientBrief)
      : undefined;
    const nextCreativeResponse = creativeResponse !== undefined
      ? creativeResponse === null ? null : parseCreativeResponse(creativeResponse)
      : undefined;
    const nextClientFeedback = clientFeedback !== undefined
      ? clientFeedback === null ? [] : parseClientFeedback(clientFeedback)
      : undefined;

    let nextDealTypes: string[] | undefined;
    if (dealTypes !== undefined) {
      if (!Array.isArray(dealTypes)) {
        return NextResponse.json({ error: "dealTypes must be an array" }, { status: 400 });
      }
      nextDealTypes = dealTypes.filter(
        (t: unknown): t is string => typeof t === "string" && isDealType(t)
      );
      if (!nextDealTypes.length) {
        return NextResponse.json({ error: "A deal needs at least one type" }, { status: 400 });
      }
    }

    if (briefStatus !== undefined && !isBriefStatus(briefStatus)) {
      return NextResponse.json({ error: `Invalid briefStatus: ${briefStatus}` }, { status: 400 });
    }

    if (clientId !== undefined) {
      const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
      if (!client) return NextResponse.json({ error: "Client not found" }, { status: 400 });
    }

    const stageChanged = stage !== undefined && stage !== existing.stage;

    const campaign = await prisma.campaign.update({
      where: { id },
      data: {
        ...(status !== undefined ? { status } : {}),
        ...(stage !== undefined ? { stage } : {}),
        ...(stageChanged ? { stageUpdatedAt: new Date() } : {}),
        ...(title !== undefined ? { title: sanitizeString(title, 300) } : {}),
        ...(value !== undefined ? { value: value === null || value === "" ? null : parseFloat(value) } : {}),
        ...(currency !== undefined ? { currency } : {}),
        ...(type !== undefined ? { type } : {}),
        // dealTypes drives the legacy type field so old consumers stay coherent
        ...(nextDealTypes !== undefined
          ? { dealTypes: nextDealTypes, type: dealTypeToCampaignType(nextDealTypes[0]) as never }
          : {}),
        ...(clientId !== undefined ? { clientId } : {}),
        ...(briefContent !== undefined
          ? { briefContent: briefContent === null ? null : sanitizeString(briefContent, 20000) }
          : {}),
        ...(workflowType !== undefined ? { workflowType } : {}),
        // The client brief content mirrors into the legacy briefContent so the
        // production handoff and older consumers stay coherent.
        ...(nextClientBrief !== undefined
          ? {
              clientBrief: nextClientBrief ?? undefined,
              ...(nextClientBrief?.content !== undefined
                ? { briefContent: nextClientBrief.content ? sanitizeString(nextClientBrief.content, 20000) : null }
                : {}),
            }
          : {}),
        ...(nextCreativeResponse !== undefined ? { creativeResponse: nextCreativeResponse ?? undefined } : {}),
        ...(nextClientFeedback !== undefined ? { clientFeedback: nextClientFeedback } : {}),
        ...(creativeStatus !== undefined ? { creativeStatus } : {}),
        ...(briefDueDate !== undefined
          ? { briefDueDate: briefDueDate ? new Date(briefDueDate) : null }
          : {}),
        ...(briefStatus !== undefined ? { briefStatus } : {}),
        ...(notes !== undefined ? { notes: notes === null ? null : sanitizeString(notes, 8000) } : {}),
        ...(description !== undefined
          ? { description: description === null ? null : sanitizeString(description, 4000) }
          : {}),
        ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
        ...(assignedToId !== undefined ? { assignedToId: assignedToId || null } : {}),
        ...(ioSigned !== undefined ? { ioSigned, ioSignedAt: ioSigned ? new Date() : null } : {}),
      },
      include: {
        client: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
        production: { select: { id: true, status: true } },
      },
    });

    // Stage sync: deal goes Live → kick the linked production into motion
    // (SHOOTING is the portal's "in progress" status) if it hasn't started.
    if (
      stageChanged &&
      stage === "LIVE" &&
      campaign.production &&
      ["DRAFT", "BRIEFED", "PRE_PRODUCTION"].includes(campaign.production.status)
    ) {
      await prisma.production.update({
        where: { id: campaign.production.id },
        data: { status: "SHOOTING" },
      });
    }

    // Activity log — one entry per meaningful change
    const logs: { type: string; message: string; meta?: object }[] = [];
    if (stageChanged) {
      logs.push({
        type: "stage_change",
        message: `"${existing.title}" moved from ${existing.stage} to ${stage}`,
        meta: { from: existing.stage, to: stage },
      });
    }
    if (value !== undefined) {
      const newValue = value === null || value === "" ? null : parseFloat(value);
      if (newValue !== existing.value) {
        logs.push({
          type: "budget_update",
          message: `"${existing.title}" value updated to £${(newValue ?? 0).toLocaleString()}`,
          meta: { from: existing.value, to: newValue },
        });
      }
    }
    if (notes !== undefined) {
      logs.push({ type: "note", message: `Notes updated on "${existing.title}"` });
    }
    if (creativeStatus !== undefined && creativeStatus !== existing.creativeStatus) {
      const CREATIVE_LABELS: Record<string, string> = {
        AWAITING_RESPONSE: "Awaiting Response",
        RESPONSE_SENT: "Response Sent",
        IN_REVIEW: "In Review",
        REVISIONS_REQUESTED: "Revisions Requested",
        APPROVED: "Approved",
      };
      logs.push({
        type: "field_update",
        message:
          creativeStatus === "APPROVED"
            ? `Creative for "${existing.title}" approved by the client`
            : `Creative status on "${existing.title}" set to ${CREATIVE_LABELS[creativeStatus] ?? creativeStatus}`,
        meta: { from: existing.creativeStatus, to: creativeStatus },
      });
    }
    if (nextClientFeedback !== undefined) {
      const prevCount = Array.isArray(existing.clientFeedback) ? existing.clientFeedback.length : 0;
      if (nextClientFeedback.length > prevCount) {
        const latest = nextClientFeedback[nextClientFeedback.length - 1];
        logs.push({
          type: "note",
          message: `Client feedback (${latest.type}) logged on "${existing.title}"${latest.from ? ` from ${latest.from}` : ""}`,
        });
      }
    }
    if (briefStatus !== undefined && briefStatus !== existing.briefStatus) {
      logs.push({
        type: "field_update",
        message:
          briefStatus === "SENT_TO_PRODUCTION"
            ? `Creative brief for "${existing.title}" sent to production`
            : `Creative brief status on "${existing.title}" set to ${briefStatus}`,
        meta: { from: existing.briefStatus, to: briefStatus },
      });
    }
    if (logs.length) {
      await prisma.dealActivity.createMany({
        data: logs.map((l) => ({
          campaignId: id,
          type: l.type,
          message: l.message,
          meta: l.meta,
          userId: user.userId,
          userName: user.name,
        })),
      });
    }

    return NextResponse.json(campaign);
  } catch (err) {
    console.error("PATCH /api/campaigns/[id]", err);
    return NextResponse.json({ error: "Failed to update campaign" }, { status: 500 });
  }
}

export const PATCH = withAuth(updateCampaign);
export const PUT = withAuth(updateCampaign);

export const DELETE = withAuth(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;
    await prisma.campaign.update({
      where: { id },
      data: { status: "ARCHIVED" },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/campaigns/[id]", err);
    return NextResponse.json({ error: "Failed to delete campaign" }, { status: 500 });
  }
});
