import { NextResponse } from 'next/server'
import { withAdminDb } from '@/lib/auth'
import { isSyncRunning, lastSyncSummary, runXeroSync } from '@/lib/xero-sync'
import { resetXeroBackoff } from '@/lib/xero-worker'

// Pull Xero now.
//
// Admin-gated because a sync spends the org's Xero rate limit, which is shared
// and finite — 60 calls a minute, 5,000 a day. A button anyone could hold down
// is a button that takes the finance portal offline for everybody.
export const POST = withAdminDb(async () => {
  if (isSyncRunning()) {
    return NextResponse.json(
      { ok: false, running: true, error: 'A sync is already running.' },
      { status: 409 }
    )
  }
  const outcome = await runXeroSync('MANUAL')
  // A manual sync that works means whatever was broken has been fixed — so the
  // scheduled worker must not sit in a six-hour backoff waiting to find out.
  if (outcome.status !== 'FAILED') resetXeroBackoff()
  return NextResponse.json({
    ok: outcome.status !== 'FAILED',
    ...outcome,
    sync: await lastSyncSummary(),
  })
})

export const GET = withAdminDb(async () => NextResponse.json(await lastSyncSummary()))
