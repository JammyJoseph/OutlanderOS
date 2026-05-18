import { withErrorHandling } from "@/lib/api-error"
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/auth'

const POST__h = withAuth(async (_: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
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
})

export const POST = withErrorHandling(POST__h as any)
