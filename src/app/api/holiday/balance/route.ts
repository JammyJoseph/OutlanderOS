import { withErrorHandling } from "@/lib/api-error"
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/current-user'
import { businessDaysBetween } from '@/lib/holiday'

async function GET__inner(request: NextRequest) {
  const me = getCurrentUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: me.userId },
    select: { holidayAllowance: true },
  })
  const allowance = user?.holidayAllowance ?? 25

  const now = new Date()
  const yearStart = new Date(now.getFullYear(), 0, 1)
  const yearEnd = new Date(now.getFullYear() + 1, 0, 1)

  const requests = await prisma.holidayRequest.findMany({
    where: {
      userId: me.userId,
      startDate: { gte: yearStart, lt: yearEnd },
      status: { in: ['APPROVED', 'PENDING'] },
      type: 'ANNUAL',
    },
    select: { status: true, startDate: true, endDate: true },
  })

  let used = 0
  let pending = 0
  for (const r of requests) {
    const days = businessDaysBetween(r.startDate, r.endDate)
    if (r.status === 'APPROVED') used += days
    else if (r.status === 'PENDING') pending += days
  }

  return NextResponse.json({
    allowance,
    used,
    pending,
    remaining: allowance - used - pending,
    year: now.getFullYear(),
  })
}

export const GET = withErrorHandling(GET__inner as any)
