import { withErrorHandling } from "@/lib/api-error"
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { validateRequired, validateDate } from "@/lib/validate";

const GET__h = withAuth(async () => {
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
});

const POST__h = withAuth(async (request: NextRequest) => {
  const body = await request.json();

  const missing = validateRequired(body, ["productionId", "shootDate"]);
  if (missing) return NextResponse.json({ error: missing }, { status: 400 });
  if (!validateDate(body.shootDate)) {
    return NextResponse.json({ error: "Invalid shootDate" }, { status: 400 });
  }

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
});

export const GET = withErrorHandling(GET__h as any)
export const POST = withErrorHandling(POST__h as any)
