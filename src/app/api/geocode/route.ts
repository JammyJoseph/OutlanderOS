import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";

// Server-side proxy for OpenStreetMap Nominatim geocoding. Calling Nominatim
// from the browser is unreliable (CORS + their usage policy requires a real
// User-Agent / Referer), so location coordinates are resolved here instead.
//
// GET /api/geocode?q=<address>          → { lat, lng, displayName }
// GET /api/geocode?q=<address>&list=1   → { results: [{ lat, lng, displayName }] }

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
// Nominatim asks for an identifying UA with contact info.
const UA = "OutlanderOS/1.0 (production call sheets; contact@outlandermag.com)";

export const GET = withAuth(async (request: NextRequest) => {
  const q = (request.nextUrl.searchParams.get("q") || "").trim();
  const wantList = request.nextUrl.searchParams.get("list") === "1";
  if (!q) {
    return NextResponse.json({ error: "Missing q parameter" }, { status: 400 });
  }

  const limit = wantList ? 5 : 1;
  const url = `${NOMINATIM}?format=json&addressdetails=0&limit=${limit}&q=${encodeURIComponent(q)}`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": UA },
      // Nominatim data changes slowly; let the platform cache identical lookups.
      next: { revalidate: 86400 },
    });
    if (!res.ok) {
      return NextResponse.json({ error: "Geocoding unavailable" }, { status: 502 });
    }
    const raw = (await res.json()) as { lat: string; lon: string; display_name: string }[];
    const results = (raw || [])
      .map((r) => ({
        lat: parseFloat(r.lat),
        lng: parseFloat(r.lon),
        displayName: r.display_name,
      }))
      .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));

    if (wantList) return NextResponse.json({ results });
    if (results.length === 0) {
      return NextResponse.json({ error: "No match" }, { status: 404 });
    }
    return NextResponse.json(results[0]);
  } catch {
    return NextResponse.json({ error: "Geocoding failed" }, { status: 502 });
  }
});
