import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth"
import { scanProfile, normalizeHandle, type ScanProfileResult } from "@/lib/instagram-scan"
import { apifyScanProfile } from "@/lib/instagram-apify"
import { getCachedScan, setCachedScan } from "@/lib/scan-cache"
import { findContactByHandle } from "@/lib/scan-contacts"

// POST /api/directory/scan-profile
// Body: { handle: string }
// Scrapes a public Instagram profile (cached 24h) and reports whether the
// contact already exists in the directory.
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

  let result: ScanProfileResult
  let cached = false
  const hit = await getCachedScan<ScanProfileResult>(handle, "profile")
  if (hit && hit.data.ok) {
    result = hit.data
    cached = true
  } else {
    // Apify first (reliable, residential proxies); fall back to direct scraping
    // when it's unconfigured, fails, or times out. Direct scraping itself falls
    // back to a not-ok result, which the UI renders as manual-entry.
    result = (await apifyScanProfile(handle)) ?? (await scanProfile(handle))
    if (result.ok) await setCachedScan(handle, "profile", result)
  }

  const existing = await findContactByHandle(handle)

  if (!result.ok) {
    return NextResponse.json(
      {
        ...result,
        cached,
        existingContact: existing ? { id: existing.id, name: existing.name } : null,
        error: result.error || "Couldn't access this profile.",
      },
      { status: 200 } // 200 so the UI can show the manual-entry fallback
    )
  }

  return NextResponse.json({
    ...result,
    cached,
    existingContact: existing ? { id: existing.id, name: existing.name } : null,
  })
})
