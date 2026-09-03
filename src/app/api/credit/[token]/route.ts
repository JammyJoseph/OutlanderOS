import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import {
  AGREEMENT_SUMMARY,
  AGREEMENT_TERMS,
  AGREEMENT_VERSION,
  CREDIT_ROLE_GROUPS,
  agreementFullText,
  bioLimitForTier,
  charCount,
  deadlineLabel,
  isSubmissionOpen,
  submissionDeadline,
  isCreditRole,
  isValidEmail,
  sendCreditOutcome,
} from '@/lib/credit-consent'
import { syncCreditSheetInBackground } from '@/lib/credit-sheet'

// Public — the token is the credential, exactly like /api/invoice/[token].
// Contributors are not OutlanderOS users. Consequences:
//
//  • The GET returns only this person's own prefill — never the list, never
//    anyone else's status, never the address (they're typing it, not reading it).
//  • Acceptance is recorded server-side as its own action, so "they accepted
//    the agreement" never depends on whether they finished the form.
//  • One submission per link. A confirmed credit is a signed record; letting a
//    later visit overwrite it would make the audit trail worthless.

const select = {
  name: true,
  role: true,
  instagram: true,
  email: true,
  // Not shown to them, and not theirs to change — it decides how many
  // characters their description gets.
  tier: true,
  status: true,
  agreementAcceptedAt: true,
  respondedAt: true,
  confirmedName: true,
  printConsent: true,
} as const

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  try {
    const req = await prisma.creditRequest.findUnique({ where: { token }, select })
    if (!req) {
      return NextResponse.json({ error: 'This link isn’t valid.' }, { status: 404 })
    }

    // First sight of the page. Only ever moves SENT → OPENED, so a later visit
    // can't regress a CONFIRMED row.
    if (req.status === 'SENT') {
      await prisma.creditRequest.update({
        where: { token },
        data: { status: 'OPENED', openedAt: new Date() },
      })
    }

    return NextResponse.json({
      request: {
        name: req.name,
        role: req.role,
        instagram: req.instagram,
        email: req.email,
        accepted: !!req.agreementAcceptedAt,
        responded: !!req.respondedAt,
        confirmedName: req.confirmedName,
        printConsent: req.printConsent,
      },
      // How many characters this person's description may run to, or null if
      // their tier isn't asked for one. The tier itself is deliberately not
      // sent — nobody needs to learn they were filed as a 2.
      bioLimit: bioLimitForTier(req.tier),
      // Shown on the page while it's open, and the reason it closes.
      deadline: {
        at: submissionDeadline().toISOString(),
        label: deadlineLabel(),
        open: isSubmissionOpen(),
      },
      agreement: {
        version: AGREEMENT_VERSION,
        summary: AGREEMENT_SUMMARY,
        terms: AGREEMENT_TERMS,
      },
      // The closed list the discipline picker renders. Served with the page so
      // the form and the server can never disagree about what is pickable.
      roleGroups: CREDIT_ROLE_GROUPS,
    })
  } catch (err) {
    console.error('GET /api/credit/[token]', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  try {
    const req = await prisma.creditRequest.findUnique({ where: { token } })
    if (!req) {
      return NextResponse.json({ error: 'This link isn’t valid.' }, { status: 404 })
    }
    if (req.respondedAt) {
      return NextResponse.json(
        { error: 'This credit has already been submitted. Email us if something needs changing.' },
        { status: 409 }
      )
    }

    const body = await request.json().catch(() => ({}) as Record<string, unknown>)
    const action = String(body.action ?? '')

    // Past the deadline nothing can be recorded: the pages are laid out and a
    // credit we accept but cannot print is worse than one we decline to take.
    // 410 rather than 400 — the link was valid, the window has closed.
    if (!isSubmissionOpen() && action !== 'accept') {
      return NextResponse.json(
        {
          error: `Confirmations closed on ${deadlineLabel()}. Email silver@outlandermag.com and we will see what is still possible.`,
          closed: true,
        },
        { status: 410 }
      )
    }

    if (action === 'accept') {
      // Recorded even if they never finish the form — the fact they accepted
      // the confidentiality terms stands on its own.
      await prisma.creditRequest.update({
        where: { token },
        data: {
          agreementAcceptedAt: req.agreementAcceptedAt ?? new Date(),
          agreementVersion: req.agreementVersion ?? AGREEMENT_VERSION,
          // The exact words they saw, in writing, on the row itself.
          agreementText: req.agreementText ?? agreementFullText(),
        },
      })
      return NextResponse.json({ ok: true })
    }

    if (action === 'decline') {
      await prisma.creditRequest.update({
        where: { token },
        data: {
          status: 'DECLINED',
          respondedAt: new Date(),
          printConsent: false,
          declineNote: String(body.note ?? '').slice(0, 2000) || null,
        },
      })
      // Best effort: the decline is recorded either way. Failing their
      // response because a receipt didn't send would be worse than no receipt.
      if (isValidEmail(req.email)) {
        void sendCreditOutcome({ to: req.email!, name: req.name, confirmed: false }).catch((e) =>
          console.error('credit decline receipt failed', e)
        )
      }
      return NextResponse.json({ ok: true, declined: true })
    }

    if (action === 'submit') {
      if (!req.agreementAcceptedAt) {
        return NextResponse.json(
          { error: 'Please accept the agreement first.' },
          { status: 400 }
        )
      }
      // The final tick is its own consent, distinct from opening the agreement.
      // The page can't submit without it, but the page is not the boundary —
      // this endpoint is public and the record has to prove the tick was made.
      if (body.agree !== true) {
        return NextResponse.json(
          { error: 'Please tick the box confirming you agree to the terms.' },
          { status: 400 }
        )
      }

      const confirmedName = String(body.name ?? '').trim()
      if (!confirmedName) {
        return NextResponse.json(
          { error: 'Please confirm the name you want credited.' },
          { status: 400 }
        )
      }
      const confirmedEmail = String(body.email ?? '').trim()
      if (confirmedEmail && !isValidEmail(confirmedEmail)) {
        return NextResponse.json({ error: 'That email doesn’t look right.' }, { status: 400 })
      }
      // Exactly one discipline, and only from the list. Free text here would
      // make "what did they agree to be printed as" unanswerable.
      const confirmedRole = String(body.role ?? '').trim()
      if (!isCreditRole(confirmedRole)) {
        return NextResponse.json(
          { error: 'Please choose your discipline from the list.' },
          { status: 400 }
        )
      }

      // The description, capped by the row's own tier. Required where it is
      // asked for, because the printed entry has a space for it and a blank
      // one means chasing this person again later; ignored entirely where it
      // isn't, so a crafted request can't store text we would never print.
      const bioLimit = bioLimitForTier(req.tier)
      let confirmedBio: string | null = null
      if (bioLimit) {
        confirmedBio = String(body.bio ?? '').trim().replace(/\s+/g, ' ')
        if (!confirmedBio) {
          return NextResponse.json(
            { error: 'Please add a short line about what you do.' },
            { status: 400 }
          )
        }
        if (charCount(confirmedBio) > bioLimit) {
          return NextResponse.json(
            {
              error: `That description is ${charCount(confirmedBio)} characters — the limit is ${bioLimit}.`,
            },
            { status: 400 }
          )
        }
      }

      // Address is optional and stored verbatim as its own object. Trimmed,
      // capped, and never echoed back out of this endpoint.
      const rawAddr = (body.address ?? {}) as Record<string, unknown>
      const addr = Object.fromEntries(
        ['line1', 'line2', 'city', 'region', 'postcode', 'country']
          .map((k) => [k, String(rawAddr[k] ?? '').trim().slice(0, 200)])
          .filter(([, v]) => v)
      )

      await prisma.creditRequest.update({
        where: { token },
        data: {
          status: 'CONFIRMED',
          respondedAt: new Date(),
          printConsent: true,
          confirmedName: confirmedName.slice(0, 200),
          confirmedRole,
          confirmedBio,
          confirmedInstagram:
            String(body.instagram ?? '').trim().replace(/^@+/, '').slice(0, 100) || null,
          confirmedEmail: confirmedEmail || null,
          address: Object.keys(addr).length > 0 ? addr : undefined,
        },
      })
      // The designer's sheet is a projection of this table, so a new signature
      // rewrites it. Fire-and-forget on purpose: the credit is already recorded,
      // and a Google outage must never fail the submission that triggered it.
      syncCreditSheetInBackground()

      const receiptTo = confirmedEmail || req.email
      if (isValidEmail(receiptTo)) {
        void sendCreditOutcome({
          to: receiptTo!,
          name: confirmedName,
          confirmed: true,
          creditAs: confirmedName,
          discipline: confirmedRole,
        }).catch((e) => console.error('credit confirm receipt failed', e))
      }
      return NextResponse.json({ ok: true, confirmed: true })
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  } catch (err) {
    console.error('POST /api/credit/[token]', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
