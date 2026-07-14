import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";

// Presence is deliberately in-memory, not a Prisma model.
//
// It's ephemeral by nature (a 60s TTL — nothing here is worth surviving a
// restart), the team is small enough that the whole thing fits in a Map, and
// prod runs a single pm2 process, so one module-level store is the one store.
// Adding a table would also mean a migration, and the deploy pipeline runs
// `prisma generate` only — no `db push` — so a new table would 500 in prod.
//
// If OutlanderOS ever runs more than one node, this needs to move to Redis or
// a DB table (and the deploy needs a migration step to match).

type Presence = { userId: string; name: string; email: string; lastSeen: number };

// callSheetId → (userId → presence)
const rooms = new Map<string, Map<string, Presence>>();

// A user counts as present if they've beaten within this window.
const TTL_MS = 60_000;

// Drop stale entries so an abandoned tab's row doesn't linger, and so `rooms`
// doesn't grow without bound across sheets that nobody has open any more.
function sweep(): void {
  const cutoff = Date.now() - TTL_MS;
  for (const [sheetId, room] of rooms) {
    for (const [userId, p] of room) {
      if (p.lastSeen < cutoff) room.delete(userId);
    }
    if (room.size === 0) rooms.delete(sheetId);
  }
}

function activeIn(sheetId: string): Presence[] {
  const cutoff = Date.now() - TTL_MS;
  const room = rooms.get(sheetId);
  if (!room) return [];
  return [...room.values()]
    .filter((p) => p.lastSeen >= cutoff)
    .sort((a, b) => a.name.localeCompare(b.name));
}

// POST — heartbeat. The editor calls this on mount and every 30s after.
// The identity comes from the auth_token JWT, never from the request body: a
// client-supplied userId would let anyone appear in the room as anyone.
export const POST = withAuth(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  user
) => {
  const { id } = await params;
  sweep();

  let room = rooms.get(id);
  if (!room) {
    room = new Map();
    rooms.set(id, room);
  }
  room.set(user.userId, {
    userId: user.userId,
    name: user.name || user.email || "Someone",
    email: user.email,
    lastSeen: Date.now(),
  });

  // `self` saves the client a round trip to work out which of the active users
  // is itself (there's no /api/auth/me) — it can only learn that from the token,
  // and the token is already being read here.
  return NextResponse.json({ self: user.userId, active: activeIn(id) });
});

// GET — everyone who has beaten in the last 60s, the caller included. The editor
// filters itself out for display; returning it keeps the response self-describing.
export const GET = withAuth(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  sweep();
  return NextResponse.json({ active: activeIn(id) });
});
