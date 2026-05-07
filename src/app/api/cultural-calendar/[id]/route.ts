import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const event = await prisma.culturalEvent.findUnique({ where: { id } })
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(event)
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const event = await prisma.culturalEvent.update({
    where: { id },
    data: {
      title: body.title,
      date: body.date ? new Date(body.date) : undefined,
      endDate: body.endDate ? new Date(body.endDate) : body.endDate === null ? null : undefined,
      category: body.category,
      subcategory: body.subcategory,
      location: body.location,
      description: body.description,
      source: body.source,
      sourceUrl: body.sourceUrl,
      importance: typeof body.importance === 'number' ? body.importance : undefined,
      recurring: typeof body.recurring === 'boolean' ? body.recurring : undefined,
      tags: Array.isArray(body.tags) ? body.tags : undefined,
    },
  })
  return NextResponse.json(event)
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.culturalEvent.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
