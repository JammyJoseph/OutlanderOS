// Shared helpers for the directory pages (list, detail, leaderboard).

// Normalise a raw Instagram value (URL, @handle or bare handle) to just the
// handle, or null when empty.
export function igHandle(raw: string | null | undefined): string | null {
  if (!raw) return null
  return (
    raw
      .replace(/https?:\/\/(www\.)?instagram\.com\//i, '')
      .replace(/^@/, '')
      .replace(/\/.*$/, '')
      .trim() || null
  )
}

// Compact follower count — "12.5K", "1.2M". Null when unknown.
export function fmtFollowers(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n)) return null
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}K`
  return String(n)
}
