import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

export const GET = withAuth(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  try {
    const members = await prisma.productionTeamMember.findMany({
      where: { productionId: id },
      orderBy: [{ status: "desc" }, { createdAt: "asc" }],
    });
    return NextResponse.json({ members });
  } catch (e) {
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
});

export const POST = withAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const body = await request.json();
  try {
    const member = await prisma.productionTeamMember.create({
      data: {
        productionId: id,
        name: body.name || "Unnamed",
        role: body.role || "Crew",
        email: body.email || null,
        phone: body.phone || null,
        rate: body.rate === "" || body.rate == null ? null : Number(body.rate),
        ratePer: body.ratePer || "day",
        status: body.status || "SUGGESTED",
        notes: body.notes || null,
      },
    });
    return NextResponse.json({ member });
  } catch (e) {
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
});

export const PUT = withAuth(async (request: NextRequest) => {
  const url = new URL(request.url);
  const memberId = url.searchParams.get("memberId");
  if (!memberId) return NextResponse.json({ error: "memberId required" }, { status: 400 });
  const body = await request.json();
  try {
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.role !== undefined) data.role = body.role;
    if (body.email !== undefined) data.email = body.email || null;
    if (body.phone !== undefined) data.phone = body.phone || null;
    if (body.rate !== undefined)
      data.rate = body.rate === "" || body.rate == null ? null : Number(body.rate);
    if (body.ratePer !== undefined) data.ratePer = body.ratePer || "day";
    if (body.status !== undefined) data.status = body.status;
    if (body.notes !== undefined) data.notes = body.notes || null;

    const member = await prisma.productionTeamMember.update({ where: { id: memberId }, data });
    return NextResponse.json({ member });
  } catch (e) {
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
});

export const DELETE = withAuth(async (request: NextRequest) => {
  const url = new URL(request.url);
  const memberId = url.searchParams.get("memberId");
  if (!memberId) return NextResponse.json({ error: "memberId required" }, { status: 400 });
  try {
    await prisma.productionTeamMember.delete({ where: { id: memberId } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
});
