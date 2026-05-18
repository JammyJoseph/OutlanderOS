import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";

// A member may only touch a deadline assigned to them; admins may touch any.
async function loadOwnedDeadline(id: string, userId: string, isAdmin: boolean) {
  const deadline = await prisma.deadline.findUnique({ where: { id } });
  if (!deadline) return { error: "Not found", status: 404 as const };
  if (!isAdmin && deadline.assignedTo !== userId) {
    return { error: "Forbidden", status: 403 as const };
  }
  return { deadline };
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = getCurrentUser(request);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const owned = await loadOwnedDeadline(id, me.userId, me.role === "ADMIN");
    if ("error" in owned) {
      return NextResponse.json({ error: owned.error }, { status: owned.status });
    }

    const body = await request.json();
    const data: Record<string, unknown> = {};

    if (body.title !== undefined) data.title = body.title;
    if (body.description !== undefined) data.description = body.description;
    if (body.dueDate !== undefined) data.dueDate = new Date(body.dueDate);
    if (body.type !== undefined) data.type = body.type;
    if (body.priority !== undefined) data.priority = body.priority;
    if (body.snoozedUntil !== undefined) {
      data.snoozedUntil = body.snoozedUntil ? new Date(body.snoozedUntil) : null;
    }

    if (body.status !== undefined) {
      data.status = body.status;
      if (body.status === "COMPLETED") {
        data.completedAt = new Date();
      } else if (body.status === "ACTIVE") {
        data.completedAt = null;
        data.snoozedUntil = null;
      } else if (body.status === "SNOOZED" && body.snoozedUntil === undefined) {
        const oneDay = new Date();
        oneDay.setDate(oneDay.getDate() + 1);
        data.snoozedUntil = oneDay;
      }
    }

    const deadline = await prisma.deadline.update({ where: { id }, data });
    return NextResponse.json(deadline);
  } catch (err) {
    console.error("PUT /api/deadlines/[id]", err);
    return NextResponse.json(
      { error: "Failed to update deadline" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = getCurrentUser(request);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const owned = await loadOwnedDeadline(id, me.userId, me.role === "ADMIN");
    if ("error" in owned) {
      return NextResponse.json({ error: owned.error }, { status: owned.status });
    }

    await prisma.deadline.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/deadlines/[id]", err);
    return NextResponse.json(
      { error: "Failed to delete deadline" },
      { status: 500 }
    );
  }
}
