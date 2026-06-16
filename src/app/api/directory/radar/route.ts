import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/auth'
import { validateRequired, sanitizeString } from '@/lib/validate'
import { isRadarStatus } from '@/lib/directory'

// GET /api/directory/radar — emerging talent / accounts the team is tracking.
export const GET = withAuth(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') || ''
  const status = searchParams.get('status') || ''

  const entries = await prisma.contact.findMany({
    where: {
      isRadar: true,
      ...(status && isRadarStatus(status) ? { radarStatus: status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { radarLink: { contains: search, mode: 'insensitive' } },
              { instagram: { contains: search, mode: 'insensitive' } },
              { category: { contains: search, mode: 'insensitive' } },
              { notes: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    include: { creator: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(entries)
})

// POST /api/directory/radar — add a "one to watch" (a Contact with isRadar set).
export const POST = withAuth(async (request: NextRequest, _ctx, user) => {
  const body = await request.json()

  const missing = validateRequired(body, ['name'])
  if (missing) return NextResponse.json({ error: missing }, { status: 400 })

  const status =
    body.radarStatus && isRadarStatus(body.radarStatus) ? body.radarStatus : 'WATCHING'

  const entry = await prisma.contact.create({
    data: {
      name: sanitizeString(body.name, 200),
      category: body.category ? sanitizeString(body.category, 80) : 'Talent',
      radarLink: body.radarLink ? sanitizeString(body.radarLink, 300) : null,
      instagram: body.instagram ? sanitizeString(body.instagram, 120) : null,
      location: body.location ? sanitizeString(body.location, 160) : null,
      notes: body.notes ? sanitizeString(body.notes, 4000) : null,
      tags: Array.isArray(body.tags) ? body.tags.map((t: unknown) => String(t)).slice(0, 30) : [],
      isRadar: true,
      radarStatus: status,
      createdBy: user.userId,
    },
    include: { creator: { select: { id: true, name: true } } },
  })

  return NextResponse.json(entry, { status: 201 })
})
