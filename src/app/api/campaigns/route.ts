import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const clientId = searchParams.get("clientId");

    const campaigns = await prisma.campaign.findMany({
      where: {
        ...(status ? { status: status as never } : {}),
        ...(clientId ? { clientId } : {}),
        status: { not: "ARCHIVED" as never },
      },
      include: {
        client: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(campaigns);
  } catch (err) {
    console.error("GET /api/campaigns", err);
    return NextResponse.json({ error: "Failed to fetch campaigns" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const body = await request.json();
    const { clientName, title, type, value, currency } = body;

    if (!clientName?.trim() || !title?.trim() || !type) {
      return NextResponse.json({ error: "clientName, title and type are required" }, { status: 400 });
    }

    let createdById = session?.user?.id;
    if (!createdById) {
      const fallback = await prisma.user.findFirst();
      if (!fallback) {
        return NextResponse.json({ error: "No user found — seed the database first" }, { status: 500 });
      }
      createdById = fallback.id;
    }

    let client = await prisma.client.findFirst({
      where: { name: { equals: clientName.trim(), mode: "insensitive" } },
    });

    if (!client) {
      client = await prisma.client.create({
        data: { name: clientName.trim() },
      });
    }

    const campaign = await prisma.campaign.create({
      data: {
        clientId: client.id,
        title: title.trim(),
        type,
        value: value ? parseFloat(value) : null,
        currency: currency ?? "GBP",
        createdById,
      },
      include: {
        client: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(campaign, { status: 201 });
  } catch (err) {
    console.error("POST /api/campaigns", err);
    return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 });
  }
}
