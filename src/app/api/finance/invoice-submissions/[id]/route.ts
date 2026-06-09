import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// Review / approve / mark paid a supplier invoice submission.
export const PUT = withAuth(async (request: NextRequest, context, user) => {
  try {
    const params = context.params ? await context.params : {}
    const id = params.id
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const existing = await prisma.invoiceSubmission.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await request.json()
    const data: Record<string, unknown> = {}

    if (body.amount !== undefined) data.amount = body.amount === null ? null : Number(body.amount)
    for (const field of ['description', 'notes', 'attachmentUrl', 'currency', 'xeroPaymentId']) {
      if (body[field] !== undefined) data[field] = body[field]
    }
    if (body.reminderSent !== undefined) data.reminderSent = Boolean(body.reminderSent)

    if (body.status !== undefined) {
      data.status = body.status
      if (['REVIEWED', 'APPROVED', 'REJECTED'].includes(body.status) && !existing.reviewedBy) {
        data.reviewedBy = user.userId
      }
      if (body.status === 'PAID') {
        data.paidAt = body.paidAt ? new Date(body.paidAt) : new Date()
      }
    }

    const submission = await prisma.invoiceSubmission.update({ where: { id }, data })
    return NextResponse.json({ submission })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
})
