import { NextResponse } from "next/server";
import { buildSnapshot } from "@/lib/trello";
import {
  clearCachedSnapshot,
  setCachedSnapshot,
} from "@/lib/trello-cache";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    clearCachedSnapshot();
    const snapshot = await buildSnapshot();
    setCachedSnapshot(snapshot);
    return NextResponse.json({ ...snapshot, cached: false, synced: true });
  } catch (err) {
    console.error("POST /api/trello/sync", err);
    const message = err instanceof Error ? err.message : "Failed to sync Trello board";
    return NextResponse.json(
      { error: message, stages: [], members: [], boardUrl: "", fetchedAt: null },
      { status: 500 }
    );
  }
}
