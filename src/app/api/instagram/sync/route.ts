import { NextResponse } from "next/server";
import { runInstagramSync, getAccountSummary } from "@/lib/instagram-sync";
import { withAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const POST = withAuth(async () => {
  try {
    const report = await runInstagramSync();
    return NextResponse.json(report);
  } catch (err) {
    console.error("POST /api/instagram/sync", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
});

export const GET = withAuth(async () => {
  try {
    const summary = await getAccountSummary();
    return NextResponse.json(summary);
  } catch (err) {
    console.error("GET /api/instagram/sync", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
});
