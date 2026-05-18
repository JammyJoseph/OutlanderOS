import { withErrorHandling } from "@/lib/api-error"
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { validateRequired } from "@/lib/validate";

const POST__h = withAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const body = await request.json();

  const missing = validateRequired(body, ["pageNumber"]);
  if (missing) return NextResponse.json({ error: missing }, { status: 400 });

  try {
    const page = await prisma.printPage.create({
      data: {
        issueId: id,
        pageNumber: body.pageNumber,
        type: body.type || "editorial",
        assignedTo: body.assignedTo || null,
        clientId: body.clientId || null,
        status: body.status || "planned",
        contentUrl: body.contentUrl || null,
      },
      include: { client: { select: { name: true } } },
    });
    return NextResponse.json({ page });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
});

export const POST = withErrorHandling(POST__h as any)
