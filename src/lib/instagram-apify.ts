// Apify-backed Instagram scraping for the Directory Intelligence tool.
//
// Apify runs the actual scrape behind residential proxies, so it succeeds where
// our direct best-effort scraping (see instagram-scan.ts) gets blocked. Both
// the profile scan and the credits scan use Apify's Instagram Profile Scraper
// (`apify/instagram-profile-scraper`), which returns the profile fields *and*
// the account's latest posts (with captions) in a single run.
//
// Every function here returns `null` on any failure (missing key, HTTP error,
// timeout, empty/blocked result) so callers can cleanly fall back to direct
// scraping. Never call these from a client — the API token is server-only.

import {
  categoryFromText,
  locationFromBio,
  extractMentions,
  parseCredits,
  normalizeHandle,
  type ScanProfileResult,
  type ScanCreditsResult,
} from "./instagram-scan"
import { logger } from "./logger"

// Tilde-encoded actor id for the API path (apify/instagram-profile-scraper).
const ACTOR = "apify~instagram-profile-scraper"
// Profile scrapes take a while behind proxies; cap the wait so a slow/hung run
// falls back to direct scraping rather than blocking the request indefinitely.
const APIFY_TIMEOUT_MS = 75_000

export function apifyConfigured(): boolean {
  return Boolean(process.env.APIFY_API_KEY)
}

// A single post as returned by the profile scraper's `latestPosts`.
interface ApifyPost {
  caption?: string | null
  shortCode?: string | null
  shortcode?: string | null
}

// The subset of the profile scraper's output item we care about.
interface ApifyProfileItem {
  username?: string | null
  fullName?: string | null
  biography?: string | null
  followersCount?: number | null
  profilePicUrl?: string | null
  profilePicUrlHD?: string | null
  externalUrl?: string | null
  latestPosts?: ApifyPost[] | null
  error?: string | null
  errorDescription?: string | null
}

// Runs the profile scraper synchronously and returns the first result item, or
// null on any failure. Uses Apify's run-sync-get-dataset-items endpoint so a
// single call both starts the run and returns its dataset (no racy "last run"
// polling, no orphaned runs).
async function runProfileScraper(handle: string): Promise<ApifyProfileItem | null> {
  const token = process.env.APIFY_API_KEY
  if (!token) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), APIFY_TIMEOUT_MS)
  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernames: [handle] }),
        signal: controller.signal,
      }
    )
    if (!res.ok) {
      logger.warn("instagram-apify", `Apify run for ${handle} → ${res.status}`)
      return null
    }
    const items = (await res.json()) as ApifyProfileItem[]
    if (!Array.isArray(items) || items.length === 0) return null
    // The scraper emits an item with an `error` field for private/blocked/
    // missing profiles — treat those as a miss so we fall back.
    const item = items.find((i) => !i?.error) ?? items[0]
    if (!item || item.error) {
      logger.warn("instagram-apify", `Apify item error for ${handle}: ${item?.error ?? "empty"}`)
      return null
    }
    return item
  } catch (err) {
    logger.warn("instagram-apify", `Apify run for ${handle} failed`, err)
    return null
  } finally {
    clearTimeout(timer)
  }
}

// Maps the scraper's latestPosts onto the {shortcode, caption} shape parseCredits expects.
function postsFromItem(item: ApifyProfileItem): { shortcode: string; caption: string }[] {
  const posts = Array.isArray(item.latestPosts) ? item.latestPosts : []
  return posts
    .map((p, i) => ({
      shortcode: p.shortCode || p.shortcode || `post-${i}`,
      caption: (p.caption || "").trim(),
    }))
    .filter((p) => p.caption)
}

// Profile scan via Apify. Returns null when Apify is unconfigured, fails, or
// yields nothing usable so the caller can fall back to direct scraping.
export async function apifyScanProfile(handleInput: string): Promise<ScanProfileResult | null> {
  const handle = normalizeHandle(handleInput)
  if (!handle || !apifyConfigured()) return null

  const item = await runProfileScraper(handle)
  if (!item) return null

  const name = item.fullName?.trim() || null
  const bio = item.biography?.trim() || null
  const followers = typeof item.followersCount === "number" ? item.followersCount : null
  const profilePic = item.profilePicUrlHD || item.profilePicUrl || null
  const website = item.externalUrl || null

  // Nothing useful came back — let direct scraping try instead.
  if (!name && !bio && followers == null && !profilePic) return null

  const category = categoryFromText(bio) ?? categoryFromText(name)
  const location = locationFromBio(bio)
  const taggedAccounts = extractMentions(bio).filter((h) => h !== handle)

  return {
    handle: item.username?.toLowerCase() || handle,
    name,
    bio,
    followers,
    profilePic,
    website,
    category,
    location,
    // Apify returns authoritative data, so a populated result is high-confidence.
    confidence: name || followers != null ? "VERIFIED" : "LIKELY",
    taggedAccounts,
    source: "apify",
    ok: true,
  }
}

// Credits scan via Apify — parses crew credits & co-mentions out of the
// profile's latest post captions. Returns null on failure / no posts.
export async function apifyScanCredits(handleInput: string): Promise<ScanCreditsResult | null> {
  const handle = normalizeHandle(handleInput)
  if (!handle || !apifyConfigured()) return null

  const item = await runProfileScraper(handle)
  if (!item) return null

  const posts = postsFromItem(item)
  if (posts.length === 0) return null

  const { credits, collaborationPairs } = parseCredits(posts, handle)
  return {
    handle,
    credits,
    collaborationPairs,
    postsScanned: posts.length,
    ok: true,
  }
}
