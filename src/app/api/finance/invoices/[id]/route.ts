import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// General invoice update: amount, project coding, notes, mark paid/rejected.
// Approval goes through /approve so the overage check can't be skipped.
export const PATCH = withAuth(async (request: NextRequest, context, user) => {
  try {
    const params = context.params ? await context.params : {}
    const id = params.id
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const existing = await prisma.invoiceSubmission.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await request.json()
    const data: Record<string, unknown> = {}

    if (body.amount !== undefined) data.amount = body.amount === null ? null : Number(body.amount)
    for (const field of ['description', 'notes', 'attachmentUrl', 'currency', 'xeroPaymentId', 'campaignBudgetId']) {
      if (body[field] !== undefined) data[field] = body[field]
    }
    if (body.reminderSent !== undefined) data.reminderSent = Boolean(body.reminderSent)

    if (body.status !== undefined) {
      const allowed = ['RECEIVED', 'UNDER_REVIEW', 'PAID', 'REJECTED']
      if (!allowed.includes(body.status)) {
        return NextResponse.json({ error: `status must be one of ${allowed.join(', ')} (use /approve to approve)` }, { status: 400 })
      }
      data.status = body.status
      if (body.status === 'UNDER_REVIEW' && !existing.reviewedBy) data.reviewedBy = user.userId
      if (body.status === 'PAID') data.paidAt = body.paidAt ? new Date(body.paidAt) : new Date()
    }

    const invoice = await prisma.invoiceSubmission.update({ where: { id }, data })
    return NextResponse.json({ invoice })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
})
