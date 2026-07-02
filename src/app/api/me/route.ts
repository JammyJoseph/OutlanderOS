import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/current-user'
import { isAdminInDb } from '@/lib/auth'

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
  teams: true,
  mustChangePassword: true,
  hasSeenWelcome: true,
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
    return NextResponse.json({ user: null, error: "An error occurred" }, { status: 500 })
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

  // Admin-gated fields check the DB role — the JWT role can be stale.
  if (await isAdminInDb(me)) {
    if (typeof salary === 'number' || salary === null) data.salary = salary
    if (typeof holidayAllowance === 'number') data.holidayAllowance = holidayAllowance
    // /me only ever updates the caller, so a role change away from ADMIN
    // would be a self-demotion — only allow confirming ADMIN here.
    if (role === 'ADMIN') data.role = role
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
  // One-time onboarding welcome screen — can only be marked seen, never unseen.
  if (body.hasSeenWelcome === true) data.hasSeenWelcome = true

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
