import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const issues = await prisma.printIssue.findMany({
      orderBy: [{ year: "desc" }, { createdAt: "desc" }],
    });
    return NextResponse.json({ issues });
  } catch {
    return NextResponse.json({ issues: [] });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  try {
    const issue = await prisma.printIssue.create({
      data: {
        title: body.title,
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
}
