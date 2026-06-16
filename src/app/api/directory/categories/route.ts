import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/auth'
import { CONTACT_CATEGORIES } from '@/lib/directory'

// GET /api/directory/categories — the category catalogue with live counts
// (directory contacts only — radar entries are excluded).
export const GET = withAuth(async () => {
  const grouped = await prisma.contact.groupBy({
    by: ['category'],
    where: { isRadar: false },
    _count: { _all: true },
  })

  const counts = new Map<string, number>()
  for (const g of grouped) counts.set(g.category, g._count._all)

  // Known categories first (in canonical order), then any ad-hoc ones found.
  const known = CONTACT_CATEGORIES.map((category) => ({
    category,
    count: counts.get(category) ?? 0,
  }))
  const extras = [...counts.keys()]
    .filter((c) => !(CONTACT_CATEGORIES as readonly string[]).includes(c))
    .map((category) => ({ category, count: counts.get(category) ?? 0 }))

  const total = grouped.reduce((sum, g) => sum + g._count._all, 0)

  return NextResponse.json({ categories: [...known, ...extras], total })
})
