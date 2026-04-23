import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const sheet = await prisma.callSheet.findUnique({
      where: { id },
      include: {
        production: {
          select: {
            id: true,
            title: true,
            status: true,
            campaign: {
              select: {
                title: true,
                client: { select: { name: true } },
              },
            },
          },
        },
      },
    });
    if (!sheet) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ sheet });
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
    if (body.status !== undefined) updateData.status = body.status;
    if (body.shootDate !== undefined) updateData.shootDate = new Date(body.shootDate);
    if (body.callTime !== undefined) updateData.callTime = body.callTime;
    if (body.location !== undefined) updateData.location = body.location;
    if (body.schedule !== undefined) updateData.schedule = body.schedule;
    if (body.crew !== undefined) updateData.crew = body.crew;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.distributedAt !== undefined) {
      updateData.distributedAt = body.distributedAt ? new Date(body.distributedAt) : null;
    }

    const sheet = await prisma.callSheet.update({
      where: { id },
      data: updateData,
      include: {
        production: { select: { id: true, title: true } },
      },
    });
    return NextResponse.json({ sheet });
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
    await prisma.callSheet.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
