import { withErrorHandling } from "@/lib/api-error"
import { NextResponse } from "next/server";
import { getSyncEngine } from "@/lib/sync-engine";
import { withAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

const POST__h = withAdmin(async () => {
  const engine = getSyncEngine();
  const wasRunning = engine.isRunning();
  engine.start();
  return NextResponse.json({ running: engine.isRunning(), wasRunning });
});

export const POST = withErrorHandling(POST__h as any)
