import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/auth'
import {
  getEnvelopeStatus,
  businessStatusFor,
  isDocuSignConfigured,
  DocuSignConsentRequiredError,
} from '@/lib/docusign'

// POST /api/insertion-orders/[ioId]/sync-signature
//
// Pulls the envelope's current state from DocuSign. This exists because prod has
// no HTTPS listener, so DocuSign Connect webhooks can't reach us — polling is the
// only option until TLS lands. When it does, a webhook can write the same fields
// and this becomes a manual "refresh" fallback rather than the primary path.
export const POST = withAuth(async (
  _request: NextRequest,
  { params }: { params?: Promise<Record<string, string>> },
) => {
  const { ioId } = (await params)!
  try {
    const io = await prisma.insertionOrder.findUnique({ where: { id: ioId } })
    if (!io) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!io.envelopeId) {
      return NextResponse.json(
        { error: 'This IO hasn’t been sent for signature.', reason: 'NOT_SENT' },
        { status: 400 }
      )
    }
    if (!isDocuSignConfigured()) {
      return NextResponse.json(
        { error: 'DocuSign isn’t connected.', reason: 'NOT_CONFIGURED' },
        { status: 503 }
      )
    }

    const env = await getEnvelopeStatus(io.envelopeId)

    // Only move the business status when DocuSign reports a state we recognise.
    // An unmapped state leaves `status` alone rather than guessing — the raw
    // provider status is stored either way, so nothing is lost.
    const nextBusiness = businessStatusFor(env.status)

    const updated = await prisma.insertionOrder.update({
      where: { id: ioId },
      data: {
        signatureStatus: env.status,
        lastSyncedAt: new Date(),
        viewedAt: env.deliveredAt ? new Date(env.deliveredAt) : io.viewedAt,
        declinedReason: env.declinedReason ?? io.declinedReason,
        ...(nextBusiness ? { status: nextBusiness } : {}),
        // Completion is the one place we record who signed. DocuSign is the
        // authority on that, so a manually typed name is not overwritten unless
        // the envelope actually completed.
        ...(env.status === 'completed' && env.completedAt
          ? { signedAt: new Date(env.completedAt) }
          : {}),
      },
    })

    return NextResponse.json({ insertionOrder: updated, envelope: env })
  } catch (err) {
    if (err instanceof DocuSignConsentRequiredError) {
      return NextResponse.json(
        { error: err.message, reason: 'CONSENT_REQUIRED', consentUrl: err.url },
        { status: 503 }
      )
    }
    console.error('POST /api/insertion-orders/[ioId]/sync-signature', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to sync signature status' },
      { status: 502 }
    )
  }
})
