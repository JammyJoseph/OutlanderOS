import { withErrorHandling } from "@/lib/api-error"
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { validateRequired, sanitizeString } from "@/lib/validate";

const GET__h = withAuth(async () => {
  try {
    const productions = await prisma.production.findMany({
      include: {
        campaign: { include: { client: true } },
        crew: { include: { contact: true } },
        callSheets: {
          select: { id: true, shootDate: true, status: true, callTime: true, location: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json({ productions });
  } catch (e) {
    return NextResponse.json({ productions: [], error: String(e) });
  }
});

const POST__h = withAuth(async (request: NextRequest) => {
  const body = await request.json();

  const missing = validateRequired(body, ["title"]);
  if (missing) return NextResponse.json({ error: missing }, { status: 400 });

  try {
    const data: Record<string, unknown> = {
      title: sanitizeString(body.title, 300),
      brief: body.brief || null,
      description: body.description || null,
      figmaUrl: body.figmaUrl || null,
      clientName: body.clientName || body.client || null,
      status: body.status || "DRAFT",
      budgetTotal: body.budgetTotal != null ? Number(body.budgetTotal) : null,
    };
    if (Array.isArray(body.shootDates) && body.shootDates.length > 0) {
      data.shootDates = body.shootDates
        .filter((d: string) => d)
        .map((d: string) => new Date(d));
    }
    if (body.campaignId) data.campaignId = body.campaignId;
    if (body.leadId) data.leadId = body.leadId;

    const production = await prisma.production.create({
      data: data as never,
      include: {
        campaign: { include: { client: true } },
        crew: { include: { contact: true } },
        callSheets: { select: { id: true, shootDate: true, status: true, callTime: true, location: true } },
      },
    });
    return NextResponse.json({ production });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
});

export const GET = withErrorHandling(GET__h as any)
export const POST = withErrorHandling(POST__h as any)
