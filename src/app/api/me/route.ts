import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/current-user'

export async function GET(request: NextRequest) {
  const me = getCurrentUser(request)
  if (!me) return NextResponse.json({ user: null }, { status: 401 })
  try {
    const user = await prisma.user.findUnique({
      where: { id: me.userId },
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
      },
    })
    return NextResponse.json({ user })
  } catch (e) {
    return NextResponse.json({ user: null, error: String(e) }, { status: 500 })
  }
}
