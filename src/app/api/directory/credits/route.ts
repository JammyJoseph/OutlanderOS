import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/auth'
import { parseCsv } from '@/lib/shopify-csv'
import {
  bioLimitForTier,
  creditLink,
  creditPublicBase,
  deadlineLabel,
  DEFAULT_PER_HOUR,
  isSubmissionOpen,
  submissionDeadline,
  isSendingLive,
  isValidEmail,
  newCreditToken,
  sendCreditInvite,
  sendSlots,
  TEST_INBOX,
} from '@/lib/credit-consent'
import { drainDue, ensureDripWorker } from '@/lib/credit-drip'

// Staff-side of the credit consent flow. One route, explicit actions:
//
//   GET               → every request + summary + whether sending is live
//   POST {action:"import"}          → pull the Google Sheet, upsert DRAFT rows
//   POST {action:"send", ids}       → send (or resend) invites — batched
//   POST {action:"add", name, email, ...} → one person, typed in by hand
//   POST {action:"update", id, ...} → fix a row's email/name before sending
//   POST {action:"delete", id}      → remove a row that shouldn't exist
//   POST {action:"schedule", ids, perHour}  → pace invites across working hours
//   POST {action:"unschedule", ids}         → take them back off the queue
//   POST {action:"drain"}                   → send whatever is already due, now
//   GET  ?export=designer                   → the printable payload as CSV
//
// The send action carries no "test" parameter, deliberately. Test vs live is
// decided by the environment (CREDIT_SEND_LIVE), never by the caller — see
// lib/credit-consent.ts for why.

const DEFAULT_SHEET =
  'https://docs.google.com/spreadsheets/d/1mxaRkhdruo9A_v-V7UEX9QxZ2UPS0J25Ef22OGqPqZc/export?format=csv'

export const GET = withAuth(async (request: NextRequest) => {
  try {
    // The paced sendout runs in this process. Starting it here means a server
    // that never opens the panel never runs a timer, and opening the panel is
    // enough to pick a schedule back up after a restart.
    const proto = request.headers.get('x-forwarded-proto') ?? 'http'
    const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
    ensureDripWorker(process.env.NEXTAUTH_URL || `${proto}://${host}`)

    const rows = await prisma.creditRequest.findMany({
      orderBy: [{ tier: 'asc' }, { name: 'asc' }],
      select: {
        id: true, contactId: true, token: true, name: true, role: true,
        instagram: true, email: true, tier: true, status: true,
        scheduledFor: true,
        sentAt: true, sentTo: true, isTest: true, emailError: true,
        openedAt: true, respondedAt: true,
        confirmedName: true, confirmedRole: true, confirmedBio: true,
        confirmedInstagram: true, confirmedEmail: true,
        // The address is included here — this endpoint is staff-auth'd and the
        // response drawer is where delivery details are read. It goes no
        // further: not to the public endpoint, not into the printed export.
        address: true,
        agreementAcceptedAt: true, agreementVersion: true,
        printConsent: true, declineNote: true,
      },
    })

    // The designer needs one flat list of what actually prints — and nothing
    // else. No email, no postal address: those exist for delivery, and a file
    // that travels between companies should not carry them.
    if (request.nextUrl.searchParams.get('export') === 'designer') {
      const printable = rows
        .filter((r) => r.status === 'CONFIRMED' && r.printConsent)
        .sort((a, b) => (a.tier ?? 9) - (b.tier ?? 9) || a.name.localeCompare(b.name))
      const cell = (v: unknown) => {
        const t = v == null ? '' : String(v)
        return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
      }
      const csv = [
        ['Tier', 'Name in print', 'Discipline', 'Instagram', 'Description', 'Characters'].join(','),
        ...printable.map((r) =>
          [
            r.tier ?? '',
            r.confirmedName ?? r.name,
            r.confirmedRole ?? '',
            r.confirmedInstagram ? `@${r.confirmedInstagram}` : '',
            r.confirmedBio ?? '',
            r.confirmedBio ? [...r.confirmedBio].length : '',
          ]
            .map(cell)
            .join(',')
        ),
      ].join('\n')
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="outlander-directory-credits.csv"`,
        },
      })
    }

    const count = (s: string) => rows.filter((r) => r.status === s).length
    const queuedRows = rows.filter((r) => r.status === 'QUEUED' || r.status === 'SENDING')
    const nextDue = queuedRows
      .map((r) => r.scheduledFor)
      .filter((d): d is Date => !!d)
      .sort((a, b) => a.getTime() - b.getTime())[0]
    return NextResponse.json({
      sendingLive: isSendingLive(),
      testInbox: TEST_INBOX,
      // Null means invites carry whatever host generated them rather than the
      // public domain — the panel says so out loud.
      publicBase: creditPublicBase(),
      deadline: {
        at: submissionDeadline().toISOString(),
        label: deadlineLabel(),
        open: isSubmissionOpen(),
      },
      defaultPerHour: DEFAULT_PER_HOUR,
      queue: {
        queued: queuedRows.length,
        nextDue: nextDue ? nextDue.toISOString() : null,
        lastOf: queuedRows
          .map((r) => r.scheduledFor)
          .filter((d): d is Date => !!d)
          .sort((a, b) => b.getTime() - a.getTime())[0]
          ?.toISOString() ?? null,
      },
      // The description limit travels with the row so the panel never has to
      // restate the tier rule — one definition, in credit-consent.ts.
      rows: rows.map((r) => ({ ...r, bioLimit: bioLimitForTier(r.tier) })),
      summary: {
        total: rows.length,
        draft: count('DRAFT'),
        sent: count('SENT'),
        opened: count('OPENED'),
        confirmed: count('CONFIRMED'),
        queued: queuedRows.length,
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

    const wProto = request.headers.get('x-forwarded-proto') ?? 'http'
    const wHost = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
    ensureDripWorker(process.env.NEXTAUTH_URL || `${wProto}://${wHost}`)

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
            link: creditLink({ fallbackBase: base, token: row.token }),
          })
          await prisma.creditRequest.update({
            where: { id: row.id },
            data: {
              status: 'SENT',
              sentAt: new Date(),
              sentTo: result.sentTo,
              isTest: result.isTest,
              emailError: null,
              scheduledFor: null,
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

    // ── Pace a sendout ──
    // Nothing is emailed here. Each invite is stamped with the moment it is due
    // and the worker takes it from there, so a rate can be changed, paused, or
    // resumed after a restart without anybody watching a tab.
    if (action === 'schedule') {
      const ids = Array.isArray(body.ids) ? body.ids.map(String) : []
      if (ids.length === 0) return NextResponse.json({ error: 'Nothing selected.' }, { status: 400 })
      const perHour = Math.max(1, Math.min(120, Number(body.perHour) || DEFAULT_PER_HOUR))

      // Only rows that can actually be sent: a signed or declined response is
      // final, and a row without a valid address would just fail on its slot.
      const rows = await prisma.creditRequest.findMany({
        where: { id: { in: ids }, status: { in: ['DRAFT', 'FAILED', 'QUEUED'] } },
        orderBy: [{ tier: 'asc' }, { name: 'asc' }],
      })
      const sendable = rows.filter((r) => isValidEmail(r.email))
      const slots = sendSlots(sendable.length, perHour)

      for (let i = 0; i < sendable.length; i++) {
        await prisma.creditRequest.update({
          where: { id: sendable[i].id },
          data: { status: 'QUEUED', scheduledFor: slots[i], emailError: null },
        })
      }
      return NextResponse.json({
        ok: true,
        queued: sendable.length,
        skipped: rows.length - sendable.length,
        perHour,
        firstAt: slots[0]?.toISOString() ?? null,
        lastAt: slots[slots.length - 1]?.toISOString() ?? null,
      })
    }

    if (action === 'unschedule') {
      const ids = Array.isArray(body.ids) ? body.ids.map(String) : []
      const where = ids.length > 0 ? { id: { in: ids }, status: 'QUEUED' } : { status: 'QUEUED' }
      const done = await prisma.creditRequest.updateMany({
        where,
        data: { status: 'DRAFT', scheduledFor: null },
      })
      return NextResponse.json({ ok: true, paused: done.count })
    }

    // Sends whatever is already due, without waiting for the next tick. Used by
    // the panel's "send due now" button and to prove a schedule works.
    if (action === 'drain') {
      const proto = request.headers.get('x-forwarded-proto') ?? 'http'
      const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
      const base = process.env.NEXTAUTH_URL || `${proto}://${host}`
      const max = Math.max(1, Math.min(25, Number(body.max) || 5))
      const result = await drainDue(base, max)
      return NextResponse.json({ ok: true, ...result, live: isSendingLive() })
    }

    // ── Add one person by hand ──
    // The sheet is the bulk source, but people join late, and re-editing a
    // Google Sheet to add one name is the long way round.
    if (action === 'add') {
      const name = String(body.name ?? '').trim()
      if (!name) return NextResponse.json({ error: 'A name is required.' }, { status: 400 })
      const email = String(body.email ?? '').trim().toLowerCase() || null
      if (email && !isValidEmail(email)) {
        return NextResponse.json({ error: 'That email doesn’t look right.' }, { status: 400 })
      }
      const duplicate = email
        ? await prisma.creditRequest.findFirst({ where: { email } })
        : await prisma.creditRequest.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } })
      if (duplicate) {
        return NextResponse.json(
          { error: `${duplicate.name} is already on the list (${duplicate.status.toLowerCase()}).` },
          { status: 409 }
        )
      }
      const row = await prisma.creditRequest.create({
        data: {
          token: newCreditToken(),
          name,
          email,
          role: String(body.role ?? '').trim() || null,
          instagram: String(body.instagram ?? '').trim().replace(/^@+/, '') || null,
          tier: /^[123]$/.test(String(body.tier ?? '')) ? Number(body.tier) : null,
        },
      })
      return NextResponse.json({ ok: true, id: row.id })
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
