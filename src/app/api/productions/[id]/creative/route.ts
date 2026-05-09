import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const assets = await prisma.creativeAsset.findMany({
      where: { productionId: id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json({ assets });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  try {
    const asset = await prisma.creativeAsset.create({
      data: {
        productionId: id,
        type: body.type || "reference",
        title: body.title || "Untitled",
        url: body.url || null,
        description: body.description || null,
        sortOrder: body.sortOrder == null ? 0 : Number(body.sortOrder),
      },
    });
    return NextResponse.json({ asset });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const url = new URL(request.url);
  const assetId = url.searchParams.get("assetId");
  if (!assetId) return NextResponse.json({ error: "assetId required" }, { status: 400 });
  const body = await request.json();
  try {
    const data: Record<string, unknown> = {};
    if (body.type !== undefined) data.type = body.type;
    if (body.title !== undefined) data.title = body.title;
    if (body.url !== undefined) data.url = body.url || null;
    if (body.description !== undefined) data.description = body.description || null;
    if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder);

    const asset = await prisma.creativeAsset.update({ where: { id: assetId }, data });
    return NextResponse.json({ asset });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const url = new URL(request.url);
  const assetId = url.searchParams.get("assetId");
  if (!assetId) return NextResponse.json({ error: "assetId required" }, { status: 400 });
  try {
    await prisma.creativeAsset.delete({ where: { id: assetId } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
