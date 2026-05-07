import { NextResponse } from "next/server";
import { getCachedSnapshot } from "@/lib/trello-cache";
import { getSyncEngine } from "@/lib/sync-engine";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const engine = getSyncEngine();
    const result = await engine.runOnce("trello");
    if (!result.ok) {
      return NextResponse.json(
        { error: result.detail, stages: [], members: [], boardUrl: "", fetchedAt: null },
        { status: 500 }
      );
    }
    const snapshot = getCachedSnapshot();
    if (!snapshot) {
      return NextResponse.json(
        { error: "no snapshot available", stages: [], members: [], boardUrl: "", fetchedAt: null },
        { status: 500 }
      );
    }
    return NextResponse.json({ ...snapshot, cached: false, synced: true });
  } catch (err) {
    console.error("POST /api/trello/sync", err);
    const message = err instanceof Error ? err.message : "Failed to sync Trello board";
    return NextResponse.json(
      { error: message, stages: [], members: [], labels: [], boardUrl: "", fetchedAt: null },
      { status: 500 }
    );
  }
}
