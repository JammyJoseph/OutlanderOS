import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const brand = await prisma.brandWatch.findUnique({ where: { id } })
  if (!brand) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(brand)
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json().catch(() => ({}))

  let keywords: string[] | undefined
  if (Array.isArray(body.keywords)) {
    keywords = body.keywords.filter((k: unknown): k is string => typeof k === 'string').map((k: string) => k.trim()).filter(Boolean)
  } else if (typeof body.keywords === 'string') {
    keywords = body.keywords.split(',').map((k: string) => k.trim()).filter(Boolean)
  }

  const brand = await prisma.brandWatch.update({
    where: { id },
    data: {
      name: body.name,
      category: body.category,
      description: body.description,
      logoUrl: body.logoUrl,
      keywords,
      heatScore: typeof body.heatScore === 'number' ? body.heatScore : undefined,
      trajectory: body.trajectory,
      notes: body.notes,
      lastChecked: body.lastChecked ? new Date(body.lastChecked) : undefined,
    },
  })
  return NextResponse.json(brand)
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.brandWatch.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
