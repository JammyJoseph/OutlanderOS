import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { validateRequired, validateDate } from "@/lib/validate";

export const GET = withAuth(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  try {
    const sheets = await prisma.callSheet.findMany({
      where: { productionId: id },
      orderBy: { shootDate: "asc" },
    });
    return NextResponse.json({ sheets });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
});

export const POST = withAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const body = await request.json();

  const missing = validateRequired(body, ["shootDate"]);
  if (missing) return NextResponse.json({ error: missing }, { status: 400 });
  if (!validateDate(body.shootDate)) {
    return NextResponse.json({ error: "Invalid shootDate" }, { status: 400 });
  }

  try {
    const sheet = await prisma.callSheet.create({
      data: {
        productionId: id,
        status: "DRAFT",
        shootDate: new Date(body.shootDate),
        callTime: body.callTime || "08:00",
        location: body.location || {},
        schedule: body.schedule || [],
        crew: body.crew || [],
        notes: body.title ? JSON.stringify({ shootTitle: body.title }) : "",
      },
    });
    return NextResponse.json({ sheet });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
});
