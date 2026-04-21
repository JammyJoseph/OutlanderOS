import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
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
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { name, email, phone, company, role, category, tags, instagram, website, notes, createdBy } = body

  if (!name || !category || !createdBy) {
    return NextResponse.json({ error: 'name, category, and createdBy are required' }, { status: 400 })
  }

  const contact = await prisma.contact.create({
    data: { name, email, phone, company, role, category, tags: tags || [], instagram, website, notes, createdBy },
  })

  return NextResponse.json(contact, { status: 201 })
}
