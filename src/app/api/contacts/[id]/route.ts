import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/auth'
import { sanitizeString, validateEmail } from '@/lib/validate'

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
  return NextResponse.json(contact)
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
