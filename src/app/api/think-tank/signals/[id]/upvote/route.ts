import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const signal = await prisma.trendSignal.update({
      where: { id },
      data: { upvotes: { increment: 1 } },
    })
    return NextResponse.json(signal)
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
