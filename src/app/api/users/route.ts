import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/current-user'
import { isAdminInDb } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const me = getCurrentUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // DB role, not JWT — the JWT role can be stale after a promotion.
  const isAdmin = await isAdminInDb(me)

  const users = await prisma.user.findMany({
    // Deactivated staff are only visible to admins.
    where: isAdmin ? {} : { isActive: true },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      avatarUrl: true,
      avatar: true,
      department: true,
      startDate: true,
      holidayAllowance: true,
      salary: isAdmin,
      createdAt: true,
    },
  })

  return NextResponse.json(users)
}
