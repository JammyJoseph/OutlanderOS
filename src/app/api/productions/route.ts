import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const productions = await prisma.production.findMany({
      include: {
        campaign: { include: { client: true } },
        crew: { include: { contact: true } },
        callSheets: { select: { id: true, shootDate: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ productions: productions ?? [] });
  } catch {
    return NextResponse.json({ productions: [] });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  try {
    const production = await prisma.production.create({
      data: {
        title: body.title,
        brief: body.brief || "",
        campaignId: body.campaignId || null,
        budgetTotal: body.budgetTotal || null,
        marginTarget: body.marginTarget || null,
        leadId: body.leadId || null,
      },
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
