import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/auth'

export const GET = withAuth(async () => {
  const brands = await prisma.brandWatch.findMany({
    orderBy: [{ heatScore: 'desc' }, { updatedAt: 'desc' }],
  })
  return NextResponse.json(brands)
})

export const POST = withAuth(async (request: NextRequest) => {
  const body = await request.json().catch(() => ({}))
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const keywordsRaw = body.keywords
  let keywords: string[] = []
  if (Array.isArray(keywordsRaw)) {
    keywords = keywordsRaw.filter((k): k is string => typeof k === 'string').map((k) => k.trim()).filter(Boolean)
  } else if (typeof keywordsRaw === 'string') {
    keywords = keywordsRaw.split(',').map((k) => k.trim()).filter(Boolean)
  }

  const brand = await prisma.brandWatch.create({
    data: {
      name,
      category: body.category || null,
      description: body.description || null,
      logoUrl: body.logoUrl || null,
      keywords,
      notes: body.notes || null,
    },
  })

  return NextResponse.json(brand, { status: 201 })
})
