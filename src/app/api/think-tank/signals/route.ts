import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category') || ''
  const categories = searchParams.get('categories') || ''
  const source = searchParams.get('source') || ''
  const trending = searchParams.get('trending')
  const flagged = searchParams.get('flagged')
  const search = searchParams.get('search') || ''
  const fromIso = searchParams.get('from') || ''
  const toIso = searchParams.get('to') || ''
  const limitParam = parseInt(searchParams.get('limit') || '100', 10)
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 500) : 100

  const where: Prisma.TrendSignalWhereInput = {}

  if (categories) {
    const list = categories.split(',').map((c) => c.trim()).filter(Boolean)
    if (list.length) where.category = { in: list }
  } else if (category && category !== 'all') {
    where.category = category
  }

  if (source) where.source = source
  if (trending === 'true') where.trending = true
  if (flagged === 'true') where.flagged = true

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { summary: { contains: search, mode: 'insensitive' } },
    ]
  }

  if (fromIso || toIso) {
    where.createdAt = {}
    if (fromIso) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(fromIso)
    if (toIso) (where.createdAt as Prisma.DateTimeFilter).lte = new Date(toIso)
  }

  const signals = await prisma.trendSignal.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  return NextResponse.json(signals)
}
