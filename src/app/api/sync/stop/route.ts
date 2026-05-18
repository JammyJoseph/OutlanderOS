import { NextResponse } from "next/server";
import { getSyncEngine } from "@/lib/sync-engine";
import { withAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const POST = withAdmin(async () => {
  const engine = getSyncEngine();
  engine.stop();
  return NextResponse.json({ running: engine.isRunning() });
});
