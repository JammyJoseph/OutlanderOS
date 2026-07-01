import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, canArchiveDeals } from "@/lib/auth";

// PATCH /api/clients/[id]/archive — archive a client. The client is hidden
// from the clients list and dropdowns, but its deals are left untouched
// (deals have their own archive system). Restricted to the commercial team
// or an admin, matching deal archiving.
export const PATCH = withAuth(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  user
) => {
  try {
    if (!(await canArchiveDeals(user))) {
      return NextResponse.json(
        { error: "Only the commercial team or an admin can archive clients." },
        { status: 403 }
      );
    }
    const { id } = await params;
    const existing = await prisma.client.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const client = await prisma.client.update({
      where: { id },
      data: { archived: true, archivedAt: new Date() },
    });
    return NextResponse.json(client);
  } catch (err) {
    console.error("PATCH /api/clients/[id]/archive", err);
    return NextResponse.json({ error: "Failed to archive client" }, { status: 500 });
  }
});
