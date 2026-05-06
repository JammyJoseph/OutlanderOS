import { NextResponse } from "next/server";
import { buildSnapshot } from "@/lib/trello";
import {
  getCachedSnapshot,
  setCachedSnapshot,
} from "@/lib/trello-cache";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cached = getCachedSnapshot();
    if (cached) {
      return NextResponse.json({ ...cached, cached: true });
    }

    const snapshot = await buildSnapshot();
    setCachedSnapshot(snapshot);
    return NextResponse.json({ ...snapshot, cached: false });
  } catch (err) {
    console.error("GET /api/trello", err);
    const message = err instanceof Error ? err.message : "Failed to fetch Trello board";
    return NextResponse.json(
      { error: message, stages: [], members: [], labels: [], boardUrl: "", fetchedAt: null },
      { status: 500 }
    );
  }
}
