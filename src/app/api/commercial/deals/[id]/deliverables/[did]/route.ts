import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { sanitizeString } from "@/lib/validate";

const STATUSES = ["PENDING", "IN_PROGRESS", "DELIVERED"];

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

    const delivered = body.status === "DELIVERED";
    const deliverable = await prisma.deliverable.update({
      where: { id: did },
      data: {
        ...(body.type !== undefined ? { type: sanitizeString(body.type, 300) } : {}),
        ...(body.description !== undefined
          ? { description: body.description ? sanitizeString(body.description, 2000) : null }
          : {}),
        ...(body.dueDate !== undefined ? { dueDate: body.dueDate ? new Date(body.dueDate) : null } : {}),
        ...(body.status !== undefined
          ? { status: body.status, completed: delivered, completedAt: delivered ? new Date() : null }
          : {}),
      },
    });

    if (body.status !== undefined && body.status !== existing.status) {
      await prisma.dealActivity.create({
        data: {
          campaignId: id,
          type: "deliverable",
          message: `Deliverable "${deliverable.type}" on "${existing.campaign.title}" marked ${body.status.replace("_", " ").toLowerCase()}`,
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
