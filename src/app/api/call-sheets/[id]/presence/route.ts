import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

// A user counts as present if they've beaten within this window. The editor
// heartbeats every 30s, so 60s tolerates exactly one dropped beat.
const TTL_MS = 60_000;

function cutoff(): Date {
  return new Date(Date.now() - TTL_MS);
}

async function activeIn(callSheetId: string) {
  const rows = await prisma.callSheetPresence.findMany({
    where: { callSheetId, lastSeen: { gte: cutoff() } },
    select: { userId: true, name: true, email: true, lastSeen: true },
    orderBy: { name: "asc" },
  });
  return rows.map((r) => ({ ...r, lastSeen: r.lastSeen.getTime() }));
}

// POST — heartbeat. The editor calls this on mount and every 30s after.
//
// Identity comes from the auth_token JWT, never from the request body: a
// client-supplied userId would let anyone appear in the room as anyone.
export const POST = withAuth(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  user
) => {
  const { id } = await params;
  const now = new Date();
  const name = user.name || user.email || "Someone";

  try {
    await prisma.callSheetPresence.upsert({
      where: { callSheetId_userId: { callSheetId: id, userId: user.userId } },
      create: { callSheetId: id, userId: user.userId, name, email: user.email, lastSeen: now },
      update: { name, email: user.email, lastSeen: now },
    });

    // Sweep on the write path — presence rows are disposable, and this keeps the
    // table from growing a row per person per sheet forever. Stale rows are
    // already ignored on read, so a failed sweep is cosmetic, not correctness.
    await prisma.callSheetPresence.deleteMany({
      where: { callSheetId: id, lastSeen: { lt: cutoff() } },
    });

    // `self` tells the client which of the active users is itself (there's no
    // /api/auth/me) — it can only learn that from the token, which is read here.
    return NextResponse.json({ self: user.userId, active: await activeIn(id) });
  } catch {
    // Presence is decoration. If the sheet is gone (FK violation) or the write
    // fails, say so quietly rather than breaking the editor around it.
    return NextResponse.json({ self: user.userId, active: [] });
  }
});

// GET — everyone who has beaten in the last 60s, the caller included. The editor
// filters itself out for display; returning it keeps the response self-describing.
export const GET = withAuth(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  try {
    return NextResponse.json({ active: await activeIn(id) });
  } catch {
    return NextResponse.json({ active: [] });
  }
});
