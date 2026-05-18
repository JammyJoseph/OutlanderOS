import { withErrorHandling } from "@/lib/api-error"
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/current-user'
import { businessDaysBetween } from '@/lib/holiday'

async function PUT__inner(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = getCurrentUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const { status } = body

  const existing = await prisma.holidayRequest.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (status === 'CANCELLED') {
    if (existing.userId !== me.userId && me.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (existing.status !== 'PENDING') {
      return NextResponse.json({ error: 'Only pending requests can be cancelled' }, { status: 400 })
    }
    const updated = await prisma.holidayRequest.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: {
        user: { select: { id: true, name: true, email: true, department: true, avatarUrl: true, avatar: true } },
      },
    })
    return NextResponse.json({ ...updated, days: businessDaysBetween(updated.startDate, updated.endDate) })
  }

  if (status !== 'APPROVED' && status !== 'REJECTED') {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }
  if (me.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const updated = await prisma.holidayRequest.update({
    where: { id },
    data: { status, approvedBy: me.userId },
    include: {
      user: { select: { id: true, name: true, email: true, department: true, avatarUrl: true, avatar: true } },
    },
  })

  const days = businessDaysBetween(updated.startDate, updated.endDate)
  await prisma.notification.create({
    data: {
      userId: existing.userId,
      type: status === 'APPROVED' ? 'holiday_approved' : 'holiday_rejected',
      message: `Your ${days}-day request from ${existing.startDate.toISOString().slice(0, 10)} was ${status.toLowerCase()}`,
      link: '/me/holiday',
    },
  })

  return NextResponse.json({ ...updated, days })
}

export const PUT = withErrorHandling(PUT__inner as any)
