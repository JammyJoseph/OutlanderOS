import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, isAdminInDb } from "@/lib/auth";

// PATCH /api/productions/[id]/archive — archive/unarchive a STANDALONE
// (editorial) production. Body: { archived: boolean } (defaults to true).
// Admin only. Productions linked to a deal are managed from Commercial —
// archive the parent deal instead.
export const PATCH = withAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  user
) => {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const archived = body.archived === undefined ? true : Boolean(body.archived);

    const existing = await prisma.production.findUnique({
      where: { id },
      select: { id: true, campaignId: true, archived: true },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (existing.campaignId) {
      return NextResponse.json(
        { error: "This production is linked to a deal — archive it from the Commercial portal by archiving the parent deal." },
        { status: 403 }
      );
    }

    if (!(await isAdminInDb(user))) {
      return NextResponse.json(
        { error: "Only an admin can archive a production." },
        { status: 403 }
      );
    }

    const production = await prisma.production.update({
      where: { id },
      data: { archived, archivedAt: archived ? new Date() : null },
    });
    return NextResponse.json({ production });
  } catch (e) {
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
});
