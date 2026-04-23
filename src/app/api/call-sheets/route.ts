import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const sheets = await prisma.callSheet.findMany({
      include: { production: { select: { title: true } } },
      orderBy: { shootDate: "desc" },
      take: 20,
    });
    return NextResponse.json({ sheets });
  } catch {
    return NextResponse.json({ sheets: [] });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  try {
    const sheet = await prisma.callSheet.create({
      data: {
        productionId: body.productionId,
        shootDate: new Date(body.shootDate),
        callTime: body.callTime || "08:00",
        location: body.location || {},
        schedule: body.schedule || [],
        crew: body.crew || [],
        notes: body.notes || "",
        status: body.status || "DRAFT",
      },
    });
    return NextResponse.json({ sheet });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
