import { withErrorHandling } from "@/lib/api-error"
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/current-user'
import { detectProjectFromNewItem } from '@/lib/ai-intelligence'

async function GET__inner(request: NextRequest) {
  const me = getCurrentUser(request)
  if (!me) return NextResponse.json({ tasks: [] }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const assignedToId = searchParams.get('assignedToId') || undefined
  const status = searchParams.get('status') || undefined
  const portal = searchParams.get('portal') || undefined
  const scope = searchParams.get('scope') // "mine" | "all"
  const isAdmin = me.role === 'ADMIN'

  const where: Record<string, unknown> = {}
  // Members are always scoped to their own tasks; only admins may view
  // another user's tasks or the full board.
  if (isAdmin && assignedToId) where.assignedToId = assignedToId
  else if (isAdmin && scope === 'all') { /* no assignee filter */ }
  else where.assignedToId = me.userId
  if (status) where.status = status
  if (portal) where.portal = portal

  try {
    const tasks = await prisma.task.findMany({
      where,
      orderBy: [
        { status: 'asc' },
        { dueDate: 'asc' },
        { createdAt: 'desc' },
      ],
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    })
    return NextResponse.json({ tasks })
  } catch (e) {
    return NextResponse.json({ tasks: [], error: String(e) })
  }
}

async function POST__inner(request: NextRequest) {
  const me = getCurrentUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  if (!body.title) {
    return NextResponse.json({ error: 'Title required' }, { status: 400 })
  }

  try {
    const task = await prisma.task.create({
      data: {
        title: body.title,
        description: body.description || null,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        status: body.status || 'TODO',
        priority: body.priority || 'MEDIUM',
        portal: body.portal || null,
        link: body.link || null,
        assignedToId: body.assignedToId || me.userId,
        createdById: me.userId,
      },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    })

    if (task.assignedToId !== me.userId) {
      await prisma.notification.create({
        data: {
          userId: task.assignedToId,
          type: 'task_assigned',
          message: `${me.name} assigned you a task: ${task.title}`,
          link: '/me',
        },
      })
    }

    // Auto-trigger: try to link the new task to an existing smart project
    try {
      await detectProjectFromNewItem({
        type: 'task',
        id: task.id,
        title: task.title,
        description: task.description,
        context: task.portal,
      })
    } catch {
      // Non-fatal — periodic analysis will catch it
    }

    return NextResponse.json({ task })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export const GET = withErrorHandling(GET__inner as any)
export const POST = withErrorHandling(POST__inner as any)
