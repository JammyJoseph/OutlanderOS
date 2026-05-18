import { withErrorHandling } from "@/lib/api-error"
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/auth'
import { validateRequired, sanitizeString, validateEmail } from '@/lib/validate'

const GET__h = withAuth(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') || ''
  const category = searchParams.get('category') || ''
  const categories = searchParams.get('categories') || ''

  const categoryFilter = categories
    ? { category: { in: categories.split(',').map((c) => c.trim()).filter(Boolean) } }
    : category && category !== 'all'
    ? { category }
    : {}

  const contacts = await prisma.contact.findMany({
    where: {
      AND: [
        search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { company: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {},
        categoryFilter,
      ],
    },
    orderBy: { updatedAt: 'desc' },
  })

  return NextResponse.json(contacts)
})

const POST__h = withAuth(async (request: NextRequest, _ctx, user) => {
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
      tags: Array.isArray(body.tags) ? body.tags : [],
      instagram: body.instagram ? sanitizeString(body.instagram, 120) : null,
      website: body.website ? sanitizeString(body.website, 300) : null,
      notes: body.notes ? sanitizeString(body.notes, 4000) : null,
      createdBy: user.userId,
    },
  })

  return NextResponse.json(contact, { status: 201 })
})

export const GET = withErrorHandling(GET__h as any)
export const POST = withErrorHandling(POST__h as any)
