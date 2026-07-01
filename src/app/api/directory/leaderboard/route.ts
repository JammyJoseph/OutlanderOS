import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAuth } from "@/lib/auth"
import type { CollaborationLink } from "@/lib/scan-contacts"

// GET /api/directory/leaderboard
// Ranks directory contacts ("creatives") by an activity score computed from the
// data captured during Instagram credit-scans: who they've collaborated with,
// how often they've been credited, how recently, how connected they are, and —
// as a tie-breaker — how big their following is.
//
// Query params (all optional):
//   ?category=Photographer   restrict to one category ("Top Photographers")
//   ?period=30 | 90          only rank contacts credited in the last N days
//   ?limit=100               cap the number of returned entries (default 100)

const DAY = 24 * 60 * 60 * 1000

// score = collab×3 + credits×2 + recency×1.5 + network×1 + followers×0.5
const W = { collab: 3, credit: 2, recency: 1.5, network: 1, followers: 0.5 }

function parsePeriod(raw: string | null): 30 | 90 | null {
  if (raw === "30") return 30
  if (raw === "90") return 90
  return null // "all" / absent / anything else → all time
}

function asLinks(value: unknown): CollaborationLink[] {
  return Array.isArray(value)
    ? (value as unknown as CollaborationLink[]).filter(
        (l) => l && typeof l.handle === "string"
      )
    : []
}

export const GET = withAuth(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get("category")?.trim() || null
  const period = parsePeriod(searchParams.get("period"))
  const limit = Math.min(
    500,
    Math.max(1, Number(searchParams.get("limit")) || 100)
  )

  const now = Date.now()
  const periodCutoff = period ? now - period * DAY : null

  const contacts = await prisma.contact.findMany({
    where: {
      isRadar: false,
      ...(category && category !== "all" ? { category } : {}),
      // When a period is selected, only rank people credited within it.
      ...(periodCutoff ? { scannedAt: { gte: new Date(periodCutoff) } } : {}),
    },
    select: {
      id: true,
      name: true,
      category: true,
      instagram: true,
      followers: true,
      profilePic: true,
      confidence: true,
      scannedAt: true,
      collaborations: true,
    },
  })

  const entries = contacts
    .map((c) => {
      const links = asLinks(c.collaborations)

      // 1. Collaboration count — distinct people worked with.
      const collaborationCount = new Set(
        links.map((l) => l.handle.toLowerCase())
      ).size
      // 2. Credit frequency — total times credited alongside others.
      const creditCount = links.reduce((sum, l) => sum + (l.count || 0), 0)
      // 4. Network size — collaborators that resolve to a known directory contact.
      const networkSize = links.filter((l) => l.contactId).length

      // 3. Recency — how recently they were credited.
      const scannedMs = c.scannedAt ? +new Date(c.scannedAt) : null
      let recencyBonus = 0
      if (scannedMs != null) {
        const age = now - scannedMs
        recencyBonus = age <= 30 * DAY ? 10 : age <= 90 * DAY ? 5 : 1
      }

      // 5. Follower count — gentle log scale keeps it a tie-breaker, not a driver.
      const followers = c.followers ?? 0
      const followersNormalized = followers > 0 ? Math.log10(followers) : 0

      const score =
        collaborationCount * W.collab +
        creditCount * W.credit +
        recencyBonus * W.recency +
        networkSize * W.network +
        followersNormalized * W.followers

      return {
        id: c.id,
        name: c.name,
        category: c.category,
        instagram: c.instagram,
        followers: c.followers,
        profilePic: c.profilePic,
        confidence: c.confidence,
        scannedAt: c.scannedAt,
        collaborationCount,
        creditCount,
        networkSize,
        recencyBonus,
        score: Math.round(score * 10) / 10,
      }
    })
    // Only rank people with some signal — no collabs, credits or followers means
    // there's nothing to rank them on.
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score || (b.followers ?? 0) - (a.followers ?? 0))
    .slice(0, limit)

  return NextResponse.json({
    period,
    category,
    total: entries.length,
    entries,
  })
})
