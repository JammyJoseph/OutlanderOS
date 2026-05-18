import { NextRequest, NextResponse } from "next/server";
import { getMediaInsights, InstagramApiError } from "@/lib/instagram";
import { withAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const mediaType = searchParams.get("media_type") ?? "IMAGE";

    const insights = await getMediaInsights(id, mediaType);
    return NextResponse.json(insights);
  } catch (err) {
    console.error("GET /api/instagram/media/[id]/insights", err);
    if (err instanceof InstagramApiError) {
      return NextResponse.json(
        { error: err.message, code: err.code, type: err.type },
        { status: err.isTokenError ? 401 : 502 }
      );
    }
    const message = err instanceof Error ? err.message : "Failed to fetch insights";
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
