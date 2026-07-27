import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, isAdminInDb } from "@/lib/auth";

// PATCH /api/productions/[id]/archive — archive/unarchive a production.
// Body: { archived: boolean } (defaults to true).
//
// Permissions differ by how the project came to exist:
//   • Editorial (standalone) — any signed-in member or admin. These are our own
//     projects with no external commitment behind them.
//   • Commercial (deal-linked) — admins only. There is a signed agreement behind
//     the project, so archiving it is a commercial decision, not a production
//     one. Members get a 403 explaining that Commercial owns it; the UI shows
//     the same message rather than hiding the button.
//
// Archiving a deal-linked production does NOT touch the parent deal — the deal
// stays live in the pipeline. The cascade only runs the other way (archiving a
// deal archives its production, in lib/archive.ts).
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

    // Deal-linked projects carry a commercial agreement, so only an admin may
    // archive one. Editorial projects are open to any signed-in member.
    if (existing.campaignId && !(await isAdminInDb(user))) {
      return NextResponse.json(
        {
          error:
            "This project is bound by a commercial agreement. Commercial needs to remove it, or an admin can archive it here.",
          reason: "COMMERCIAL_LOCKED",
          campaignId: existing.campaignId,
        },
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
