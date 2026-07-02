import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/current-user'
import { isAdminInDb } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const me = getCurrentUser(request)
  if (!me) return NextResponse.json({ notifications: [] }, { status: 401 })

  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: me.userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
    const unreadCount = await prisma.notification.count({
      where: { userId: me.userId, read: false },
    })
    return NextResponse.json({ notifications, unreadCount })
  } catch (e) {
    return NextResponse.json({ notifications: [], unreadCount: 0, error: "An error occurred" })
  }
}

export async function POST(request: NextRequest) {
  const me = getCurrentUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()
  if (!body.userId || !body.type || !body.message) {
    return NextResponse.json({ error: 'userId, type, message required' }, { status: 400 })
  }
  // Users can only create notifications for themselves; targeting another
  // user requires ADMIN (checked against the DB, not the stale JWT role).
  if (body.userId !== me.userId && !(await isAdminInDb(me))) {
    return NextResponse.json(
      { error: 'You can only create notifications for yourself' },
      { status: 403 }
    )
  }
  try {
    const notification = await prisma.notification.create({
      data: {
        userId: body.userId,
        type: body.type,
        message: body.message,
        link: body.link || null,
      },
    })
    return NextResponse.json({ notification })
  } catch (e) {
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}
