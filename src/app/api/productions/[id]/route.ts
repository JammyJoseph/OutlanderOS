import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const production = await prisma.production.findUnique({
      where: { id },
      include: {
        campaign: { include: { client: true } },
        crew: { include: { contact: true } },
        callSheets: {
          orderBy: { shootDate: "asc" },
          select: {
            id: true,
            shootDate: true,
            callTime: true,
            location: true,
            notes: true,
            distributedAt: true,
          },
        },
        expenses: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!production) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ production });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  try {
    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.brief !== undefined) updateData.brief = body.brief;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.budgetTotal !== undefined) updateData.budgetTotal = body.budgetTotal;
    if (body.budgetActual !== undefined) updateData.budgetActual = body.budgetActual;
    if (body.marginTarget !== undefined) updateData.marginTarget = body.marginTarget;
    if (body.shootDates !== undefined) {
      updateData.shootDates = body.shootDates.map((d: string) => new Date(d));
    }
    if (body.campaignId !== undefined) updateData.campaignId = body.campaignId || null;
    if (body.leadId !== undefined) updateData.leadId = body.leadId || null;

    const production = await prisma.production.update({
      where: { id },
      data: updateData,
      include: {
        campaign: { include: { client: true } },
        crew: { include: { contact: true } },
        callSheets: { select: { id: true, shootDate: true } },
      },
    });
    return NextResponse.json({ production });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await prisma.production.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
