import { withErrorHandling } from "@/lib/api-error"
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { validateRequired, sanitizeString } from "@/lib/validate";

const GET__h = withAuth(async (request: NextRequest) => {
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
});

const POST__h = withAuth(async (request: NextRequest, _ctx, user) => {
  try {
    const body = await request.json();

    const missing = validateRequired(body, ["clientName", "title", "type"]);
    if (missing) return NextResponse.json({ error: missing }, { status: 400 });

    const clientName = sanitizeString(body.clientName, 200);
    const title = sanitizeString(body.title, 300);
    const { type, value, currency } = body;

    let client = await prisma.client.findFirst({
      where: { name: { equals: clientName, mode: "insensitive" } },
    });

    if (!client) {
      client = await prisma.client.create({
        data: { name: clientName },
      });
    }

    const campaign = await prisma.campaign.create({
      data: {
        clientId: client.id,
        title,
        type,
        value: value ? parseFloat(value) : null,
        currency: currency ?? "GBP",
        createdById: user.userId,
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
});

export const GET = withErrorHandling(GET__h as any)
export const POST = withErrorHandling(POST__h as any)
