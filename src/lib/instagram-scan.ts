// Server-side Instagram scraping for the Directory Intelligence tool.
//
// Instagram aggressively blocks scraping, so every method here is best-effort
// and degrades gracefully. We try, in order:
//   1. the embed endpoint (/{handle}/embed/ — most reliable, no auth)
//   2. the public profile HTML (og: meta tags + any embedded JSON)
//   3. the ?__a=1&__d=dis JSON endpoint (usually blocked, worth a shot)
//
// All scraping is rate-limited to at most 1 request per 3 seconds and results
// are cached for 24h (see ScanCache in the DB). Never call these from a client.

import { CONTACT_CATEGORIES } from "@/lib/directory"
import { logger } from "@/lib/logger"

export type Confidence = "VERIFIED" | "LIKELY" | "UNVERIFIED"

// Three-tier classification for a scanned @mention:
//   "credited" — the caption gives them an explicit production role (Tier 1)
//   "likely"   — no caption role, but their bio shows a production role (Tier 2)
//   "social"   — no caption role and no matching bio; a casual/brand mention (Tier 3)
// Only "credited" and "likely" are real crew credits worth adding to the directory.
export type CreditTier = "credited" | "likely" | "social"

// A single recent post captured at scan time, used for the 3×3 thumbnail grid.
export interface RecentPost {
  shortcode: string
  imageUrl: string
  caption?: string | null
}

export interface ScanProfileResult {
  handle: string
  name: string | null
  bio: string | null
  followers: number | null
  profilePic: string | null
  website: string | null
  category: string | null
  location: string | null
  confidence: Confidence
  taggedAccounts: string[]
  recentPosts: RecentPost[] // up to 9 most recent posts (Apify only); [] otherwise
  source: string // which method succeeded: "embed" | "html" | "json" | "none"
  ok: boolean
  error?: string
}

export interface CreditPerson {
  handle: string
  role: string | null
  category: string | null
  mentionCount: number
  posts: string[] // post shortcodes / ids the handle appeared in
  confidence: Confidence
  tier: CreditTier // credited (Tier 1) | likely (Tier 2) | social (Tier 3)
  bioMatched?: boolean // true when a bio-role check promoted a mention to "likely"
}

export interface CollaborationPair {
  a: string
  b: string
  count: number
}

export interface ScanCreditsResult {
  handle: string
  credits: CreditPerson[] // Tier 1 (credited) + Tier 2 (likely) only — safe to add
  socialMentions: CreditPerson[] // Tier 3 — casual/brand mentions, excluded from "Add All"
  collaborationPairs: CollaborationPair[]
  postsScanned: number
  ok: boolean
  error?: string
}

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

// ── Rate limiter ────────────────────────────────────────────────────────────
// A single serialised gate ensures we never hit Instagram more than once per
// MIN_GAP_MS, no matter how many requests arrive concurrently.
const MIN_GAP_MS = 3000
let gate: Promise<void> = Promise.resolve()

export function rateLimitedFetch(url: string, init?: RequestInit): Promise<Response> {
  const run = gate.then(async () => {
    await sleep(0) // yield
    return fetch(url, {
      ...init,
      headers: {
        "User-Agent": USER_AGENT,
        "Accept-Language": "en-GB,en;q=0.9",
        Accept: "text/html,application/json,*/*",
        ...(init?.headers ?? {}),
      },
    })
  })
  // Chain the gate so the *next* caller waits MIN_GAP_MS after this one starts.
  gate = run.then(() => sleep(MIN_GAP_MS)).catch(() => sleep(MIN_GAP_MS))
  return run
}

// ── Handle normalisation ──────────────────────────────────────────────────────
export function normalizeHandle(raw: string | null | undefined): string | null {
  if (!raw) return null
  const cleaned = raw
    .trim()
    .replace(/https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .replace(/[/?#].*$/, "")
    .trim()
    .toLowerCase()
  // IG handles: letters, numbers, periods, underscores, 1–30 chars.
  if (!cleaned || !/^[a-z0-9._]{1,30}$/.test(cleaned)) return null
  return cleaned
}

// ── Bio / category parsing ────────────────────────────────────────────────────
// Maps free-text keywords found in bios & credits to a canonical category.
const CATEGORY_KEYWORDS: { category: string; needles: string[] }[] = [
  { category: "Photographer", needles: ["photographer", "photography", "photo", "📷", "📸"] },
  { category: "MUA", needles: ["mua", "makeup", "make up", "make-up", "makeup artist"] },
  { category: "Stylist", needles: ["stylist", "styling", "fashion stylist", "wardrobe"] },
  { category: "Creative Director", needles: ["creative director", "creative direction", "art director", " cd ", "ecd"] },
  { category: "Videographer", needles: ["videographer", "video", "cinematographer", "dop", "d.o.p", "filmmaker", "director of photography"] },
  { category: "Colorist", needles: ["colorist", "colourist"] },
  { category: "Grader", needles: ["grader", "grade", "grading"] },
  { category: "Editor", needles: ["editor", "editing", "post production", "post-production"] },
  { category: "Model", needles: ["model", "@models", "signed to"] },
  { category: "Talent", needles: ["talent", "actor", "actress", "presenter"] },
  { category: "Producer", needles: ["producer", "production", "produced"] },
  { category: "Set Designer", needles: ["set design", "set designer", "props", "set build"] },
  { category: "Casting Director", needles: ["casting director", "casting"] },
  { category: "PR", needles: [" pr ", "publicist", "public relations", "communications"] },
]

// Returns the best-guess category for a bit of bio/credit text, or null.
export function categoryFromText(text: string | null | undefined): string | null {
  if (!text) return null
  const lower = ` ${text.toLowerCase()} `
  for (const { category, needles } of CATEGORY_KEYWORDS) {
    if (needles.some((n) => lower.includes(n))) return category
  }
  return null
}

// Creative-role keywords for the network scan. Broader than CATEGORY_KEYWORDS —
// it covers the full crew vocabulary the directory cares about (Gaffer, Grip,
// Retoucher, Art Director, …) and reports *which* keyword matched so the added
// contact can carry a human-readable "found via their bio" reference. Ordered so
// more specific roles win over generic ones (e.g. "creative director" before
// "director", "hair stylist" before "stylist").
const CREATIVE_ROLE_KEYWORDS: { category: string; keyword: string; needles: string[] }[] = [
  { category: "Creative Director", keyword: "Creative Director", needles: ["creative director", "creative direction"] },
  { category: "Creative Director", keyword: "Art Director", needles: ["art director", "art direction"] },
  // Casting must beat the generic "director" rule below ("casting director").
  { category: "Casting Director", keyword: "Casting", needles: ["casting director", "casting"] },
  { category: "Photographer", keyword: "Photographer", needles: ["photographer", "photography", "📷", "📸"] },
  { category: "Videographer", keyword: "DOP", needles: ["dop", "d.o.p", "director of photography", "cinematographer", "cinematography"] },
  { category: "Videographer", keyword: "Videographer", needles: ["videographer", "video director", "filmmaker"] },
  { category: "Videographer", keyword: "Director", needles: ["film director", "commercial director", "music video director", " director"] },
  { category: "MUA", keyword: "Makeup Artist", needles: ["makeup artist", "make up artist", "make-up artist", "mua", "makeup", "make up", "make-up"] },
  { category: "MUA", keyword: "Hair Stylist", needles: ["hair stylist", "hairstylist", "hair artist", "hairdresser"] },
  { category: "Stylist", keyword: "Stylist", needles: ["stylist", "styling", "wardrobe", "fashion editor"] },
  { category: "Set Designer", keyword: "Set Designer", needles: ["set designer", "set design", "production designer", "production design", "prop stylist", "props"] },
  { category: "Producer", keyword: "Producer", needles: ["producer", "production company", "line producer", "exec producer"] },
  { category: "Model", keyword: "Model", needles: ["model", "signed to", "@models"] },
  { category: "Editor", keyword: "Retoucher", needles: ["retoucher", "retouch", "retouching"] },
  { category: "Editor", keyword: "Editor", needles: ["editor", "editing", "post production", "post-production"] },
  { category: "Colorist", keyword: "Colourist", needles: ["colourist", "colorist", "colour grade", "color grade", "grading"] },
  { category: "Other", keyword: "Sound", needles: ["sound design", "sound designer", "sound recordist", "audio engineer", "composer"] },
  { category: "Other", keyword: "Gaffer", needles: ["gaffer", "lighting technician"] },
  { category: "Other", keyword: "Grip", needles: ["key grip", " grip ", "grip department"] },
]

export interface CreativeRoleMatch {
  category: string // canonical directory category
  keyword: string // the human-readable role that matched (for the reference note)
}

// Detects whether a bio / name mentions a creative crew role. Returns the first
// (most specific) match, or null. Powers the network scan's bio filter.
export function detectCreativeRole(text: string | null | undefined): CreativeRoleMatch | null {
  if (!text) return null
  const lower = ` ${text.toLowerCase()} `
  for (const { category, keyword, needles } of CREATIVE_ROLE_KEYWORDS) {
    if (needles.some((n) => lower.includes(n))) return { category, keyword }
  }
  return null
}

// Pulls a likely location out of a bio. Looks for "based in X" / "X | London"
// style phrases and known city names; returns the first match or null.
const CITY_HINTS = [
  "London", "Paris", "New York", "NYC", "LA", "Los Angeles", "Milan", "Berlin",
  "Manchester", "Glasgow", "Edinburgh", "Tokyo", "Sydney", "Melbourne", "Toronto",
  "Amsterdam", "Copenhagen", "Barcelona", "Madrid", "Dublin", "Lisbon", "Stockholm",
]
export function locationFromBio(bio: string | null | undefined): string | null {
  if (!bio) return null
  const based = bio.match(/based in\s+([A-Z][A-Za-z .'-]{2,30})/i)
  if (based) return based[1].trim().replace(/[.,]$/, "")
  for (const city of CITY_HINTS) {
    const re = new RegExp(`(^|[^a-z])${city}([^a-z]|$)`, "i")
    if (re.test(bio)) return city
  }
  return null
}

// All @handles mentioned in a chunk of text.
export function extractMentions(text: string | null | undefined): string[] {
  if (!text) return []
  const out = new Set<string>()
  const re = /@([a-zA-Z0-9._]{2,30})/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const h = m[1].toLowerCase().replace(/\.$/, "")
    if (h.length >= 2) out.add(h)
  }
  return [...out]
}

// ── Number parsing ("1.2M", "12.3k", "1,234") ─────────────────────────────────
export function parseCount(raw: string | null | undefined): number | null {
  if (!raw) return null
  const s = raw.trim().replace(/,/g, "")
  const m = s.match(/([\d.]+)\s*([kmb])?/i)
  if (!m) return null
  const n = parseFloat(m[1])
  if (!Number.isFinite(n)) return null
  const suffix = (m[2] || "").toLowerCase()
  const mult = suffix === "k" ? 1e3 : suffix === "m" ? 1e6 : suffix === "b" ? 1e9 : 1
  return Math.round(n * mult)
}

// ── HTML extraction helpers ───────────────────────────────────────────────────
function metaContent(html: string, property: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']*)["']`,
    "i"
  )
  const m = html.match(re)
  if (m) return decodeEntities(m[1])
  // attribute order can be reversed
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${property}["']`,
    "i"
  )
  const m2 = html.match(re2)
  return m2 ? decodeEntities(m2[1]) : null
}

function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\\u0040/g, "@")
    .replace(/\\n/g, "\n")
}

// og:description for a profile looks like:
//   "12.3k Followers, 456 Following, 78 Posts - Name (@handle) on Instagram: \"bio…\""
// or "... - See Instagram photos and videos from Name (@handle)"
function parseOgDescription(desc: string | null): {
  followers: number | null
  bio: string | null
} {
  if (!desc) return { followers: null, bio: null }
  const followersMatch = desc.match(/([\d.,]+\s*[kmb]?)\s+Followers/i)
  const followers = followersMatch ? parseCount(followersMatch[1]) : null
  // Bio sometimes sits after a colon at the end: ... on Instagram: "the bio"
  let bio: string | null = null
  const bioMatch = desc.match(/Instagram:\s*[""“]([\s\S]+?)[""”]\s*$/)
  if (bioMatch) bio = bioMatch[1].trim()
  return { followers, bio }
}

function nameFromOgTitle(title: string | null): string | null {
  if (!title) return null
  // "Name (@handle) • Instagram photos and videos"
  const m = title.match(/^(.+?)\s*\(@/)
  if (m) return m[1].trim()
  const m2 = title.split("•")[0].split("(")[0].trim()
  return m2 || null
}

// Tries to pull richer fields out of any embedded JSON in the page.
function fromEmbeddedJson(html: string): Partial<ScanProfileResult> {
  const out: Partial<ScanProfileResult> = {}
  const grab = (key: string): string | null => {
    const re = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`)
    const m = html.match(re)
    return m ? decodeEntities(m[1]).replace(/\\\//g, "/") : null
  }
  const bio = grab("biography")
  if (bio) out.bio = bio
  const pic = grab("profile_pic_url_hd") || grab("profile_pic_url")
  if (pic) out.profilePic = pic
  const fullName = grab("full_name")
  if (fullName) out.name = fullName
  const website = grab("external_url")
  if (website) out.website = website
  const followersM = html.match(/"edge_followed_by"\s*:\s*\{\s*"count"\s*:\s*(\d+)/)
  if (followersM) out.followers = parseInt(followersM[1], 10)
  return out
}

// ── Profile scan ──────────────────────────────────────────────────────────────
async function tryFetchText(url: string): Promise<string | null> {
  try {
    const res = await rateLimitedFetch(url)
    if (!res.ok) {
      logger.warn("instagram-scan", `Fetch ${url} → ${res.status}`)
      return null
    }
    return await res.text()
  } catch (err) {
    logger.warn("instagram-scan", `Fetch ${url} failed`, err)
    return null
  }
}

// Computes the confidence for a scanned profile from the signals we found.
function profileConfidence(opts: {
  bioCategory: string | null
  hasName: boolean
  hasFollowers: boolean
}): Confidence {
  if (opts.bioCategory && (opts.hasName || opts.hasFollowers)) return "LIKELY"
  if (opts.hasName || opts.hasFollowers) return "UNVERIFIED"
  return "UNVERIFIED"
}

export async function scanProfile(handleInput: string): Promise<ScanProfileResult> {
  const handle = normalizeHandle(handleInput)
  if (!handle) {
    return blankProfile(handleInput, "Invalid Instagram handle")
  }

  const result: ScanProfileResult = {
    handle,
    name: null,
    bio: null,
    followers: null,
    profilePic: null,
    website: null,
    category: null,
    location: null,
    confidence: "UNVERIFIED",
    taggedAccounts: [],
    recentPosts: [],
    source: "none",
    ok: false,
  }

  // 1) Public profile HTML — richest source when it isn't blocked.
  const profileHtml = await tryFetchText(`https://www.instagram.com/${handle}/`)
  if (profileHtml) {
    const ogTitle = metaContent(profileHtml, "og:title")
    const ogDesc = metaContent(profileHtml, "og:description")
    const ogImage = metaContent(profileHtml, "og:image")
    const { followers, bio } = parseOgDescription(ogDesc)
    const json = fromEmbeddedJson(profileHtml)
    result.name = json.name ?? nameFromOgTitle(ogTitle)
    result.bio = json.bio ?? bio
    result.followers = json.followers ?? followers
    result.profilePic = json.profilePic ?? ogImage
    result.website = json.website ?? null
    if (result.name || result.followers || result.bio) {
      result.source = "html"
      result.ok = true
    }
  }

  // 2) Embed endpoint — reliable fallback for name + profile pic.
  if (!result.ok || !result.profilePic) {
    const embedHtml = await tryFetchText(`https://www.instagram.com/${handle}/embed/`)
    if (embedHtml) {
      const json = fromEmbeddedJson(embedHtml)
      result.name = result.name ?? json.name ?? null
      result.bio = result.bio ?? json.bio ?? null
      result.profilePic = result.profilePic ?? json.profilePic ?? null
      result.followers = result.followers ?? json.followers ?? null
      if (!result.ok && (result.name || result.profilePic)) {
        result.source = "embed"
        result.ok = true
      }
    }
  }

  // 3) ?__a=1 JSON — usually blocked, but free signal if it works.
  if (!result.ok) {
    const jsonText = await tryFetchText(
      `https://www.instagram.com/${handle}/?__a=1&__d=dis`
    )
    if (jsonText && jsonText.trim().startsWith("{")) {
      try {
        const data = JSON.parse(jsonText)
        const u = data?.graphql?.user ?? data?.user
        if (u) {
          result.name = u.full_name || result.name
          result.bio = u.biography || result.bio
          result.followers = u.edge_followed_by?.count ?? result.followers
          result.profilePic = u.profile_pic_url_hd || u.profile_pic_url || result.profilePic
          result.website = u.external_url || result.website
          result.source = "json"
          result.ok = true
        }
      } catch {
        /* not JSON — ignore */
      }
    }
  }

  if (!result.ok) {
    return blankProfile(handle, "Couldn't access this profile")
  }

  // Derive category / location / tagged accounts from whatever we scraped.
  result.category = categoryFromText(result.bio) ?? categoryFromText(result.name)
  result.location = locationFromBio(result.bio)
  result.taggedAccounts = extractMentions(result.bio).filter((h) => h !== handle)
  result.confidence = profileConfidence({
    bioCategory: result.category,
    hasName: Boolean(result.name),
    hasFollowers: result.followers != null,
  })

  return result
}

function blankProfile(handle: string, error: string): ScanProfileResult {
  return {
    handle: normalizeHandle(handle) ?? String(handle),
    name: null,
    bio: null,
    followers: null,
    profilePic: null,
    website: null,
    category: null,
    location: null,
    confidence: "UNVERIFIED",
    taggedAccounts: [],
    recentPosts: [],
    source: "none",
    ok: false,
    error,
  }
}

// ── Credit parsing ────────────────────────────────────────────────────────────
// Each role lists regexes whose first capture group is the credited @handle.
const CREDIT_PATTERNS: { role: string; category: string; res: RegExp[] }[] = [
  {
    role: "Photography",
    category: "Photographer",
    res: [
      /(?:photography|photographer|photo|shot)\s*(?:by|[:\-–])\s*@([a-z0-9._]{2,30})/gi,
      /📸\s*@([a-z0-9._]{2,30})/gi,
      /📷\s*@([a-z0-9._]{2,30})/gi,
    ],
  },
  {
    role: "Styling",
    category: "Stylist",
    res: [/(?:styling|stylist|styled|wardrobe)\s*(?:by|[:\-–])\s*@([a-z0-9._]{2,30})/gi],
  },
  {
    role: "Hair",
    category: "MUA",
    res: [/hair\s*(?:by|stylist|styling|[:\-–])\s*@([a-z0-9._]{2,30})/gi],
  },
  {
    role: "Makeup",
    category: "MUA",
    res: [/(?:makeup|make\s?up|make-up|mua|beauty)\s*(?:by|artist|[:\-–])\s*@([a-z0-9._]{2,30})/gi],
  },
  {
    role: "Grooming",
    category: "MUA",
    res: [/(?:grooming|groomer|groomed)\s*(?:by|[:\-–])\s*@([a-z0-9._]{2,30})/gi],
  },
  {
    role: "Creative Direction",
    category: "Creative Director",
    res: [/(?:creative\s*direction|creative\s*director|art\s*direction|art\s*director|cd|ecd)\s*(?:by|[:\-–])\s*@([a-z0-9._]{2,30})/gi],
  },
  {
    role: "Video",
    category: "Videographer",
    res: [/(?:video|videographer|director|directed|film|filmed|dop|d\.o\.p|cinematography|cinematographer|motion)\s*(?:by|[:\-–])\s*@([a-z0-9._]{2,30})/gi],
  },
  {
    role: "Editing",
    category: "Editor",
    res: [/(?:edited|editor|edit|post\s*production|post-production)\s*(?:by|[:\-–])\s*@([a-z0-9._]{2,30})/gi],
  },
  {
    role: "Colour",
    category: "Colorist",
    res: [/(?:colour|color|colourist|colorist|grade|grading|graded)\s*(?:by|[:\-–])\s*@([a-z0-9._]{2,30})/gi],
  },
  {
    role: "Sound",
    category: "Other",
    res: [/(?:sound|audio|music)\s*(?:by|design|[:\-–])\s*@([a-z0-9._]{2,30})/gi],
  },
  {
    role: "Set Design",
    category: "Set Designer",
    res: [/(?:set\s*design|set\s*designer|props|prop\s*stylist|set\s*build|production\s*design|production\s*designer)\s*(?:by|[:\-–])\s*@([a-z0-9._]{2,30})/gi],
  },
  {
    role: "Casting",
    category: "Casting Director",
    res: [/casting\s*(?:by|director|[:\-–])\s*@([a-z0-9._]{2,30})/gi],
  },
  {
    role: "Production",
    category: "Producer",
    res: [/(?:produced|producer|production)\s*(?:by|[:\-–])\s*@([a-z0-9._]{2,30})/gi],
  },
  {
    role: "Talent",
    category: "Model",
    res: [/(?:talent|model|modelled\s*by|modeled\s*by|wearing|featuring)\s*(?:by|[:\-–])?\s*@([a-z0-9._]{2,30})/gi],
  },
]

interface ParsedPost {
  shortcode: string
  caption: string
}

// Parses an array of post captions for crew credits and co-mentions.
export function parseCredits(
  posts: ParsedPost[],
  selfHandle: string
): { credits: CreditPerson[]; collaborationPairs: CollaborationPair[] } {
  const map = new Map<string, CreditPerson>()
  const pairCounts = new Map<string, number>()

  const ensure = (handle: string): CreditPerson => {
    let p = map.get(handle)
    if (!p) {
      p = {
        handle,
        role: null,
        category: null,
        mentionCount: 0,
        posts: [],
        confidence: "UNVERIFIED",
        tier: "social", // default; promoted to "credited" if a role pattern hits
      }
      map.set(handle, p)
    }
    return p
  }

  for (const post of posts) {
    const caption = post.caption || ""
    const seenThisPost = new Set<string>()

    // Role-tagged credits (strong signal).
    for (const { role, category, res } of CREDIT_PATTERNS) {
      for (const re of res) {
        re.lastIndex = 0
        let m: RegExpExecArray | null
        while ((m = re.exec(caption)) !== null) {
          const h = m[1].toLowerCase().replace(/\.$/, "")
          if (h === selfHandle || h.length < 2) continue
          const p = ensure(h)
          // Explicit role in the caption → Tier 1 (credited).
          p.tier = "credited"
          if (!p.role) {
            p.role = role
            p.category = category
          }
          if (!seenThisPost.has(h)) {
            p.mentionCount++
            if (post.shortcode) p.posts.push(post.shortcode)
            seenThisPost.add(h)
          }
        }
      }
    }

    // Generic @mentions (weak signal) — still counts toward collaboration.
    for (const h of extractMentions(caption)) {
      if (h === selfHandle) continue
      const p = ensure(h)
      if (!seenThisPost.has(h)) {
        p.mentionCount++
        if (post.shortcode) p.posts.push(post.shortcode)
        seenThisPost.add(h)
      }
    }

    // Anyone co-mentioned on the same post has collaborated.
    const co = [...seenThisPost].sort()
    for (let i = 0; i < co.length; i++) {
      for (let j = i + 1; j < co.length; j++) {
        const key = `${co[i]}|${co[j]}`
        pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1)
      }
    }
  }

  // Confidence follows the tier, NOT the raw mention count — a friend @-tagged
  // three times is still a social mention, not a crew credit. Bio verification
  // (finalizeCredits) may later promote a "social" person to "likely".
  for (const p of map.values()) {
    p.confidence = p.tier === "credited" ? "VERIFIED" : "UNVERIFIED"
  }

  const credits = [...map.values()].sort(
    (a, b) => b.mentionCount - a.mentionCount || a.handle.localeCompare(b.handle)
  )
  const collaborationPairs: CollaborationPair[] = [...pairCounts.entries()].map(
    ([key, count]) => {
      const [a, b] = key.split("|")
      return { a, b, count }
    }
  )

  return { credits, collaborationPairs }
}

// Looks up bios for a set of handles so mentions can be bio-verified (Tier 2).
// Returns a map of normalised handle → bio text (or null when unknown). Callers
// supply the actual fetch strategy (Apify batch, direct scrape, …).
export type BioLookup = (handles: string[]) => Promise<Map<string, string | null>>

// Splits raw parsed credits into the two buckets the directory cares about:
//   • credits        — Tier 1 (explicit caption role) + Tier 2 (bio-verified)
//   • socialMentions — Tier 3 (no role, no matching bio) — excluded from Add All
// `bios` maps handle → bio text for the mentions we were able to look up.
export function finalizeCredits(
  raw: CreditPerson[],
  bios: Map<string, string | null>
): { credits: CreditPerson[]; socialMentions: CreditPerson[] } {
  const credits: CreditPerson[] = []
  const socialMentions: CreditPerson[] = []

  for (const p of raw) {
    if (p.tier === "credited") {
      credits.push(p)
      continue
    }
    // No caption role — try to verify via their bio (Tier 2).
    const bio = bios.get(p.handle)
    const bioCategory = categoryFromText(bio)
    if (bioCategory) {
      p.tier = "likely"
      p.confidence = "LIKELY"
      p.category = bioCategory
      if (!p.role) p.role = bioCategory
      p.bioMatched = true
      credits.push(p)
    } else {
      // Tier 3 — a friend, brand, venue, or random mention. Keep it out of the
      // directory, but surface it separately so a user can opt in explicitly.
      p.tier = "social"
      p.confidence = "UNVERIFIED"
      socialMentions.push(p)
    }
  }

  const byMentions = (a: CreditPerson, b: CreditPerson) =>
    b.mentionCount - a.mentionCount || a.handle.localeCompare(b.handle)
  credits.sort(byMentions)
  socialMentions.sort(byMentions)
  return { credits, socialMentions }
}

// Scrapes the bios of `handles` directly (rate-limited), capped so a caption
// full of mentions can't fan out into dozens of blocking scrapes. Used as the
// bio-lookup strategy for the direct (non-Apify) credits scan.
const DIRECT_BIO_LOOKUP_CAP = 6
export async function directProfileBios(handles: string[]): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>()
  const unique = [...new Set(handles.map((h) => normalizeHandle(h)).filter(Boolean) as string[])]
  const limited = unique.slice(0, DIRECT_BIO_LOOKUP_CAP)
  if (unique.length > limited.length) {
    logger.info(
      "instagram-scan",
      `Bio-verifying ${limited.length}/${unique.length} mentions (cap ${DIRECT_BIO_LOOKUP_CAP}); the rest stay unverified`
    )
  }
  for (const h of limited) {
    const p = await scanProfile(h)
    out.set(h, p.ok ? p.bio : null)
  }
  return out
}

// Extracts recent post captions from a profile's HTML, if Instagram embedded
// any timeline JSON. Best-effort — returns [] when the page is locked down.
function extractPostsFromHtml(html: string): ParsedPost[] {
  const posts: ParsedPost[] = []
  // edge_owner_to_timeline_media → edges[] → node{ shortcode, edge_media_to_caption }
  const captionRe =
    /"shortcode"\s*:\s*"([^"]+)"[\s\S]{0,400}?"edge_media_to_caption"\s*:\s*\{\s*"edges"\s*:\s*\[\s*\{\s*"node"\s*:\s*\{\s*"text"\s*:\s*"((?:[^"\\]|\\.)*)"/g
  let m: RegExpExecArray | null
  while ((m = captionRe.exec(html)) !== null && posts.length < 24) {
    posts.push({ shortcode: m[1], caption: decodeEntities(m[2]) })
  }
  // Fallback: any caption text blocks at all.
  if (posts.length === 0) {
    const altRe = /"edge_media_to_caption"\s*:\s*\{\s*"edges"\s*:\s*\[\s*\{\s*"node"\s*:\s*\{\s*"text"\s*:\s*"((?:[^"\\]|\\.)*)"/g
    let i = 0
    while ((m = altRe.exec(html)) !== null && posts.length < 24) {
      posts.push({ shortcode: `post-${i++}`, caption: decodeEntities(m[1]) })
    }
  }
  return posts
}

export async function scanCredits(handleInput: string): Promise<ScanCreditsResult> {
  const handle = normalizeHandle(handleInput)
  if (!handle) {
    return { handle: String(handleInput), credits: [], socialMentions: [], collaborationPairs: [], postsScanned: 0, ok: false, error: "Invalid Instagram handle" }
  }

  let posts: ParsedPost[] = []

  // Profile HTML is the most likely place to find embedded captions.
  const profileHtml = await tryFetchText(`https://www.instagram.com/${handle}/`)
  if (profileHtml) posts = extractPostsFromHtml(profileHtml)

  // Fall back to harvesting mentions from the bio so the feature shows something.
  if (posts.length === 0 && profileHtml) {
    const bio =
      fromEmbeddedJson(profileHtml).bio ??
      parseOgDescription(metaContent(profileHtml, "og:description")).bio
    if (bio) posts = [{ shortcode: "bio", caption: bio }]
  }

  if (posts.length === 0) {
    return {
      handle,
      credits: [],
      socialMentions: [],
      collaborationPairs: [],
      postsScanned: 0,
      ok: false,
      error: "Couldn't read this profile's posts — Instagram may be blocking access.",
    }
  }

  const { credits: raw, collaborationPairs } = parseCredits(posts, handle)
  // Bio-verify the non-credited mentions before deciding who's a real credit.
  const candidates = raw.filter((p) => p.tier !== "credited").map((p) => p.handle)
  const bios = candidates.length ? await directProfileBios(candidates) : new Map<string, string | null>()
  const { credits, socialMentions } = finalizeCredits(raw, bios)
  return {
    handle,
    credits,
    socialMentions,
    collaborationPairs,
    postsScanned: posts.length,
    ok: true,
  }
}

// Canonicalises a free-text category to the directory's known list.
export function canonicalCategory(raw: string | null | undefined): string {
  if (!raw) return "Other"
  const lower = raw.trim().toLowerCase()
  const exact = CONTACT_CATEGORIES.find((c) => c.toLowerCase() === lower)
  if (exact) return exact
  const partial = CONTACT_CATEGORIES.find(
    (c) => lower.includes(c.toLowerCase()) || c.toLowerCase().includes(lower)
  )
  return partial ?? "Other"
}
