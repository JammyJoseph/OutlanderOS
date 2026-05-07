import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const deadline = await prisma.deadline.update({
      where: { id },
      data,
    });

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
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
