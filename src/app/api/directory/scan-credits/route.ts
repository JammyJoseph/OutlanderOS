import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth"
import { scanCredits, normalizeHandle, type ScanCreditsResult } from "@/lib/instagram-scan"
import { getCachedScan, setCachedScan } from "@/lib/scan-cache"

// POST /api/directory/scan-credits
// Body: { handle: string }
// Scans a profile's recent post captions for crew credits and co-mentions.
export const POST = withAuth(async (request: NextRequest) => {
  let body: { handle?: string } = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const handle = normalizeHandle(body.handle)
  if (!handle) {
    return NextResponse.json(
      { error: "Enter a valid Instagram handle or URL." },
      { status: 400 }
    )
  }

  let result: ScanCreditsResult
  let cached = false
  const hit = await getCachedScan<ScanCreditsResult>(handle, "credits")
  if (hit && hit.data.ok) {
    result = hit.data
    cached = true
  } else {
    result = await scanCredits(handle)
    if (result.ok) await setCachedScan(handle, "credits", result)
  }

  return NextResponse.json({ ...result, cached })
})
