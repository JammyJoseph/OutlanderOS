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
    const items = await prisma.budgetLineItem.findMany({
      where: { productionId: id },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json({ items });
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
    const item = await prisma.budgetLineItem.create({
      data: {
        productionId: id,
        category: body.category || "other",
        description: body.description || "",
        budgeted: body.budgeted == null || body.budgeted === "" ? 0 : Number(body.budgeted),
        actual: body.actual == null || body.actual === "" ? 0 : Number(body.actual),
        notes: body.notes || null,
        sortOrder: body.sortOrder == null ? 0 : Number(body.sortOrder),
      },
    });
    return NextResponse.json({ item });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
});

const PUT__h = withAuth(async (request: NextRequest) => {
  const url = new URL(request.url);
  const itemId = url.searchParams.get("itemId");
  if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 });
  const body = await request.json();
  try {
    const data: Record<string, unknown> = {};
    if (body.category !== undefined) data.category = body.category;
    if (body.description !== undefined) data.description = body.description;
    if (body.budgeted !== undefined)
      data.budgeted = body.budgeted === "" || body.budgeted == null ? 0 : Number(body.budgeted);
    if (body.actual !== undefined)
      data.actual = body.actual === "" || body.actual == null ? 0 : Number(body.actual);
    if (body.notes !== undefined) data.notes = body.notes || null;
    if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder);

    const item = await prisma.budgetLineItem.update({ where: { id: itemId }, data });
    return NextResponse.json({ item });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
});

const DELETE__h = withAuth(async (request: NextRequest) => {
  const url = new URL(request.url);
  const itemId = url.searchParams.get("itemId");
  if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 });
  try {
    await prisma.budgetLineItem.delete({ where: { id: itemId } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
});

export const GET = withErrorHandling(GET__h as any)
export const POST = withErrorHandling(POST__h as any)
export const PUT = withErrorHandling(PUT__h as any)
export const DELETE = withErrorHandling(DELETE__h as any)
