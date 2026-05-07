import { XMLParser } from 'fast-xml-parser'
import prisma from '@/lib/prisma'

export interface FeedSource {
  name: string
  key: string
  url: string
}

export const FEED_SOURCES: FeedSource[] = [
  { name: 'Business of Fashion', key: 'rss:bof', url: 'https://www.businessoffashion.com/feed' },
  { name: 'Highsnobiety', key: 'rss:highsnobiety', url: 'https://www.highsnobiety.com/feed/' },
  { name: 'Hypebeast', key: 'rss:hypebeast', url: 'https://hypebeast.com/feed' },
  { name: 'Dezeen', key: 'rss:dezeen', url: 'https://www.dezeen.com/feed/' },
  { name: 'Dazed', key: 'rss:dazed', url: 'https://www.dazeddigital.com/rss' },
  { name: "It's Nice That", key: 'rss:itsnicethat', url: 'https://www.itsnicethat.com/rss/all' },
  { name: 'Wallpaper', key: 'rss:wallpaper', url: 'https://www.wallpaper.com/rss' },
]

export const CATEGORIES = [
  'fashion',
  'luxury',
  'culture',
  'food',
  'art',
  'music',
  'lifestyle',
  'tech',
] as const

export type Category = (typeof CATEGORIES)[number]

const CATEGORY_KEYWORDS: Record<Category, string[]> = {
  fashion: ['fashion', 'runway', 'collection', 'designer', 'couture', 'streetwear', 'sneaker', 'apparel', 'menswear', 'womenswear', 'stylist', 'gucci', 'prada', 'balenciaga', 'dior', 'chanel', 'nike', 'adidas'],
  luxury: ['luxury', 'lvmh', 'kering', 'hermès', 'hermes', 'cartier', 'rolex', 'patek', 'bentley', 'maserati', 'high-end'],
  culture: ['culture', 'subculture', 'nightlife', 'queer', 'youth', 'identity', 'protest', 'activism', 'community', 'zeitgeist'],
  food: ['food', 'restaurant', 'chef', 'cuisine', 'dining', 'cocktail', 'bar', 'menu', 'michelin', 'recipe'],
  art: ['art', 'gallery', 'museum', 'exhibition', 'artist', 'painting', 'sculpture', 'biennale', 'frieze', 'design', 'architecture'],
  music: ['music', 'album', 'single', 'song', 'concert', 'festival', 'dj', 'producer', 'rapper', 'band', 'spotify'],
  lifestyle: ['lifestyle', 'travel', 'wellness', 'beauty', 'skincare', 'fragrance', 'home', 'interior', 'hotel'],
  tech: ['tech', 'ai', 'startup', 'app', 'platform', 'web3', 'crypto', 'metaverse', 'nft', 'gadget', 'iphone', 'apple', 'google'],
}

function categorize(title: string, description: string): Category {
  const haystack = `${title} ${description}`.toLowerCase()
  let best: Category = 'culture'
  let bestScore = 0
  for (const cat of CATEGORIES) {
    let score = 0
    for (const kw of CATEGORY_KEYWORDS[cat]) {
      if (haystack.includes(kw)) score++
    }
    if (score > bestScore) {
      bestScore = score
      best = cat
    }
  }
  return best
}

function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

interface RssItem {
  title?: string | { '#text'?: string }
  link?: string | { '#text'?: string; '@_href'?: string }
  description?: string | { '#text'?: string }
  summary?: string | { '#text'?: string }
  content?: string | { '#text'?: string }
  'content:encoded'?: string
  pubDate?: string
  published?: string
  updated?: string
  guid?: string | { '#text'?: string }
  id?: string
  category?: string | string[] | Array<{ '#text'?: string; '@_term'?: string }>
}

function asString(v: unknown): string {
  if (typeof v === 'string') return v
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    if (typeof o['#text'] === 'string') return o['#text'] as string
    if (typeof o['@_href'] === 'string') return o['@_href'] as string
  }
  return ''
}

function extractItems(parsed: unknown): RssItem[] {
  const root = parsed as Record<string, unknown> | undefined
  if (!root) return []

  // RSS 2.0
  const rss = root.rss as Record<string, unknown> | undefined
  if (rss && typeof rss === 'object') {
    const channel = rss.channel as Record<string, unknown> | undefined
    if (channel) {
      const items = channel.item
      if (Array.isArray(items)) return items as RssItem[]
      if (items) return [items as RssItem]
    }
  }

  // Atom
  const feed = root.feed as Record<string, unknown> | undefined
  if (feed && typeof feed === 'object') {
    const entries = feed.entry
    if (Array.isArray(entries)) return entries as RssItem[]
    if (entries) return [entries as RssItem]
  }

  // RDF / RSS 1.0
  const rdf = root['rdf:RDF'] as Record<string, unknown> | undefined
  if (rdf) {
    const items = rdf.item
    if (Array.isArray(items)) return items as RssItem[]
    if (items) return [items as RssItem]
  }

  return []
}

export interface IngestResult {
  source: string
  fetched: number
  inserted: number
  skipped: number
  error?: string
}

export async function ingestFeed(source: FeedSource): Promise<IngestResult> {
  const result: IngestResult = {
    source: source.key,
    fetched: 0,
    inserted: 0,
    skipped: 0,
  }

  let xml: string
  try {
    const res = await fetch(source.url, {
      headers: {
        'User-Agent': 'OutlanderOS Think Tank/1.0 (+https://outlanderos.com)',
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml',
      },
      // 20s budget per feed
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) {
      result.error = `HTTP ${res.status}`
      return result
    }
    xml = await res.text()
  } catch (e) {
    result.error = e instanceof Error ? e.message : 'fetch failed'
    return result
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    cdataPropName: '#text',
    trimValues: true,
  })

  let parsed: unknown
  try {
    parsed = parser.parse(xml)
  } catch (e) {
    result.error = e instanceof Error ? `parse: ${e.message}` : 'parse failed'
    return result
  }

  const items = extractItems(parsed)
  result.fetched = items.length

  for (const item of items) {
    const title = stripHtml(asString(item.title)).slice(0, 500)
    if (!title) {
      result.skipped++
      continue
    }

    const link = stripHtml(asString(item.link)) || asString(item.id) || asString(item.guid)
    const description = stripHtml(
      asString(item.description) || asString(item.summary) || asString(item.content) || (item['content:encoded'] ?? '')
    )
    const pub = asString(item.pubDate) || asString(item.published) || asString(item.updated)
    const createdAt = pub ? new Date(pub) : new Date()

    if (link) {
      const existing = await prisma.trendSignal.findFirst({
        where: { sourceUrl: link },
        select: { id: true },
      })
      if (existing) {
        result.skipped++
        continue
      }
    }

    const category = categorize(title, description)
    const summary = description ? description.slice(0, 800) : null

    try {
      await prisma.trendSignal.create({
        data: {
          title,
          source: source.key,
          sourceUrl: link || null,
          category,
          summary,
          sentiment: null,
          relevance: 50,
          trending: false,
          tags: [],
          upvotes: 0,
          flagged: false,
          aiAnalysis: null,
          createdAt: Number.isFinite(createdAt.getTime()) ? createdAt : new Date(),
        },
      })
      result.inserted++
    } catch {
      result.skipped++
    }
  }

  return result
}

export async function ingestAllFeeds(): Promise<IngestResult[]> {
  const results = await Promise.all(FEED_SOURCES.map(ingestFeed))
  return results
}
