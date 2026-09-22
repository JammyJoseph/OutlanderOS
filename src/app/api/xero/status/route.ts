import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { getXeroStatus } from '@/lib/xero'
import { lastSyncSummary } from '@/lib/xero-sync'

// Connection state plus data freshness, for the settings page and the finance
// dashboard's staleness banner. Readable by any signed-in user: knowing whether
// the finance numbers are current is not privileged, and the numbers themselves
// are behind the admin-gated finance layout.
export const GET = withAuth(async () => {
  const [connection, sync] = await Promise.all([getXeroStatus(), lastSyncSummary()])
  return NextResponse.json({ ...connection, sync })
})
