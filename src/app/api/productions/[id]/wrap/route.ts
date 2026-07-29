import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/auth'
import { sendMail, invoiceRequestEmail, isMailConfigured } from '@/lib/mailer'

// POST /api/productions/[id]/wrap
//
// Wraps a shoot: asks every crew member with an email address to invoice, each
// through their own tokenised link.
//
// Requests are created BEFORE any email goes out, and a send failure marks that
// row rather than aborting the batch. One bad address must not stop the other
// fourteen people being asked — and the ones who were asked need to stay asked,
// so the caller can retry the failures without duplicating requests.
export const POST = withAuth(async (
  _request: NextRequest,
  { params }: { params?: Promise<Record<string, string>> },
  user,
) => {
  const { id } = (await params)!
  try {
    const production = await prisma.production.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        campaignId: true,
        campaignBudgetId: true,
        teamMembers: { select: { id: true, name: true, email: true, role: true, rate: true } },
      },
    })
    if (!production) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (!isMailConfigured()) {
      return NextResponse.json(
        {
          error:
            'Email isn’t configured yet, so nobody would be asked to invoice. Add the SMTP settings for invoices@outlandermag.com and try again.',
          reason: 'MAIL_NOT_CONFIGURED',
        },
        { status: 503 }
      )
    }

    const withEmail = production.teamMembers.filter((m) => m.email?.includes('@'))
    if (withEmail.length === 0) {
      return NextResponse.json(
        {
          error: 'No crew member on this production has an email address, so there is nobody to ask.',
          reason: 'NO_RECIPIENTS',
        },
        { status: 400 }
      )
    }

    // The IO number gives finance something to match the invoice against.
    // Signed first — an unsigned IO isn't a contract to quote at suppliers.
    const io = production.campaignId
      ? await prisma.insertionOrder.findFirst({
          where: { campaignId: production.campaignId, status: { not: 'VOID' } },
          orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
          select: { ioNumber: true, status: true },
        })
      : null
    const ioNumber = io?.status === 'SIGNED' ? io.ioNumber : null

    const base = process.env.NEXTAUTH_URL?.replace(/\/$/, '') ?? ''
    const deadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    const sent: string[] = []
    const failed: { name: string; email: string; error: string }[] = []
    const skipped: string[] = []

    for (const member of withEmail) {
      // Don't ask the same person twice for the same production.
      const existing = await prisma.invoiceSubmission.findFirst({
        where: { productionId: id, supplierEmail: member.email!, status: { not: 'REJECTED' } },
        select: { id: true },
      })
      if (existing) {
        skipped.push(member.name)
        continue
      }

      // 32 bytes: the page this opens is public, so the token is the only thing
      // standing between a guess and someone else's invoice request.
      const token = randomBytes(32).toString('base64url')

      const submission = await prisma.invoiceSubmission.create({
        data: {
          supplierName: member.name,
          supplierEmail: member.email!,
          token,
          productionId: id,
          ioNumber,
          expectedAmount: member.rate ?? null,
          campaignBudgetId: production.campaignBudgetId,
          status: 'REQUESTED',
          requestedAt: new Date(),
          requestedById: user.userId,
          paymentDeadline: deadline,
          description: `${member.role} — ${production.title}`,
        },
      })

      try {
        const mail = invoiceRequestEmail({
          name: member.name,
          productionTitle: production.title,
          ioNumber,
          link: `${base}/invoice/${token}`,
          expectedAmount: member.rate ?? null,
          deadline,
        })
        await sendMail({ to: member.email!, ...mail })
        sent.push(member.name)
      } catch (err) {
        // The request stands; only the send failed. Recorded on the row so it's
        // visible in finance rather than lost in a log nobody reads.
        await prisma.invoiceSubmission.update({
          where: { id: submission.id },
          data: {
            flagged: true,
            flagNote: `Invoice request email failed: ${err instanceof Error ? err.message : String(err)}`,
          },
        })
        failed.push({
          name: member.name,
          email: member.email!,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    return NextResponse.json({
      sent: sent.length,
      failed: failed.length,
      skipped: skipped.length,
      detail: { sent, failed, skipped },
      ioNumber,
    })
  } catch (err) {
    console.error('POST /api/productions/[id]/wrap', err)
    return NextResponse.json({ error: 'Failed to wrap the shoot' }, { status: 500 })
  }
})
