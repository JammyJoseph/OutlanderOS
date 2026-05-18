import { withErrorHandling } from "@/lib/api-error"
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/auth'

const GET__h = withAuth(async (_: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const event = await prisma.culturalEvent.findUnique({ where: { id } })
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(event)
})

const PUT__h = withAuth(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
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
})

const DELETE__h = withAuth(async (_: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  await prisma.culturalEvent.delete({ where: { id } })
  return NextResponse.json({ success: true })
})

export const GET = withErrorHandling(GET__h as any)
export const PUT = withErrorHandling(PUT__h as any)
export const DELETE = withErrorHandling(DELETE__h as any)
