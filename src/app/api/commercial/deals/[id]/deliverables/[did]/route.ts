import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { sanitizeString } from "@/lib/validate";

const STATUSES = ["PENDING", "IN_PROGRESS", "DELIVERED"];
const SCHEDULE_STATUSES = ["PENDING", "SCHEDULED", "LIVE", "LATE"];

// PATCH /api/commercial/deals/[id]/deliverables/[did] — update a deliverable
export const PATCH = withAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string; did: string }> },
  user
) => {
  try {
    const { id, did } = await params;
    const body = await request.json();

    const existing = await prisma.deliverable.findFirst({
      where: { id: did, campaignId: id },
      include: { campaign: { select: { title: true } } },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (body.status !== undefined && !STATUSES.includes(body.status)) {
      return NextResponse.json({ error: `Invalid status: ${body.status}` }, { status: 400 });
    }
    if (body.scheduleStatus !== undefined && !SCHEDULE_STATUSES.includes(body.scheduleStatus)) {
      return NextResponse.json({ error: `Invalid scheduleStatus: ${body.scheduleStatus}` }, { status: 400 });
    }

    const delivered = body.status === "DELIVERED";
    const approvedBy = body.approvedBy !== undefined ? (body.approvedBy ? sanitizeString(body.approvedBy, 200) : null) : undefined;

    const deliverable = await prisma.deliverable.update({
      where: { id: did },
      data: {
        ...(body.title !== undefined ? { title: body.title ? sanitizeString(body.title, 300) : null } : {}),
        ...(body.type !== undefined ? { type: sanitizeString(body.type, 300) } : {}),
        ...(body.quantity !== undefined ? { quantity: Math.max(1, parseInt(String(body.quantity), 10) || 1) } : {}),
        ...(body.description !== undefined
          ? { description: body.description ? sanitizeString(body.description, 2000) : null }
          : {}),
        ...(body.dueDate !== undefined ? { dueDate: body.dueDate ? new Date(body.dueDate) : null } : {}),
        ...(body.status !== undefined
          ? { status: body.status, completed: delivered, completedAt: delivered ? new Date() : null }
          : {}),
        ...(body.scheduleStatus !== undefined ? { scheduleStatus: body.scheduleStatus } : {}),
        ...(body.postedUrl !== undefined ? { postedUrl: body.postedUrl ? sanitizeString(body.postedUrl, 1000) : null } : {}),
        ...(body.overageCost !== undefined
          ? { overageCost: body.overageCost === null || body.overageCost === "" ? null : Number(body.overageCost) }
          : {}),
        ...(approvedBy !== undefined ? { approvedBy, approvedAt: approvedBy ? new Date() : null } : {}),
      },
    });

    if (body.status !== undefined && body.status !== existing.status) {
      await prisma.dealActivity.create({
        data: {
          campaignId: id,
          type: "deliverable",
          message: `Deliverable "${deliverable.title ?? deliverable.type}" on "${existing.campaign.title}" marked ${body.status.replace("_", " ").toLowerCase()}`,
          userId: user.userId,
          userName: user.name,
        },
      });
    }

    return NextResponse.json(deliverable);
  } catch (err) {
    console.error("PATCH /api/commercial/deals/[id]/deliverables/[did]", err);
    return NextResponse.json({ error: "Failed to update deliverable" }, { status: 500 });
  }
});

// DELETE /api/commercial/deals/[id]/deliverables/[did]
export const DELETE = withAuth(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; did: string }> }
) => {
  try {
    const { id, did } = await params;
    const existing = await prisma.deliverable.findFirst({ where: { id: did, campaignId: id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await prisma.deliverable.delete({ where: { id: did } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/commercial/deals/[id]/deliverables/[did]", err);
    return NextResponse.json({ error: "Failed to delete deliverable" }, { status: 500 });
  }
});
