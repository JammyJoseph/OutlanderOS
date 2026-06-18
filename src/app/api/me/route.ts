import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/current-user'

const SELECT = {
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
  googleConnected: true,
  googleEmail: true,
  theme: true,
  createdAt: true,
} as const

export async function GET(request: NextRequest) {
  const me = getCurrentUser(request)
  if (!me) return NextResponse.json({ user: null }, { status: 401 })
  try {
    const user = await prisma.user.findUnique({
      where: { id: me.userId },
      select: SELECT,
    })
    return NextResponse.json({ user })
  } catch (e) {
    return NextResponse.json({ user: null, error: String(e) }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const me = getCurrentUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { name, department, avatarUrl, avatar, salary, holidayAllowance, role } = body

  const data: Record<string, unknown> = {}
  if (typeof name === 'string') data.name = name
  if (typeof department === 'string' || department === null) data.department = department
  if (typeof avatarUrl === 'string' || avatarUrl === null) data.avatarUrl = avatarUrl
  if (typeof avatar === 'string' || avatar === null) data.avatar = avatar

  if (me.role === 'ADMIN') {
    if (typeof salary === 'number' || salary === null) data.salary = salary
    if (typeof holidayAllowance === 'number') data.holidayAllowance = holidayAllowance
    if (role === 'ADMIN' || role === 'MEMBER') data.role = role
  }

  const user = await prisma.user.update({
    where: { id: me.userId },
    data,
    select: SELECT,
  })

  return NextResponse.json({ user })
}

// PATCH — lightweight preference updates (currently the theme toggle). Kept
// separate from PUT so a theme change never touches profile/admin fields.
export async function PATCH(request: NextRequest) {
  const me = getCurrentUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const data: Record<string, unknown> = {}

  if (body.theme === 'light' || body.theme === 'dark') data.theme = body.theme

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const user = await prisma.user.update({
    where: { id: me.userId },
    data,
    select: SELECT,
  })

  return NextResponse.json({ user })
}
