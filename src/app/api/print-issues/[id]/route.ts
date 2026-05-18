import { withErrorHandling } from "@/lib/api-error"
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

const GET__h = withAuth(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  try {
    const issue = await prisma.printIssue.findUnique({
      where: { id },
      include: {
        pages: {
          include: { client: { select: { name: true } } },
          orderBy: { pageNumber: "asc" },
        },
      },
    });
    if (!issue) return NextResponse.json({ issue: null }, { status: 404 });
    return NextResponse.json({ issue });
  } catch {
    return NextResponse.json({ issue: null }, { status: 500 });
  }
});

export const GET = withErrorHandling(GET__h as any)
