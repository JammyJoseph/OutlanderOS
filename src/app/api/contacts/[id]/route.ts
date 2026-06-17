import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/auth'
import { sanitizeString, validateEmail } from '@/lib/validate'
import { sanitizePortfolio } from '../route'

export interface Collaboration {
  productionId: string
  productionTitle: string
  role: string
  source: 'crew' | 'team'
}

// Finds productions this contact has worked on — linked crew (by contactId)
// plus team members matched by name or email.
async function collaborationsFor(contact: {
  id: string
  name: string
  email: string | null
}): Promise<Collaboration[]> {
  const [crew, team] = await Promise.all([
    prisma.productionCrew.findMany({
      where: { contactId: contact.id },
      include: { production: { select: { id: true, title: true } } },
    }),
    prisma.productionTeamMember.findMany({
      where: {
        OR: [
          { name: { equals: contact.name, mode: 'insensitive' } },
          ...(contact.email
            ? [{ email: { equals: contact.email, mode: 'insensitive' as const } }]
            : []),
        ],
      },
      include: { production: { select: { id: true, title: true } } },
    }),
  ])

  const seen = new Set<string>()
  const out: Collaboration[] = []
  for (const c of crew) {
    const key = `${c.production.id}|${c.role}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      productionId: c.production.id,
      productionTitle: c.production.title,
      role: c.role,
      source: 'crew',
    })
  }
  for (const t of team) {
    const key = `${t.production.id}|${t.role}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      productionId: t.production.id,
      productionTitle: t.production.title,
      role: t.role,
      source: 'team',
    })
  }
  return out
}

export const GET = withAuth(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params
  const contact = await prisma.contact.findUnique({
    where: { id },
    include: { creator: { select: { id: true, name: true } } },
  })
  if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const collaborations = await collaborationsFor(contact)
  return NextResponse.json({ ...contact, collaborations })
})

function parseRating(value: unknown): number | null {
  if (value === null) return null
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return Math.min(5, Math.max(1, Math.round(n)))
}

const updateContact = withAuth(async (
  request: NextRequest,
  { params }: { params?: Promise<Record<string, string>> }
) => {
  const { id } = (await params) ?? {}
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const body = await request.json()

  if (body.email && !validateEmail(body.email)) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
  }

  const contact = await prisma.contact.update({
    where: { id },
    data: {
      name: body.name !== undefined ? sanitizeString(body.name, 200) : undefined,
      email: body.email !== undefined ? (body.email || null) : undefined,
      phone: body.phone !== undefined ? (body.phone || null) : undefined,
      company: body.company !== undefined ? (body.company || null) : undefined,
      role: body.role !== undefined ? (body.role || null) : undefined,
      category: body.category !== undefined ? sanitizeString(body.category, 80) : undefined,
      tags: body.tags !== undefined
        ? (Array.isArray(body.tags) ? body.tags.map((t: unknown) => String(t)).slice(0, 30) : [])
        : undefined,
      instagram: body.instagram !== undefined ? (body.instagram || null) : undefined,
      website: body.website !== undefined ? (body.website || null) : undefined,
      location: body.location !== undefined ? (body.location || null) : undefined,
      rating: body.rating !== undefined ? parseRating(body.rating) : undefined,
      notes: body.notes !== undefined ? (body.notes === null ? null : sanitizeString(body.notes, 4000)) : undefined,
      portfolioLinks: body.portfolioLinks !== undefined ? sanitizePortfolio(body.portfolioLinks) : undefined,
      isRadar: body.isRadar !== undefined ? Boolean(body.isRadar) : undefined,
      radarStatus: body.radarStatus !== undefined ? (body.radarStatus || null) : undefined,
      radarLink: body.radarLink !== undefined ? (body.radarLink || null) : undefined,
      lastInteraction: body.lastInteraction ? new Date(body.lastInteraction) : undefined,
    },
    include: { creator: { select: { id: true, name: true } } },
  })
  return NextResponse.json(contact)
})

export const PUT = updateContact
export const PATCH = updateContact

export const DELETE = withAuth(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params
  await prisma.contact.delete({ where: { id } })
  return NextResponse.json({ success: true })
})
