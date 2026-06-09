import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// List submitted supplier invoices, filterable by status.
export const GET = withAuth(async (request: NextRequest) => {
  try {
    const status = request.nextUrl.searchParams.get('status') || undefined
    const submissions = await prisma.invoiceSubmission.findMany({
      where: { ...(status ? { status } : {}) },
      orderBy: { paymentDeadline: 'asc' },
    })
    const totalOwed = submissions
      .filter((s) => s.status !== 'PAID' && s.status !== 'REJECTED')
      .reduce((sum, s) => sum + (s.amount || 0), 0)
    return NextResponse.json({ submissions, totalOwed, count: submissions.length })
  } catch (e) {
    return NextResponse.json({ submissions: [], totalOwed: 0, count: 0, error: String(e) }, { status: 500 })
  }
})

// Create a submission from an email scan or manually. Dedups on emailMessageId.
export const POST = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json()
    if (!body.supplierName || !body.supplierEmail) {
      return NextResponse.json({ error: 'supplierName and supplierEmail are required' }, { status: 400 })
    }

    if (body.emailMessageId) {
      const existing = await prisma.invoiceSubmission.findUnique({
        where: { emailMessageId: body.emailMessageId },
      })
      if (existing) return NextResponse.json({ submission: existing, deduped: true })
    }

    const receivedAt = body.receivedAt ? new Date(body.receivedAt) : new Date()
    const paymentDeadline = body.paymentDeadline
      ? new Date(body.paymentDeadline)
      : new Date(receivedAt.getTime() + 30 * 24 * 60 * 60 * 1000)

    const submission = await prisma.invoiceSubmission.create({
      data: {
        supplierName: body.supplierName,
        supplierEmail: body.supplierEmail,
        amount: body.amount !== undefined ? Number(body.amount) : null,
        currency: body.currency || 'GBP',
        description: body.description ?? null,
        emailSubject: body.emailSubject ?? null,
        emailMessageId: body.emailMessageId ?? null,
        attachmentUrl: body.attachmentUrl ?? null,
        receivedAt,
        paymentDeadline,
        status: body.status || 'RECEIVED',
        notes: body.notes ?? null,
      },
    })
    return NextResponse.json({ submission }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
})
