import { NextResponse } from "next/server";
import { analyzeAndGroupTasks } from "@/lib/ai-intelligence";

export const dynamic = "force-dynamic";

export async function POST() {
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
}
