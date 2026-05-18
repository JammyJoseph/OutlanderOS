import { NextRequest, NextResponse } from "next/server";
import { getSyncEngine } from "@/lib/sync-engine";
import { SYNC_JOBS, type SyncSource } from "@/lib/sync-jobs";
import { withAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const POST = withAdmin(async (req: NextRequest) => {
  const url = new URL(req.url);
  const source = url.searchParams.get("source") as SyncSource | null;
  const engine = getSyncEngine();

  if (source) {
    if (!(source in SYNC_JOBS)) {
      return NextResponse.json({ error: `Unknown source: ${source}` }, { status: 400 });
    }
    const result = await engine.runOnce(source);
    return NextResponse.json({ source, ...result });
  }

  const sources = Object.keys(SYNC_JOBS) as SyncSource[];
  const results = await Promise.all(
    sources.map(async (s) => ({ source: s, ...(await engine.runOnce(s)) }))
  );
  return NextResponse.json({ results });
});
