import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { sendMail, invoiceReceivedEmail, isMailConfigured } from '@/lib/mailer'

// Public — no auth. Crew members are not OutlanderOS users, so the token IS the
// credential. Everything here is written with that in mind:
//
//  • Only the fields the supplier needs are returned. No project economics, no
//    other crew, no rates beyond their own agreed figure.
//  • The token is never echoed back in a response body.
//  • A token that doesn't exist and one that's already been used are answered
//    the same way where it matters, so the endpoint can't be used to probe.
//
// Registered as a public path in src/proxy.ts.

function publicView(sub: {
  supplierName: string
  status: string
  ioNumber: string | null
  expectedAmount: number | null
  currency: string
  paymentDeadline: Date
  submittedAt: Date | null
  amount: number | null
  production: { title: string } | null
}) {
  return {
    supplierName: sub.supplierName,
    productionTitle: sub.production?.title ?? null,
    ioNumber: sub.ioNumber,
    expectedAmount: sub.expectedAmount,
    currency: sub.currency,
    paymentDeadline: sub.paymentDeadline,
    // Once submitted, the page becomes a receipt rather than a form.
    submitted: sub.status !== 'REQUESTED',
    submittedAt: sub.submittedAt,
    amount: sub.amount,
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  try {
    const sub = await prisma.invoiceSubmission.findUnique({
      where: { token },
      select: {
        supplierName: true,
        status: true,
        ioNumber: true,
        expectedAmount: true,
        currency: true,
        paymentDeadline: true,
        submittedAt: true,
        amount: true,
        production: { select: { title: true } },
      },
    })
    if (!sub) {
      return NextResponse.json({ error: 'This link isn’t valid.' }, { status: 404 })
    }
    return NextResponse.json({ request: publicView(sub) })
  } catch (err) {
    console.error('GET /api/invoice/[token]', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  try {
    const sub = await prisma.invoiceSubmission.findUnique({
      where: { token },
      select: {
        id: true,
        status: true,
        supplierName: true,
        supplierEmail: true,
        paymentDeadline: true,
        production: { select: { title: true } },
      },
    })
    if (!sub) return NextResponse.json({ error: 'This link isn’t valid.' }, { status: 404 })

    // One submission per link. Re-submitting would overwrite a figure finance
    // may already have reviewed.
    if (sub.status !== 'REQUESTED') {
      return NextResponse.json(
        { error: 'An invoice has already been submitted against this link.', reason: 'ALREADY_SUBMITTED' },
        { status: 409 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const amount = Number(body.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Enter the invoice amount.' }, { status: 400 })
    }
    const currency = ['GBP', 'USD', 'EUR'].includes(body.currency) ? body.currency : 'GBP'
    const attachmentUrl = typeof body.attachmentUrl === 'string' ? body.attachmentUrl.trim() : ''
    if (!attachmentUrl) {
      return NextResponse.json(
        { error: 'Add a link to your invoice — Drive, Dropbox or anywhere we can open it.' },
        { status: 400 }
      )
    }
    // Only http(s). A javascript: or data: URL stored here would be handed
    // straight to whoever clicks it in the finance tab.
    if (!/^https?:\/\//i.test(attachmentUrl)) {
      return NextResponse.json(
        { error: 'That link doesn’t look right — it should start with http:// or https://' },
        { status: 400 }
      )
    }

    await prisma.invoiceSubmission.update({
      where: { id: sub.id },
      data: {
        amount,
        currency,
        attachmentUrl,
        notes: typeof body.notes === 'string' ? body.notes.slice(0, 2000) : null,
        status: 'RECEIVED',
        submittedAt: new Date(),
        receivedAt: new Date(),
      },
    })

    // Confirmation is best-effort. The invoice is recorded either way, and
    // failing the submission because a receipt didn't send would be worse than
    // the supplier not getting one.
    if (isMailConfigured()) {
      try {
        const mail = invoiceReceivedEmail({
          name: sub.supplierName,
          productionTitle: sub.production?.title ?? 'your work with us',
          amount,
          currency,
          deadline: sub.paymentDeadline,
        })
        await sendMail({ to: sub.supplierEmail, ...mail })
      } catch (err) {
        console.error('Invoice confirmation email failed', err)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('POST /api/invoice/[token]', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
