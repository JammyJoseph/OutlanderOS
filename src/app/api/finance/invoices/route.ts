import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAdminDb } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// Incoming supplier invoices (InvoiceSubmission) with filters:
// ?status=RECEIVED|UNDER_REVIEW|APPROVED|PAID|REJECTED
// ?project=<campaignBudgetId>  ?flagged=true
// ?from=YYYY-MM-DD&to=YYYY-MM-DD (receivedAt range)
export const GET = withAdminDb(async (request: NextRequest) => {
  try {
    const params = request.nextUrl.searchParams
    const status = params.get('status') || undefined
    const project = params.get('project') || undefined
    const flagged = params.get('flagged')
    const from = params.get('from')
    const to = params.get('to')

    const invoices = await prisma.invoiceSubmission.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(project ? { campaignBudgetId: project } : {}),
        ...(flagged === 'true' ? { flagged: true } : {}),
        ...(from || to
          ? {
              receivedAt: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(`${to}T23:59:59`) } : {}),
              },
            }
          : {}),
      },
      orderBy: { paymentDeadline: 'asc' },
    })

    const open = invoices.filter((i) => i.status !== 'PAID' && i.status !== 'REJECTED')
    const totalOwed = open.reduce((s, i) => s + (i.amount ?? 0), 0)
    const pendingApproval = invoices.filter((i) => i.status === 'RECEIVED' || i.status === 'UNDER_REVIEW').length

    return NextResponse.json({ invoices, totalOwed, pendingApproval, count: invoices.length })
  } catch (e) {
    return NextResponse.json({ invoices: [], totalOwed: 0, pendingApproval: 0, count: 0, error: "An error occurred" }, { status: 500 })
  }
})

// Create an invoice submission — from the email scanner or manual entry.
// Dedups on emailMessageId. Payment deadline defaults to 30 days after receipt.
export const POST = withAdminDb(async (request: NextRequest) => {
  try {
    const body = await request.json()
    if (!body.supplierName) {
      return NextResponse.json({ error: 'supplierName is required' }, { status: 400 })
    }

    if (body.emailMessageId) {
      const existing = await prisma.invoiceSubmission.findUnique({
        where: { emailMessageId: body.emailMessageId },
      })
      if (existing) return NextResponse.json({ invoice: existing, deduped: true })
    }

    if (body.campaignBudgetId) {
      const budget = await prisma.campaignBudget.findUnique({ where: { id: body.campaignBudgetId } })
      if (!budget) return NextResponse.json({ error: 'Unknown project (campaignBudgetId)' }, { status: 400 })
    }

    const receivedAt = body.receivedAt ? new Date(body.receivedAt) : new Date()
    const paymentDeadline = body.paymentDeadline
      ? new Date(body.paymentDeadline)
      : new Date(receivedAt.getTime() + 30 * 24 * 60 * 60 * 1000)

    const invoice = await prisma.invoiceSubmission.create({
      data: {
        supplierName: body.supplierName,
        supplierEmail: body.supplierEmail ?? '',
        amount: body.amount !== undefined && body.amount !== null && body.amount !== '' ? Number(body.amount) : null,
        currency: body.currency || 'GBP',
        description: body.description ?? null,
        emailSubject: body.emailSubject ?? null,
        emailMessageId: body.emailMessageId ?? null,
        attachmentUrl: body.attachmentUrl ?? null,
        campaignBudgetId: body.campaignBudgetId ?? null,
        receivedAt,
        paymentDeadline,
        status: 'RECEIVED',
        notes: body.notes ?? null,
      },
    })
    return NextResponse.json({ invoice }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
})
