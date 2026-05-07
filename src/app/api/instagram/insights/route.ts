import { NextRequest, NextResponse } from "next/server";
import { getAccountInsights, InstagramApiError } from "@/lib/instagram";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const periodParam = searchParams.get("period") ?? "day";
    const period: "day" | "week" | "days_28" =
      periodParam === "week" || periodParam === "days_28"
        ? periodParam
        : "day";

    const insights = await getAccountInsights(period);
    return NextResponse.json({ period, ...insights });
  } catch (err) {
    console.error("GET /api/instagram/insights", err);
    if (err instanceof InstagramApiError) {
      return NextResponse.json(
        { error: err.message, code: err.code, type: err.type },
        { status: err.isTokenError ? 401 : 502 }
      );
    }
    const message = err instanceof Error ? err.message : "Failed to fetch insights";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
