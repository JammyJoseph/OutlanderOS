import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth"
import { scanProfile, normalizeHandle, type ScanProfileResult } from "@/lib/instagram-scan"
import { getCachedScan, setCachedScan } from "@/lib/scan-cache"
import { findContactByHandle } from "@/lib/scan-contacts"

const MAX_HANDLES = 30

interface BatchEntry {
  input: string
  handle: string | null
  ok: boolean
  result?: ScanProfileResult
  cached?: boolean
  existingContact?: { id: string; name: string } | null
  error?: string
}

// POST /api/directory/batch-scan
// Body: { handles: string[] }
// Scans up to 30 profiles. The shared rate-limiter (1 req / 3s) paces the
// underlying Instagram requests, so cached handles return instantly.
export const POST = withAuth(async (request: NextRequest) => {
  let body: { handles?: unknown } = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const raw = Array.isArray(body.handles) ? body.handles : []
  const inputs = raw
    .map((h) => String(h).trim())
    .filter(Boolean)
    .slice(0, MAX_HANDLES)

  if (inputs.length === 0) {
    return NextResponse.json(
      { error: "Paste at least one Instagram handle." },
      { status: 400 }
    )
  }

  const results: BatchEntry[] = []
  const seen = new Set<string>()

  for (const input of inputs) {
    const handle = normalizeHandle(input)
    if (!handle) {
      results.push({ input, handle: null, ok: false, error: "Invalid handle" })
      continue
    }
    if (seen.has(handle)) continue
    seen.add(handle)

    let result: ScanProfileResult
    let cached = false
    const hit = await getCachedScan<ScanProfileResult>(handle, "profile")
    if (hit && hit.data.ok) {
      result = hit.data
      cached = true
    } else {
      result = await scanProfile(handle)
      if (result.ok) await setCachedScan(handle, "profile", result)
    }

    const existing = await findContactByHandle(handle)
    results.push({
      input,
      handle,
      ok: result.ok,
      result,
      cached,
      existingContact: existing ? { id: existing.id, name: existing.name } : null,
      error: result.ok ? undefined : result.error || "Couldn't access this profile",
    })
  }

  return NextResponse.json({
    results,
    total: results.length,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
  })
})
