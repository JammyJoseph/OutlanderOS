import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/auth'

export const POST = withAuth(async (_: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const existing = await prisma.trendSignal.findUnique({ where: { id }, select: { flagged: true } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const signal = await prisma.trendSignal.update({
    where: { id },
    data: { flagged: !existing.flagged },
  })
  return NextResponse.json(signal)
})
