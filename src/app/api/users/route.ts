import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/current-user'

export async function GET(request: NextRequest) {
  const me = getCurrentUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isAdmin = me.role === 'ADMIN'

  const users = await prisma.user.findMany({
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
