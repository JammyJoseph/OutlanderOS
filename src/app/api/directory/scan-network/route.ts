import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth"
import {
  normalizeHandle,
  detectCreativeRole,
  type CreativeRoleMatch,
} from "@/lib/instagram-scan"
import {
  apifyScanFollowing,
  apifyProfileBios,
  apifyConfigured,
  type FollowingAccount,
} from "@/lib/instagram-apify"
import { upsertScannedContact, findContactByHandle } from "@/lib/scan-contacts"
import { getCachedScan, setCachedScan } from "@/lib/scan-cache"
import { logger } from "@/lib/logger"

// How many following accounts to pull, and how many of the ones that DON'T match
// on their name we'll bio-enrich (each enrich is an Apify scrape, so it's capped
// to keep the whole request within typical reverse-proxy timeouts).
const FOLLOWING_CAP = 200
const BIO_ENRICH_CAP = 40

interface FoundCreative {
  handle: string
  name: string | null
  category: string
  matchedVia: "name" | "bio"
  keyword: string
  profilePic: string | null
  added: boolean
  existed: boolean
}

// POST /api/directory/scan-network
// Body: { handle: string }
// Scans who @handle follows, keeps the ones whose name or bio reads as a creative
// crew role, and auto-adds the new ones to the directory (source "network_scan",
// confidence LIKELY, referenced back to @handle). Dedupes against the directory.
export const POST = withAuth(async (request: NextRequest, _ctx, user) => {
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

  if (!apifyConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        handle,
        error:
          "Network scanning needs the Apify integration, which isn't configured on this server.",
      },
      { status: 200 }
    )
  }

  // Cache the raw following list for 24h — re-running the same profile shouldn't
  // re-hit the (paid) following actor.
  let following: FollowingAccount[] | null = null
  const hit = await getCachedScan<FollowingAccount[]>(handle, "following")
  if (hit && Array.isArray(hit.data)) {
    following = hit.data
  } else {
    following = await apifyScanFollowing(handle, FOLLOWING_CAP)
    if (following && following.length > 0) {
      await setCachedScan(handle, "following", following)
    }
  }

  if (!following || following.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        handle,
        error:
          "Couldn't read this profile's following — the account may be private, or Instagram is blocking the scan. Try again later.",
      },
      { status: 200 }
    )
  }

  // Pass 1 — match on the display name (free, no extra scrapes).
  const matches = new Map<string, { account: FollowingAccount; role: CreativeRoleMatch; via: "name" | "bio" }>()
  const unmatched: FollowingAccount[] = []
  for (const acc of following) {
    const role = detectCreativeRole(acc.name)
    if (role) matches.set(acc.handle, { account: acc, role, via: "name" })
    else unmatched.push(acc)
  }

  // Pass 2 — bio-verify the accounts that didn't match by name, in one batched
  // Apify run (capped). Bio is where most creatives declare their role.
  const bioTargets = unmatched.slice(0, BIO_ENRICH_CAP).map((a) => a.handle)
  if (bioTargets.length > 0) {
    try {
      const bios = await apifyProfileBios(bioTargets, BIO_ENRICH_CAP)
      for (const acc of unmatched) {
        const role = detectCreativeRole(bios.get(acc.handle))
        if (role) matches.set(acc.handle, { account: acc, role, via: "bio" })
      }
    } catch (err) {
      logger.warn("scan-network", `Bio enrichment failed for @${handle}`, err)
    }
  }

  // Add each match to the directory, skipping handles that already exist.
  const found: FoundCreative[] = []
  for (const { account, role, via } of matches.values()) {
    const existing = await findContactByHandle(account.handle)
    if (existing) {
      found.push({
        handle: account.handle,
        name: account.name,
        category: role.category,
        matchedVia: via,
        keyword: role.keyword,
        profilePic: account.profilePic,
        added: false,
        existed: true,
      })
      continue
    }
    try {
      await upsertScannedContact(
        {
          handle: account.handle,
          name: account.name,
          category: role.category,
          profilePic: account.profilePic,
          confidence: "LIKELY",
          source: "network_scan",
          scanSource: handle, // who they were found through
        },
        user.userId
      )
      found.push({
        handle: account.handle,
        name: account.name,
        category: role.category,
        matchedVia: via,
        keyword: role.keyword,
        profilePic: account.profilePic,
        added: true,
        existed: false,
      })
    } catch (err) {
      logger.warn("scan-network", `Failed to add @${account.handle}`, err)
    }
  }

  // Breakdown by category for the summary line.
  const breakdown: Record<string, number> = {}
  for (const f of found) breakdown[f.category] = (breakdown[f.category] ?? 0) + 1

  found.sort((a, b) => a.category.localeCompare(b.category) || a.handle.localeCompare(b.handle))

  return NextResponse.json({
    ok: true,
    handle,
    scanned: following.length,
    found: found.length,
    added: found.filter((f) => f.added).length,
    skippedExisting: found.filter((f) => f.existed).length,
    bioChecked: bioTargets.length,
    breakdown,
    people: found,
  })
})
