import { NextResponse } from "next/server";
import { getSyncEngine } from "@/lib/sync-engine";

export const dynamic = "force-dynamic";

export async function POST() {
  const engine = getSyncEngine();
  const wasRunning = engine.isRunning();
  engine.start();
  return NextResponse.json({ running: engine.isRunning(), wasRunning });
}
