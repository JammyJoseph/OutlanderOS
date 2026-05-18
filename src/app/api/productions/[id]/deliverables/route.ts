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
    const deliverables = await prisma.productionDeliverable.findMany({
      where: { productionId: id },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json({ deliverables });
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
    const item = await prisma.productionDeliverable.create({
      data: {
        productionId: id,
        type: body.type || "photo",
        title: body.title || "Untitled deliverable",
        status: body.status || "AWAITING",
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        url: body.url || null,
        notes: body.notes || null,
      },
    });
    return NextResponse.json({ item });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
});

const PUT__h = withAuth(async (request: NextRequest) => {
  const url = new URL(request.url);
  const deliverableId = url.searchParams.get("deliverableId");
  if (!deliverableId)
    return NextResponse.json({ error: "deliverableId required" }, { status: 400 });
  const body = await request.json();
  try {
    const data: Record<string, unknown> = {};
    if (body.type !== undefined) data.type = body.type;
    if (body.title !== undefined) data.title = body.title;
    if (body.status !== undefined) data.status = body.status;
    if (body.dueDate !== undefined)
      data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (body.url !== undefined) data.url = body.url || null;
    if (body.notes !== undefined) data.notes = body.notes || null;

    const item = await prisma.productionDeliverable.update({
      where: { id: deliverableId },
      data,
    });
    return NextResponse.json({ item });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
});

const DELETE__h = withAuth(async (request: NextRequest) => {
  const url = new URL(request.url);
  const deliverableId = url.searchParams.get("deliverableId");
  if (!deliverableId)
    return NextResponse.json({ error: "deliverableId required" }, { status: 400 });
  try {
    await prisma.productionDeliverable.delete({ where: { id: deliverableId } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
});

export const GET = withErrorHandling(GET__h as any)
export const POST = withErrorHandling(POST__h as any)
export const PUT = withErrorHandling(PUT__h as any)
export const DELETE = withErrorHandling(DELETE__h as any)
