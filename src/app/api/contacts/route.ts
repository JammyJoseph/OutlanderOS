import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/auth'
import { validateRequired, sanitizeString, validateEmail } from '@/lib/validate'

export const GET = withAuth(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') || ''
  const category = searchParams.get('category') || ''
  const categories = searchParams.get('categories') || ''
  const radar = searchParams.get('radar') // "true" | "false" | null

  const categoryFilter = categories
    ? { category: { in: categories.split(',').map((c) => c.trim()).filter(Boolean) } }
    : category && category !== 'all'
    ? { category }
    : {}

  // radar omitted → all; "true" → radar only; anything else → directory only.
  const radarFilter =
    radar === 'true' ? { isRadar: true } : radar === 'false' ? { isRadar: false } : {}

  const contacts = await prisma.contact.findMany({
    where: {
      AND: [
        search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { company: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { role: { contains: search, mode: 'insensitive' } },
                { instagram: { contains: search, mode: 'insensitive' } },
                { location: { contains: search, mode: 'insensitive' } },
                { notes: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {},
        categoryFilter,
        radarFilter,
      ],
    },
    include: { creator: { select: { id: true, name: true } } },
    orderBy: { updatedAt: 'desc' },
  })

  return NextResponse.json(contacts)
})

function parseRating(value: unknown): number | null {
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return Math.min(5, Math.max(1, Math.round(n)))
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
      notes: body.notes ? sanitizeString(body.notes, 4000) : null,
      isRadar: Boolean(body.isRadar),
      radarStatus: body.radarStatus ? sanitizeString(body.radarStatus, 40) : null,
      radarLink: body.radarLink ? sanitizeString(body.radarLink, 300) : null,
      createdBy: user.userId,
    },
    include: { creator: { select: { id: true, name: true } } },
  })

  return NextResponse.json(contact, { status: 201 })
})
