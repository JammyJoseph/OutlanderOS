import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'

// Public health-check endpoint — no authentication required.
// Used by external uptime monitoring.
export const dynamic = 'force-dynamic'

export async function GET() {
  // Database connectivity — quick round-trip query.
  let database: { status: string; error?: string } = { status: 'unknown' }
  try {
    await prisma.$queryRaw`SELECT 1`
    database = { status: 'connected' }
  } catch (error) {
    logger.error('health', 'Database check failed', error)
    database = {
      status: 'disconnected',
      error: "An error occurred",
    }
  }

  // Last sync times per source, from the sync engine's persisted status.
  let lastSync: Array<{
    source: string
    state: string
    lastSyncAt: string | null
    lastSuccessAt: string | null
    errorCount24h: number
  }> = []
  if (database.status === 'connected') {
    try {
      const statuses = await prisma.syncStatus.findMany({
        orderBy: { source: 'asc' },
      })
      lastSync = statuses.map((s) => ({
        source: s.source,
        state: s.state,
        lastSyncAt: s.lastSyncAt?.toISOString() ?? null,
        lastSuccessAt: s.lastSuccessAt?.toISOString() ?? null,
        errorCount24h: s.errorCount24h,
      }))
    } catch {
      // Non-fatal — sync status just won't be reported.
    }
  }

  const mem = process.memoryUsage()
  const toMb = (n: number) => Math.round((n / 1024 / 1024) * 10) / 10

  return NextResponse.json({
    status: database.status === 'connected' ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    database,
    lastSync,
    memory: {
      rssMb: toMb(mem.rss),
      heapUsedMb: toMb(mem.heapUsed),
      heapTotalMb: toMb(mem.heapTotal),
    },
    nodeVersion: process.version,
  })
}
