import { NextResponse } from "next/server";
import { getSyncEngine } from "@/lib/sync-engine";

export const dynamic = "force-dynamic";

export async function POST() {
  const engine = getSyncEngine();
  engine.stop();
  return NextResponse.json({ running: engine.isRunning() });
}
