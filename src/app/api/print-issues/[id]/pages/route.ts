import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
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
}
