import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/current-user'
import { businessDaysBetween } from '@/lib/holiday'

const ALLOWED_TYPES = ['ANNUAL', 'SICK', 'PERSONAL', 'OTHER']

export async function GET(request: NextRequest) {
  const me = getCurrentUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const all = searchParams.get('all') === 'true'
  const status = searchParams.get('status')
  const isAdmin = me.role === 'ADMIN'

  const where: Record<string, unknown> = {}
  if (!(all && isAdmin)) where.userId = me.userId
  if (status) where.status = status

  const requests = await prisma.holidayRequest.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { id: true, name: true, email: true, department: true, avatarUrl: true, avatar: true } },
    },
  })

  const enriched = requests.map((r) => ({
    ...r,
    days: businessDaysBetween(r.startDate, r.endDate),
  }))

  return NextResponse.json(enriched)
}

export async function POST(request: NextRequest) {
  const me = getCurrentUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { startDate, endDate, type, notes } = body

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 })
  }
  const start = new Date(startDate)
  const end = new Date(endDate)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return NextResponse.json({ error: 'Invalid dates' }, { status: 400 })
  }
  if (end < start) {
    return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 })
  }

  const holidayType = ALLOWED_TYPES.includes(type) ? type : 'ANNUAL'
  const days = businessDaysBetween(start, end)

  const created = await prisma.holidayRequest.create({
    data: {
      userId: me.userId,
      startDate: start,
      endDate: end,
      type: holidayType,
      notes: typeof notes === 'string' && notes ? notes : null,
    },
    include: {
      user: { select: { id: true, name: true, email: true, department: true, avatarUrl: true, avatar: true } },
    },
  })

  const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } })
  if (admins.length > 0) {
    await prisma.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        type: 'holiday_request',
        message: `${me.name} requested ${days} day${days === 1 ? '' : 's'} off (${holidayType.toLowerCase()})`,
        link: '/me/holiday',
      })),
    })
  }

  return NextResponse.json({ ...created, days }, { status: 201 })
}
