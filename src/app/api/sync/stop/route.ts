import { withErrorHandling } from "@/lib/api-error"
import { NextResponse } from "next/server";
import { getSyncEngine } from "@/lib/sync-engine";
import { withAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

const POST__h = withAdmin(async () => {
  const engine = getSyncEngine();
  engine.stop();
  return NextResponse.json({ running: engine.isRunning() });
});

export const POST = withErrorHandling(POST__h as any)
