import type { PipelineSnapshot } from "@/lib/trello";

const CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEntry = { snapshot: PipelineSnapshot; expiresAt: number };

const globalRef = globalThis as unknown as { __trelloCache?: CacheEntry | null };

export function getCachedSnapshot(): PipelineSnapshot | null {
  const entry = globalRef.__trelloCache;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) return null;
  return entry.snapshot;
}

export function setCachedSnapshot(snapshot: PipelineSnapshot): void {
  globalRef.__trelloCache = { snapshot, expiresAt: Date.now() + CACHE_TTL_MS };
}

export function clearCachedSnapshot(): void {
  globalRef.__trelloCache = null;
}
