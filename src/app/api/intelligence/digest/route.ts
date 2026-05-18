import { NextRequest, NextResponse } from "next/server";
import { generateDailyDigest } from "@/lib/ai-intelligence";
import { getCurrentUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const me = getCurrentUser(request);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const firstName = me.name?.split(" ")[0];
    const digest = await generateDailyDigest(firstName);
    return NextResponse.json(digest);
  } catch (err) {
    console.error("POST /api/intelligence/digest", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Digest failed" },
      { status: 500 }
    );
  }
}
