import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// Flag an invoice with a note (e.g. wrong amount, unknown supplier, needs
// project coding). Send { flagged: false } to clear the flag.
export const PATCH = withAuth(async (request: NextRequest, context, user) => {
  try {
    const params = context.params ? await context.params : {}
    const id = params.id
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const existing = await prisma.invoiceSubmission.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await request.json().catch(() => ({}))
    const clearing = body.flagged === false

    if (!clearing && !body.note) {
      return NextResponse.json({ error: 'A note is required when flagging an invoice' }, { status: 400 })
    }

    const invoice = await prisma.invoiceSubmission.update({
      where: { id },
      data: clearing
        ? { flagged: false, flagNote: null }
        : {
            flagged: true,
            flagNote: String(body.note),
            reviewedBy: existing.reviewedBy ?? user.userId,
            ...(existing.status === 'RECEIVED' ? { status: 'UNDER_REVIEW' } : {}),
          },
    })
    return NextResponse.json({ invoice })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
})
