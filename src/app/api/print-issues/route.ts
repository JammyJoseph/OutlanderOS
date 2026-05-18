import { withErrorHandling } from "@/lib/api-error"
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { validateRequired, sanitizeString } from "@/lib/validate";

const GET__h = withAuth(async () => {
  try {
    const issues = await prisma.printIssue.findMany({
      orderBy: [{ year: "desc" }, { createdAt: "desc" }],
    });
    return NextResponse.json({ issues });
  } catch {
    return NextResponse.json({ issues: [] });
  }
});

const POST__h = withAuth(async (request: NextRequest) => {
  const body = await request.json();

  const missing = validateRequired(body, ["title"]);
  if (missing) return NextResponse.json({ error: missing }, { status: 400 });

  try {
    const issue = await prisma.printIssue.create({
      data: {
        title: sanitizeString(body.title, 300),
        year: body.year ?? new Date().getFullYear(),
        pageCount: body.pageCount ?? 0,
        status: body.status ?? "planning",
        printer: body.printer || null,
        printDate: body.printDate ? new Date(body.printDate) : null,
      },
    });
    return NextResponse.json({ issue });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
});

export const GET = withErrorHandling(GET__h as any)
export const POST = withErrorHandling(POST__h as any)
