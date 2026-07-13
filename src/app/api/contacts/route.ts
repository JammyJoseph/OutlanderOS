import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/auth'
import { validateRequired, sanitizeString, validateEmail } from '@/lib/validate'
import { parsePagination, paginate } from '@/lib/pagination'

// Lean field projection for the directory list view (`?fields=list`). The 10
// fields the task calls for, plus a few cheap scalar columns the list/dashboard
// already depend on (createdAt for "Recently Added", location for the country
// filter, source/scannedAt for the "recently scanned" strip). Heavy JSON
// (recentPosts, collaborations, portfolioLinks) and long text (notes) are left
// to the per-contact detail fetch.
const LIST_SELECT = {
  id: true,
  name: true,
  instagram: true,
  category: true,
  profilePic: true,
  followers: true,
  printTier: true,
  isFavourite: true,
  archived: true,
  updatedAt: true,
  createdAt: true,
  location: true,
  source: true,
  scannedAt: true,
} as const

export const GET = withAuth(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') || ''
  const category = searchParams.get('category') || ''
  const categories = searchParams.get('categories') || ''
  const radar = searchParams.get('radar') // "true" | "false" | null
  const includeArchived = searchParams.get('includeArchived') === 'true'
  const hasPrintTier = searchParams.get('hasPrintTier') === 'true' // Print Directory view

  const categoryFilter = categories
    ? { category: { in: categories.split(',').map((c) => c.trim()).filter(Boolean) } }
    : category && category !== 'all'
    ? { category }
    : {}

  // radar omitted → all; "true" → radar only; anything else → directory only.
  const radarFilter =
    radar === 'true' ? { isRadar: true } : radar === 'false' ? { isRadar: false } : {}

  const where = {
    AND: [
      search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { company: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
              { role: { contains: search, mode: 'insensitive' as const } },
              { instagram: { contains: search, mode: 'insensitive' as const } },
              { location: { contains: search, mode: 'insensitive' as const } },
              { notes: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {},
      categoryFilter,
      radarFilter,
      // Print Directory view asks only for contacts filed into a tier.
      hasPrintTier ? { printTier: { not: null } } : {},
      // Archived contacts are hidden from the directory unless explicitly requested.
      includeArchived ? {} : { archived: false },
    ],
  }

  // `?fields=list` returns a lean projection for the directory's list view: just
  // enough to render + sort + filter rows, without the heavy JSON columns
  // (recentPosts, collaborations, portfolioLinks) or long text (notes). The
  // detail panel fetches the full record on click via /api/contacts/[id]. List
  // mode always returns every matching row — pagination is ignored — because the
  // directory loads the whole (small) contact set at once.
  const listMode = searchParams.get('fields') === 'list'

  // Pagination is opt-in: callers that pass `page`/`limit` get a page, everyone
  // else (pickers, dashboards) still gets the full list. List mode never
  // paginates. Either way the response uses the { data, total, page, pages } envelope.
  const isPaginated = !listMode && (searchParams.has('page') || searchParams.has('limit'))
  const { page, limit, skip } = parsePagination(searchParams, { defaultLimit: 50, maxLimit: 200 })

  const contactsQuery = listMode
    ? prisma.contact.findMany({
        where,
        select: LIST_SELECT,
        orderBy: { updatedAt: 'desc' },
      })
    : prisma.contact.findMany({
        where,
        include: { creator: { select: { id: true, name: true } } },
        orderBy: { updatedAt: 'desc' },
        ...(isPaginated ? { skip, take: limit } : {}),
      })

  const [contacts, total] = await Promise.all([contactsQuery, prisma.contact.count({ where })])

  return NextResponse.json(paginate(contacts, total, isPaginated ? page : 1, isPaginated ? limit : total || 1))
})

function parseRating(value: unknown): number | null {
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return Math.min(5, Math.max(1, Math.round(n)))
}

// Normalises a portfolio array into [{ title, url }] with sane caps.
export function sanitizePortfolio(value: unknown): { title: string; url: string }[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      const v = item as { title?: unknown; url?: unknown }
      return {
        title: sanitizeString(v?.title ?? '', 160),
        url: sanitizeString(v?.url ?? '', 500),
      }
    })
    .filter((x) => x.url)
    .slice(0, 30)
}

export const POST = withAuth(async (request: NextRequest, _ctx, user) => {
  const body = await request.json()

  const missing = validateRequired(body, ['name', 'category'])
  if (missing) return NextResponse.json({ error: missing }, { status: 400 })

  if (body.email && !validateEmail(body.email)) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
  }

  const contact = await prisma.contact.create({
    data: {
      name: sanitizeString(body.name, 200),
      email: body.email ? sanitizeString(body.email, 320) : null,
      phone: body.phone ? sanitizeString(body.phone, 50) : null,
      company: body.company ? sanitizeString(body.company, 200) : null,
      role: body.role ? sanitizeString(body.role, 120) : null,
      category: sanitizeString(body.category, 80),
      tags: Array.isArray(body.tags) ? body.tags.map((t: unknown) => String(t)).slice(0, 30) : [],
      instagram: body.instagram ? sanitizeString(body.instagram, 120) : null,
      website: body.website ? sanitizeString(body.website, 300) : null,
      location: body.location ? sanitizeString(body.location, 160) : null,
      rating: body.rating != null ? parseRating(body.rating) : null,
      isFavourite: Boolean(body.isFavourite),
      notes: body.notes ? sanitizeString(body.notes, 4000) : null,
      portfolioLinks: sanitizePortfolio(body.portfolioLinks),
      isRadar: Boolean(body.isRadar),
      radarStatus: body.radarStatus ? sanitizeString(body.radarStatus, 40) : null,
      radarLink: body.radarLink ? sanitizeString(body.radarLink, 300) : null,
      createdBy: user.userId,
    },
    include: { creator: { select: { id: true, name: true } } },
  })

  return NextResponse.json(contact, { status: 201 })
})
