import { NextResponse } from "next/server";
import { getProfile, InstagramApiError } from "@/lib/instagram";
import { withAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const GET = withAuth(async () => {
  try {
    const profile = await getProfile();
    return NextResponse.json(profile);
  } catch (err) {
    console.error("GET /api/instagram/profile", err);
    if (err instanceof InstagramApiError) {
      return NextResponse.json(
        { error: err.message, code: err.code, type: err.type },
        { status: err.isTokenError ? 401 : 502 }
      );
    }
    const message = err instanceof Error ? err.message : "Failed to fetch profile";
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
