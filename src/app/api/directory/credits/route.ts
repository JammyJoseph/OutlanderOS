import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/auth'
import { parseCsv } from '@/lib/shopify-csv'
import {
  isSendingLive,
  isValidEmail,
  newCreditToken,
  sendCreditInvite,
  TEST_INBOX,
} from '@/lib/credit-consent'

// Staff-side of the credit consent flow. One route, explicit actions:
//
//   GET               → every request + summary + whether sending is live
//   POST {action:"import"}          → pull the Google Sheet, upsert DRAFT rows
//   POST {action:"send", ids}       → send (or resend) invites — batched
//   POST {action:"update", id, ...} → fix a row's email/name before sending
//   POST {action:"delete", id}      → remove a row that shouldn't exist
//
// The send action carries no "test" parameter, deliberately. Test vs live is
// decided by the environment (CREDIT_SEND_LIVE), never by the caller — see
// lib/credit-consent.ts for why.

const DEFAULT_SHEET =
  'https://docs.google.com/spreadsheets/d/1mxaRkhdruo9A_v-V7UEX9QxZ2UPS0J25Ef22OGqPqZc/export?format=csv'

export const GET = withAuth(async () => {
  try {
    const rows = await prisma.creditRequest.findMany({
      orderBy: [{ tier: 'asc' }, { name: 'asc' }],
      select: {
        id: true, contactId: true, token: true, name: true, role: true,
        instagram: true, email: true, tier: true, status: true,
        sentAt: true, sentTo: true, isTest: true, emailError: true,
        openedAt: true, respondedAt: true,
        confirmedName: true, confirmedInstagram: true, confirmedEmail: true,
        // The address is included here — this endpoint is staff-auth'd and the
        // response drawer is where delivery details are read. It goes no
        // further: not to the public endpoint, not into the printed export.
        address: true,
        agreementAcceptedAt: true, agreementVersion: true,
        printConsent: true, declineNote: true,
      },
    })

    const count = (s: string) => rows.filter((r) => r.status === s).length
    return NextResponse.json({
      sendingLive: isSendingLive(),
      testInbox: TEST_INBOX,
      rows,
      summary: {
        total: rows.length,
        draft: count('DRAFT'),
        sent: count('SENT'),
        opened: count('OPENED'),
        confirmed: count('CONFIRMED'),
        declined: count('DECLINED'),
        failed: count('FAILED'),
        unsendable: rows.filter((r) => !isValidEmail(r.email)).length,
      },
    })
  } catch (err) {
    console.error('GET /api/directory/credits', err)
    return NextResponse.json({ error: 'Failed to load credit requests' }, { status: 500 })
  }
})

export const POST = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json().catch(() => ({}) as Record<string, unknown>)
    const action = String(body.action ?? '')

    // ── Import from the sheet ──
    if (action === 'import') {
      const url = String(body.sheetUrl ?? DEFAULT_SHEET)
      if (!/^https:\/\/docs\.google\.com\//.test(url)) {
        return NextResponse.json({ error: 'Only a Google Sheets URL can be imported.' }, { status: 400 })
      }
      const res = await fetch(url, { redirect: 'follow' })
      if (!res.ok) {
        return NextResponse.json(
          { error: `The sheet could not be fetched (${res.status}). Is it still link-shared?` },
          { status: 502 }
        )
      }
      const grid = parseCsv(await res.text())
      const [header, ...lines] = grid
      const col = (n: string) => header.findIndex((h) => h.trim().toLowerCase() === n)
      const cTier = col('tier'), cName = col('name'), cSkill = col('skill'),
        cIg = col('instagram'), cEmail = col('email')
      if (cName < 0) {
        return NextResponse.json({ error: 'The sheet has no "Name" column.' }, { status: 400 })
      }

      // Contacts for linking — by email first, handle second.
      const contacts = await prisma.contact.findMany({
        select: { id: true, email: true, instagram: true },
      })
      const byEmail = new Map(contacts.filter((c) => c.email).map((c) => [c.email!.trim().toLowerCase(), c.id]))
      const byHandle = new Map(
        contacts
          .filter((c) => c.instagram)
          .map((c) => [c.instagram!.trim().toLowerCase().replace(/^@+/, ''), c.id])
      )

      const existing = await prisma.creditRequest.findMany({
        select: { id: true, email: true, name: true, instagram: true },
      })
      const seenEmail = new Map(
        existing.filter((r) => r.email).map((r) => [r.email!.trim().toLowerCase(), r.id])
      )
      const seenNameIg = new Map(
        existing.map((r) => [
          `${r.name.trim().toLowerCase()}|${(r.instagram ?? '').trim().toLowerCase()}`,
          r.id,
        ])
      )

      let created = 0, updated = 0, skipped = 0
      for (const line of lines) {
        const name = (line[cName] ?? '').trim()
        const tierRaw = cTier >= 0 ? (line[cTier] ?? '').trim() : ''
        // The sheet repeats its header mid-file; those rows are furniture.
        if (!name || name.toLowerCase() === 'name' || tierRaw.toLowerCase() === 'tier') {
          skipped++
          continue
        }
        const role = cSkill >= 0 ? (line[cSkill] ?? '').trim() || null : null
        const instagram =
          cIg >= 0 ? (line[cIg] ?? '').trim().replace(/^@+/, '') || null : null
        const email = cEmail >= 0 ? (line[cEmail] ?? '').trim().toLowerCase() || null : null
        const tier = /^[123]$/.test(tierRaw) ? Number(tierRaw) : null
        const contactId =
          (email && byEmail.get(email)) ||
          (instagram && byHandle.get(instagram.toLowerCase())) ||
          null

        const matchId =
          (email && seenEmail.get(email)) ||
          seenNameIg.get(`${name.toLowerCase()}|${(instagram ?? '').toLowerCase()}`)

        if (matchId) {
          // Refresh prefill only — a re-import must never touch a response or
          // reset a status someone has already acted on.
          await prisma.creditRequest.update({
            where: { id: matchId },
            data: { name, role, instagram, tier, contactId, email: email ?? undefined },
          })
          updated++
        } else {
          await prisma.creditRequest.create({
            data: { token: newCreditToken(), name, role, instagram, email, tier, contactId },
          })
          created++
        }
      }
      return NextResponse.json({ ok: true, created, updated, skipped })
    }

    // ── Send / resend ──
    if (action === 'send') {
      const ids = Array.isArray(body.ids) ? body.ids.map(String) : []
      if (ids.length === 0) return NextResponse.json({ error: 'Nothing selected.' }, { status: 400 })

      // Links must carry the host the team is actually using, not localhost.
      const proto = request.headers.get('x-forwarded-proto') ?? 'http'
      const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
      const base = process.env.NEXTAUTH_URL || `${proto}://${host}`

      const rows = await prisma.creditRequest.findMany({ where: { id: { in: ids } } })
      let sent = 0
      const failures: { name: string; error: string }[] = []

      for (const row of rows) {
        // A response is final — resending to someone who already answered would
        // read as us having lost it.
        if (row.status === 'CONFIRMED' || row.status === 'DECLINED') continue
        try {
          const result = await sendCreditInvite({
            to: row.email ?? '',
            name: row.name,
            role: row.role,
            link: `${base}/credit/${row.token}`,
          })
          await prisma.creditRequest.update({
            where: { id: row.id },
            data: {
              status: 'SENT',
              sentAt: new Date(),
              sentTo: result.sentTo,
              isTest: result.isTest,
              emailError: null,
              remindedAt: row.sentAt ? new Date() : null,
            },
          })
          sent++
        } catch (err) {
          // One bad address must not stop the rest of the batch.
          await prisma.creditRequest.update({
            where: { id: row.id },
            data: { status: 'FAILED', emailError: String((err as Error).message).slice(0, 500) },
          })
          failures.push({ name: row.name, error: String((err as Error).message) })
        }
      }
      return NextResponse.json({ ok: true, sent, failures, live: isSendingLive() })
    }

    // ── Fix a row before sending ──
    if (action === 'update') {
      const id = String(body.id ?? '')
      if (!id) return NextResponse.json({ error: 'No id.' }, { status: 400 })
      const data: Record<string, unknown> = {}
      if (body.email !== undefined) {
        const email = String(body.email ?? '').trim().toLowerCase()
        if (email && !isValidEmail(email)) {
          return NextResponse.json({ error: 'That email doesn’t look right.' }, { status: 400 })
        }
        data.email = email || null
      }
      if (body.name !== undefined) data.name = String(body.name).trim()
      if (body.instagram !== undefined)
        data.instagram = String(body.instagram).trim().replace(/^@+/, '') || null
      if (body.role !== undefined) data.role = String(body.role).trim() || null
      const row = await prisma.creditRequest.update({ where: { id }, data })
      return NextResponse.json({ ok: true, row: { id: row.id, email: row.email } })
    }

    if (action === 'delete') {
      const id = String(body.id ?? '')
      if (!id) return NextResponse.json({ error: 'No id.' }, { status: 400 })
      await prisma.creditRequest.delete({ where: { id } })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  } catch (err) {
    console.error('POST /api/directory/credits', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
})
