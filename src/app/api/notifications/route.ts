import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/current-user'
import { isAdminInDb } from '@/lib/auth'
import { parsePagination, paginate } from '@/lib/pagination'

export async function GET(request: NextRequest) {
  const me = getCurrentUser(request)
  if (!me) return NextResponse.json({ data: [], total: 0, page: 1, pages: 1, unreadCount: 0 }, { status: 401 })

  try {
    const { searchParams } = new URL(request.url)
    const { page, limit, skip } = parsePagination(searchParams, { defaultLimit: 20, maxLimit: 100 })
    const where = { userId: me.userId }
    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId: me.userId, read: false } }),
    ])
    return NextResponse.json({ ...paginate(notifications, total, page, limit), unreadCount })
  } catch (e) {
    return NextResponse.json({ data: [], total: 0, page: 1, pages: 1, unreadCount: 0, error: "An error occurred" })
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
