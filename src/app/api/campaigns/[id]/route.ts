import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

export const GET = withAuth(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true } },
        deliverables: true,
        assets: true,
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(campaign);
  } catch (err) {
    console.error("GET /api/campaigns/[id]", err);
    return NextResponse.json({ error: "Failed to fetch campaign" }, { status: 500 });
  }
});

export const PUT = withAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, title, value, currency, type, notes, ioSigned } = body;

    const campaign = await prisma.campaign.update({
      where: { id },
      data: {
        ...(status !== undefined ? { status } : {}),
        ...(title !== undefined ? { title } : {}),
        ...(value !== undefined ? { value: parseFloat(value) } : {}),
        ...(currency !== undefined ? { currency } : {}),
        ...(type !== undefined ? { type } : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(ioSigned !== undefined ? { ioSigned, ioSignedAt: ioSigned ? new Date() : null } : {}),
      },
      include: {
        client: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(campaign);
  } catch (err) {
    console.error("PUT /api/campaigns/[id]", err);
    return NextResponse.json({ error: "Failed to update campaign" }, { status: 500 });
  }
});

export const DELETE = withAuth(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;
    await prisma.campaign.update({
      where: { id },
      data: { status: "ARCHIVED" },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/campaigns/[id]", err);
    return NextResponse.json({ error: "Failed to delete campaign" }, { status: 500 });
  }
});
