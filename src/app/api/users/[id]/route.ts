import { withErrorHandling } from "@/lib/api-error"
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/current-user'

const ADMIN_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  avatarUrl: true,
  avatar: true,
  department: true,
  startDate: true,
  holidayAllowance: true,
  salary: true,
  createdAt: true,
} as const

async function GET__inner(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = getCurrentUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const isAdmin = me.role === 'ADMIN'

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      ...ADMIN_SELECT,
      salary: isAdmin || me.userId === id,
    },
  })

  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(user)
}

async function PUT__inner(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = getCurrentUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (me.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await request.json()
  const { name, department, avatarUrl, avatar, salary, holidayAllowance, role, startDate, email } = body

  const data: Record<string, unknown> = {}
  if (typeof name === 'string') data.name = name
  if (typeof email === 'string') data.email = email
  if (typeof department === 'string' || department === null) data.department = department
  if (typeof avatarUrl === 'string' || avatarUrl === null) data.avatarUrl = avatarUrl
  if (typeof avatar === 'string' || avatar === null) data.avatar = avatar
  if (typeof salary === 'number' || salary === null) data.salary = salary
  if (typeof holidayAllowance === 'number') data.holidayAllowance = holidayAllowance
  if (role === 'ADMIN' || role === 'MEMBER') data.role = role
  if (startDate === null) data.startDate = null
  else if (typeof startDate === 'string') data.startDate = new Date(startDate)

  const user = await prisma.user.update({
    where: { id },
    data,
    select: ADMIN_SELECT,
  })

  return NextResponse.json(user)
}

export const GET = withErrorHandling(GET__inner as any)
export const PUT = withErrorHandling(PUT__inner as any)
