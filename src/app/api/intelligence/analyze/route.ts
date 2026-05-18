import { NextResponse } from "next/server";
import { analyzeAndGroupTasks } from "@/lib/ai-intelligence";
import { withAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const POST = withAuth(async () => {
  try {
    const result = await analyzeAndGroupTasks();
    return NextResponse.json(result);
  } catch (err) {
    console.error("POST /api/intelligence/analyze", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis failed" },
      { status: 500 }
    );
  }
});
