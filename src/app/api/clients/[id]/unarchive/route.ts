import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, canArchiveDeals } from "@/lib/auth";

// PATCH /api/clients/[id]/unarchive — restore an archived client so it
// reappears in the clients list and dropdowns. Restricted to the commercial
// team or an admin, matching deal archiving.
export const PATCH = withAuth(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  user
) => {
  try {
    if (!(await canArchiveDeals(user))) {
      return NextResponse.json(
        { error: "Only the commercial team or an admin can restore clients." },
        { status: 403 }
      );
    }
    const { id } = await params;
    const existing = await prisma.client.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const client = await prisma.client.update({
      where: { id },
      data: { archived: false, archivedAt: null },
    });
    return NextResponse.json(client);
  } catch (err) {
    console.error("PATCH /api/clients/[id]/unarchive", err);
    return NextResponse.json({ error: "Failed to restore client" }, { status: 500 });
  }
});
