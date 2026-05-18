import { withErrorHandling } from "@/lib/api-error"
import { NextRequest, NextResponse } from "next/server";
import {
  classifyMediaType,
  getRecentMedia,
  InstagramApiError,
} from "@/lib/instagram";
import { withAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const GET__h = withAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const limit = Math.max(1, Math.min(100, Number(limitParam) || 25));

    const media = await getRecentMedia(limit);
    const enriched = media.map(m => ({
      ...m,
      classified_type: classifyMediaType(m),
    }));

    return NextResponse.json({ data: enriched, count: enriched.length });
  } catch (err) {
    console.error("GET /api/instagram/media", err);
    if (err instanceof InstagramApiError) {
      return NextResponse.json(
        { error: err.message, code: err.code, type: err.type },
        { status: err.isTokenError ? 401 : 502 }
      );
    }
    const message = err instanceof Error ? err.message : "Failed to fetch media";
    return NextResponse.json({ error: message, data: [] }, { status: 500 });
  }
});

export const GET = withErrorHandling(GET__h as any)
