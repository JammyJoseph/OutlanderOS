import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAdminDb } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// General invoice update: amount, project coding, notes, mark paid/rejected.
// Approval goes through /approve so the overage check can't be skipped.
export const PATCH = withAdminDb(async (request: NextRequest, context, user) => {
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

    // Stage sync: once every invoice coded to this project is settled
    // (PAID, ignoring REJECTED), mark the linked Commercial deal as Paid.
    if (body.status === 'PAID' && invoice.campaignBudgetId) {
      const open = await prisma.invoiceSubmission.count({
        where: {
          campaignBudgetId: invoice.campaignBudgetId,
          status: { notIn: ['PAID', 'REJECTED'] },
        },
      })
      if (open === 0) {
        const budget = await prisma.campaignBudget.findUnique({
          where: { id: invoice.campaignBudgetId },
          select: { campaignId: true },
        })
        if (budget?.campaignId) {
          const campaign = await prisma.campaign.findUnique({
            where: { id: budget.campaignId },
            select: { id: true, stage: true, title: true },
          })
          if (campaign && campaign.stage !== 'PAID') {
            await prisma.campaign.update({
              where: { id: campaign.id },
              data: { stage: 'PAID', stageUpdatedAt: new Date() },
            })
            await prisma.dealActivity.create({
              data: {
                campaignId: campaign.id,
                type: 'stage_change',
                message: `"${campaign.title}" moved from ${campaign.stage} to PAID — all supplier invoices settled in Finance`,
                meta: { from: campaign.stage, to: 'PAID', source: 'finance' },
                userId: user.userId,
                userName: user.name,
              },
            })
          }
        }
      }
    }

    return NextResponse.json({ invoice })
  } catch (e) {
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
})
