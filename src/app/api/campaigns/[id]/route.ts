import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, type AuthUser } from "@/lib/auth";
import { sanitizeString } from "@/lib/validate";
import { isDealStage } from "@/lib/deal-stages";

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
        production: { select: { id: true, status: true, title: true, budgetTotal: true } },
        activities: { orderBy: { createdAt: "desc" }, take: 50 },
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(campaign);
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
    const { status, stage, title, value, currency, type, notes, ioSigned, description, dueDate, assignedToId } = body;

    const existing = await prisma.campaign.findUnique({
      where: { id },
      select: { id: true, stage: true, value: true, title: true },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (stage !== undefined && !isDealStage(stage)) {
      return NextResponse.json({ error: `Invalid stage: ${stage}` }, { status: 400 });
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
