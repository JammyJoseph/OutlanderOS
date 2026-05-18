import { withErrorHandling } from "@/lib/api-error"
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/current-user'

// A member may only see/modify tasks assigned to or created by them.
async function loadOwnedTask(id: string, userId: string, isAdmin: boolean) {
  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  })
  if (!task) return { error: 'Not found', status: 404 as const }
  if (!isAdmin && task.assignedToId !== userId && task.createdById !== userId) {
    return { error: 'Forbidden', status: 403 as const }
  }
  return { task }
}

async function GET__inner(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = getCurrentUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const owned = await loadOwnedTask(id, me.userId, me.role === 'ADMIN')
  if ('error' in owned) {
    return NextResponse.json({ error: owned.error }, { status: owned.status })
  }
  return NextResponse.json({ task: owned.task })
}

async function PUT__inner(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = getCurrentUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const owned = await loadOwnedTask(id, me.userId, me.role === 'ADMIN')
  if ('error' in owned) {
    return NextResponse.json({ error: owned.error }, { status: owned.status })
  }
  const body = await request.json()

  const data: Record<string, unknown> = {}
  if (body.title !== undefined) data.title = body.title
  if (body.description !== undefined) data.description = body.description
  if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null
  if (body.status !== undefined) data.status = body.status
  if (body.priority !== undefined) data.priority = body.priority
  if (body.portal !== undefined) data.portal = body.portal
  if (body.link !== undefined) data.link = body.link
  if (body.assignedToId !== undefined) data.assignedToId = body.assignedToId

  try {
    const task = await prisma.task.update({
      where: { id },
      data,
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    })
    return NextResponse.json({ task })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

async function DELETE__inner(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = getCurrentUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const owned = await loadOwnedTask(id, me.userId, me.role === 'ADMIN')
  if ('error' in owned) {
    return NextResponse.json({ error: owned.error }, { status: owned.status })
  }
  try {
    await prisma.task.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export const GET = withErrorHandling(GET__inner as any)
export const PUT = withErrorHandling(PUT__inner as any)
export const DELETE = withErrorHandling(DELETE__inner as any)
