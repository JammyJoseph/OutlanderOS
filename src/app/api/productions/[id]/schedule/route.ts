import { withErrorHandling } from "@/lib/api-error"
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

const GET__h = withAuth(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  try {
    const blocks = await prisma.scheduleBlock.findMany({
      where: { productionId: id },
      orderBy: [{ shootDay: "asc" }, { time: "asc" }, { sortOrder: "asc" }],
    });
    return NextResponse.json({ blocks });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
});

const POST__h = withAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const body = await request.json();
  try {
    const block = await prisma.scheduleBlock.create({
      data: {
        productionId: id,
        shootDay: body.shootDay == null ? 1 : Number(body.shootDay),
        time: body.time || "08:00",
        activity: body.activity || "Activity",
        location: body.location || null,
        notes: body.notes || null,
        sortOrder: body.sortOrder == null ? 0 : Number(body.sortOrder),
      },
    });
    return NextResponse.json({ block });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
});

const PUT__h = withAuth(async (request: NextRequest) => {
  const url = new URL(request.url);
  const blockId = url.searchParams.get("blockId");
  if (!blockId) return NextResponse.json({ error: "blockId required" }, { status: 400 });
  const body = await request.json();
  try {
    const data: Record<string, unknown> = {};
    if (body.shootDay !== undefined) data.shootDay = Number(body.shootDay);
    if (body.time !== undefined) data.time = body.time;
    if (body.activity !== undefined) data.activity = body.activity;
    if (body.location !== undefined) data.location = body.location || null;
    if (body.notes !== undefined) data.notes = body.notes || null;
    if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder);

    const block = await prisma.scheduleBlock.update({ where: { id: blockId }, data });
    return NextResponse.json({ block });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
});

const DELETE__h = withAuth(async (request: NextRequest) => {
  const url = new URL(request.url);
  const blockId = url.searchParams.get("blockId");
  if (!blockId) return NextResponse.json({ error: "blockId required" }, { status: 400 });
  try {
    await prisma.scheduleBlock.delete({ where: { id: blockId } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
});

export const GET = withErrorHandling(GET__h as any)
export const POST = withErrorHandling(POST__h as any)
export const PUT = withErrorHandling(PUT__h as any)
export const DELETE = withErrorHandling(DELETE__h as any)
