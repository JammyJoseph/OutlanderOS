import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/current-user'

const TASK_INCLUDE = {
  assignedTo: { select: { id: true, name: true, email: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  project: { select: { id: true, title: true, assignedToId: true } },
  production: { select: { id: true, title: true, leadId: true } },
} as const

// A member may see/modify tasks assigned to or created by them, plus tasks
// on projects/productions they own — those appear on their dashboard too.
async function loadOwnedTask(id: string, userId: string, isAdmin: boolean) {
  const task = await prisma.task.findUnique({
    where: { id },
    include: TASK_INCLUDE,
  })
  if (!task) return { error: 'Not found', status: 404 as const }
  const owned =
    isAdmin ||
    task.assignedToId === userId ||
    task.createdById === userId ||
    task.project?.assignedToId === userId ||
    task.production?.leadId === userId ||
    // Project-linked tasks are a shared team list
    Boolean(task.projectId || task.productionId)
  if (!owned) {
    return { error: 'Forbidden', status: 403 as const }
  }
  return { task }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = getCurrentUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const owned = await loadOwnedTask(id, me.userId, me.role === 'ADMIN')
  if ('error' in owned) {
    return NextResponse.json({ error: owned.error }, { status: owned.status })
  }
  return NextResponse.json({ task: owned.task })
}

async function updateTask(request: NextRequest, params: Promise<{ id: string }>) {
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
  if (body.status !== undefined) {
    data.status = body.status
    // Track completion time so the dashboard can show "done in the last 7 days".
    if (body.status === 'DONE' && owned.task.status !== 'DONE') data.completedAt = new Date()
    if (body.status !== 'DONE') data.completedAt = null
  }
  if (body.priority !== undefined) data.priority = body.priority
  if (body.portal !== undefined) data.portal = body.portal
  if (body.link !== undefined) data.link = body.link
  if (body.assignedToId !== undefined) data.assignedToId = body.assignedToId
  if (body.taskType !== undefined) {
    data.taskType = body.taskType === 'TRACK' ? 'TRACK' : 'ACTION'
  }
  if (body.projectId !== undefined) data.projectId = body.projectId || null
  if (body.productionId !== undefined) data.productionId = body.productionId || null

  try {
    const task = await prisma.task.update({
      where: { id },
      data,
      include: TASK_INCLUDE,
    })
    return NextResponse.json({ task })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return updateTask(request, params)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return updateTask(request, params)
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
