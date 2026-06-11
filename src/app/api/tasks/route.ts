import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/current-user'

const TASK_INCLUDE = {
  assignedTo: { select: { id: true, name: true, email: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  project: { select: { id: true, title: true } },
  production: { select: { id: true, title: true } },
} as const

export async function GET(request: NextRequest) {
  const me = getCurrentUser(request)
  if (!me) return NextResponse.json({ tasks: [] }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const assignedToId = searchParams.get('assignedToId') || undefined
  const status = searchParams.get('status') || undefined
  const portal = searchParams.get('portal') || undefined
  const type = searchParams.get('type') || undefined // ACTION | TRACK
  const projectId = searchParams.get('projectId') || undefined
  const productionId = searchParams.get('productionId') || undefined
  const scope = searchParams.get('scope') // "mine" | "all"
  const isAdmin = me.role === 'ADMIN'

  const where: Record<string, unknown> = {}
  if (projectId) {
    // Project task lists are shared — everyone on the team sees them.
    where.projectId = projectId
  } else if (productionId) {
    where.productionId = productionId
  } else if (isAdmin && assignedToId) {
    where.assignedToId = assignedToId
  } else if (isAdmin && scope === 'all') {
    /* no assignee filter */
  } else {
    // Personal view: tasks assigned to or created by the user, plus tasks
    // on projects/productions they own or are assigned to.
    where.OR = [
      { assignedToId: me.userId },
      { createdById: me.userId },
      { project: { assignedToId: me.userId } },
      { production: { leadId: me.userId } },
    ]
  }
  if (status) where.status = status
  if (portal) where.portal = portal
  if (type) where.taskType = type

  try {
    const tasks = await prisma.task.findMany({
      where,
      orderBy: [
        { dueDate: 'asc' },
        { createdAt: 'desc' },
      ],
      include: TASK_INCLUDE,
    })
    return NextResponse.json({ tasks })
  } catch (e) {
    return NextResponse.json({ tasks: [], error: String(e) })
  }
}

export async function POST(request: NextRequest) {
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
        taskType: body.taskType === 'TRACK' ? 'TRACK' : 'ACTION',
        projectId: body.projectId || null,
        productionId: body.productionId || null,
        assignedToId: body.assignedToId || me.userId,
        createdById: me.userId,
      },
      include: TASK_INCLUDE,
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

    return NextResponse.json({ task })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
