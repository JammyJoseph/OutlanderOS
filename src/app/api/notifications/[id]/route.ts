import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/current-user'

// A member may only touch their own notifications; admins may touch any.
async function loadOwnedNotification(id: string, userId: string, isAdmin: boolean) {
  const notification = await prisma.notification.findUnique({ where: { id } })
  if (!notification) return { error: 'Not found', status: 404 as const }
  if (!isAdmin && notification.userId !== userId) {
    return { error: 'Forbidden', status: 403 as const }
  }
  return { notification }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = getCurrentUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const owned = await loadOwnedNotification(id, me.userId, me.role === 'ADMIN')
  if ('error' in owned) {
    return NextResponse.json({ error: owned.error }, { status: owned.status })
  }
  try {
    const notification = await prisma.notification.update({
      where: { id },
      data: { read: true },
    })
    return NextResponse.json({ notification })
  } catch (e) {
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = getCurrentUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const owned = await loadOwnedNotification(id, me.userId, me.role === 'ADMIN')
  if ('error' in owned) {
    return NextResponse.json({ error: owned.error }, { status: owned.status })
  }
  try {
    await prisma.notification.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}
