import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/auth'
import {
  sendEnvelope,
  isDocuSignConfigured,
  DocuSignNotConfiguredError,
  DocuSignConsentRequiredError,
} from '@/lib/docusign'
import { IO_COMPANY, type IOLineItem } from '@/lib/io-template'

// POST /api/insertion-orders/[ioId]/send-for-signature
//
// Sends the IO to the client for signature via DocuSign. The document itself
// lives as a DocuSign template — we supply the values and the recipient, which
// is why the T&Cs aren't rendered here.
//
// Tab labels must match the template exactly. Building them in one place means
// a template change is a single edit rather than a hunt through the route.
function tabsFor(io: {
  ioNumber: string
  advertiserName: string
  campaignName: string
  poNumber: string | null
  totalNet: number
  contactName: string | null
  lineItems: unknown
}): Record<string, string> {
  const lines = (Array.isArray(io.lineItems) ? io.lineItems : []) as IOLineItem[]
  const money = (n: number) =>
    `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const tabs: Record<string, string> = {
    io_number: io.ioNumber,
    advertiser: io.advertiserName,
    campaign: io.campaignName,
    po_number: io.poNumber ?? '',
    contact_name: io.contactName ?? '',
    total_net: money(io.totalNet),
    company_name: IO_COMPANY.legalName,
    company_number: IO_COMPANY.companyNumber,
    vat_number: IO_COMPANY.vatNumber,
  }

  // The template carries a fixed number of line rows. Anything beyond them would
  // be silently dropped by DocuSign, so the caller is stopped instead — a
  // truncated insertion order is a contract that doesn't say what was agreed.
  lines.forEach((l, i) => {
    const n = i + 1
    tabs[`line${n}_description`] = l.description ?? ''
    tabs[`line${n}_dates`] = [l.startDate, l.endDate].filter(Boolean).join(' – ')
    tabs[`line${n}_qty`] = String(l.quantity ?? 0)
    tabs[`line${n}_rate`] = money(l.rate ?? 0)
    tabs[`line${n}_subtotal`] = money(l.subtotal ?? 0)
  })

  return tabs
}

const MAX_TEMPLATE_LINES = 10

export const POST = withAuth(async (
  _request: NextRequest,
  { params }: { params?: Promise<Record<string, string>> },
) => {
  const { ioId } = (await params)!
  try {
    if (!isDocuSignConfigured()) {
      return NextResponse.json(
        {
          error:
            'DocuSign isn’t connected yet. Add the integration key, user id, private key and template id, then try again.',
          reason: 'NOT_CONFIGURED',
        },
        { status: 503 }
      )
    }

    const io = await prisma.insertionOrder.findUnique({ where: { id: ioId } })
    if (!io) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (io.envelopeId) {
      return NextResponse.json(
        {
          error: 'This IO has already been sent for signature. Void it first to send a new one.',
          reason: 'ALREADY_SENT',
        },
        { status: 409 }
      )
    }
    if (io.status === 'VOID') {
      return NextResponse.json({ error: 'This IO is void.' }, { status: 409 })
    }
    if (!io.contactEmail) {
      return NextResponse.json(
        { error: 'Add a contact email before sending for signature.', reason: 'NO_RECIPIENT' },
        { status: 400 }
      )
    }

    const lines = (Array.isArray(io.lineItems) ? io.lineItems : []) as unknown as IOLineItem[]
    if (lines.length === 0) {
      return NextResponse.json(
        { error: 'Add at least one line item before sending.', reason: 'NO_LINES' },
        { status: 400 }
      )
    }
    if (lines.length > MAX_TEMPLATE_LINES) {
      return NextResponse.json(
        {
          error: `The DocuSign template holds ${MAX_TEMPLATE_LINES} line items and this IO has ${lines.length}. Sending would silently drop the rest — split the IO or extend the template.`,
          reason: 'TOO_MANY_LINES',
        },
        { status: 400 }
      )
    }

    const result = await sendEnvelope({
      signerName: io.contactName || io.advertiserName,
      signerEmail: io.contactEmail,
      subject: `${IO_COMPANY.name} — Insertion Order ${io.ioNumber}`,
      fields: tabsFor(io),
    })

    const updated = await prisma.insertionOrder.update({
      where: { id: ioId },
      data: {
        signatureProvider: 'DOCUSIGN',
        envelopeId: result.envelopeId,
        signatureStatus: result.status,
        sentToEmail: io.contactEmail,
        sentAt: new Date(),
        status: 'SENT',
        lastSyncedAt: new Date(),
      },
    })

    return NextResponse.json({ insertionOrder: updated })
  } catch (err) {
    if (err instanceof DocuSignConsentRequiredError) {
      return NextResponse.json(
        { error: err.message, reason: 'CONSENT_REQUIRED', consentUrl: err.url },
        { status: 503 }
      )
    }
    if (err instanceof DocuSignNotConfiguredError) {
      return NextResponse.json({ error: err.message, reason: 'NOT_CONFIGURED' }, { status: 503 })
    }
    console.error('POST /api/insertion-orders/[ioId]/send-for-signature', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to send for signature' },
      { status: 502 }
    )
  }
})
