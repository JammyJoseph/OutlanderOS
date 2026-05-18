import { NextResponse } from 'next/server'
import { ingestAllFeeds } from '@/lib/think-tank/rss-ingester'
import { withAuth } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export const POST = withAuth(async () => {
  const started = Date.now()
  const results = await ingestAllFeeds()
  const totals = results.reduce(
    (acc, r) => {
      acc.fetched += r.fetched
      acc.inserted += r.inserted
      acc.skipped += r.skipped
      if (r.error) acc.errors++
      return acc
    },
    { fetched: 0, inserted: 0, skipped: 0, errors: 0 },
  )
  return NextResponse.json({
    ranAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    totals,
    results,
  })
})
