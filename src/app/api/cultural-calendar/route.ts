import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/auth'

export const GET = withAuth(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month')
  const category = searchParams.get('category')
  const categories = searchParams.get('categories')
  const importance = searchParams.get('importance')
  const search = searchParams.get('search') || ''
  const limit = searchParams.get('limit')
  const upcoming = searchParams.get('upcoming') === 'true'

  const where: Record<string, unknown> = {}

  if (month) {
    const [yearStr, monthStr] = month.split('-')
    const year = parseInt(yearStr, 10)
    const m = parseInt(monthStr, 10) - 1
    if (!Number.isNaN(year) && !Number.isNaN(m)) {
      const start = new Date(Date.UTC(year, m, 1))
      const end = new Date(Date.UTC(year, m + 1, 1))
      where.date = { gte: start, lt: end }
    }
  } else if (upcoming) {
    where.date = { gte: new Date() }
  }

  if (categories) {
    const list = categories.split(',').map((c) => c.trim()).filter(Boolean)
    if (list.length > 0) where.category = { in: list }
  } else if (category && category !== 'all') {
    where.category = category
  }

  if (importance) {
    const min = parseInt(importance, 10)
    if (!Number.isNaN(min)) where.importance = { gte: min }
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { location: { contains: search, mode: 'insensitive' } },
    ]
  }

  const events = await prisma.culturalEvent.findMany({
    where,
    orderBy: { date: 'asc' },
    take: limit ? parseInt(limit, 10) : undefined,
  })

  return NextResponse.json(events)
})

export const POST = withAuth(async (request: NextRequest) => {
  const body = await request.json()
  const { title, date, category } = body
  if (!title || !date || !category) {
    return NextResponse.json(
      { error: 'title, date, and category are required' },
      { status: 400 }
    )
  }

  const event = await prisma.culturalEvent.create({
    data: {
      title,
      date: new Date(date),
      endDate: body.endDate ? new Date(body.endDate) : null,
      category,
      subcategory: body.subcategory,
      location: body.location,
      description: body.description,
      source: body.source,
      sourceUrl: body.sourceUrl,
      importance: typeof body.importance === 'number' ? body.importance : 50,
      recurring: !!body.recurring,
      tags: Array.isArray(body.tags) ? body.tags : [],
    },
  })

  return NextResponse.json(event, { status: 201 })
})
