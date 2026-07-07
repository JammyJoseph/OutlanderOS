// 24h cache for Instagram scrape results, backed by the ScanCache table.
// Keeps us from re-hitting Instagram for the same handle repeatedly.

import prisma from "@/lib/prisma"
import { logger } from "@/lib/logger"

const TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

export type ScanKind = "profile" | "credits" | "following"

// Returns cached scrape data if it's fresh (< 24h), else null.
export async function getCachedScan<T>(
  handle: string,
  kind: ScanKind
): Promise<{ data: T; cachedAt: Date } | null> {
  try {
    const row = await prisma.scanCache.findUnique({
      where: { handle_kind: { handle, kind } },
    })
    if (!row) return null
    const age = Date.now() - new Date(row.updatedAt).getTime()
    if (age > TTL_MS) return null
    return { data: row.data as T, cachedAt: new Date(row.updatedAt) }
  } catch (err) {
    logger.warn("scan-cache", "read failed", err)
    return null
  }
}

// Stores scrape data for a handle/kind, refreshing the timestamp.
export async function setCachedScan(
  handle: string,
  kind: ScanKind,
  data: unknown
): Promise<void> {
  try {
    await prisma.scanCache.upsert({
      where: { handle_kind: { handle, kind } },
      create: { handle, kind, data: data as object },
      update: { data: data as object },
    })
  } catch (err) {
    logger.warn("scan-cache", "write failed", err)
  }
}
