import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/current-user'

export async function POST(request: NextRequest) {
  const me = getCurrentUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    await prisma.notification.updateMany({
      where: { userId: me.userId, read: false },
      data: { read: true },
    })
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}
