// ═══════════════════════════════════════════════════════════════════════════
// The staff roundup: where the credit sendout stands, emailed to the people
// running it.
//
// Written to be read on a phone at five o'clock. Numbers first, then the only
// part anyone can act on, which is the list of names still outstanding. The
// people who are in need no listing beyond a count — nobody chases them.
//
// It reports what is true when it fires, not when it was scheduled, for the
// same reason the reminder passes do.
// ═══════════════════════════════════════════════════════════════════════════

import prisma from '@/lib/prisma'
import { sendMail, isMailConfigured } from '@/lib/mailer'
import { deadlineLabel, isSubmissionOpen } from '@/lib/credit-consent'

const EMAIL_OK = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

const when = (d: Date | null) =>
  d
    ? new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/London',
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(d)
    : 'never'

export interface Roundup {
  subject: string
  text: string
  html: string
  counts: Record<string, number>
}

export async function buildRoundup(): Promise<Roundup> {
  const rows = await prisma.creditRequest.findMany({
    orderBy: [{ tier: 'asc' }, { name: 'asc' }],
    select: {
      name: true,
      tier: true,
      role: true,
      email: true,
      instagram: true,
      status: true,
      sentAt: true,
      openedAt: true,
      remindedAt: true,
      respondedAt: true,
      printConsent: true,
      confirmedName: true,
      confirmedRole: true,
      confirmedBio: true,
    },
  })

  const reachable = (r: (typeof rows)[number]) => !!r.email && EMAIL_OK.test(r.email)
  const confirmed = rows.filter((r) => r.status === 'CONFIRMED' && r.printConsent)
  const declined = rows.filter((r) => r.status === 'DECLINED')
  const unreachable = rows.filter((r) => !reachable(r))
  const outstanding = rows.filter((r) => !r.respondedAt && reachable(r))
  const opened = outstanding.filter((r) => r.openedAt)
  const neverOpened = outstanding.filter((r) => !r.openedAt)

  const lastReminder = rows
    .map((r) => r.remindedAt)
    .filter((d): d is Date => !!d)
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null
  const remindedCount = rows.filter((r) => r.remindedAt).length

  const byTier = (list: typeof rows) =>
    [1, 2, 3, null]
      .map((t) => `tier ${t ?? '-'}: ${list.filter((r) => r.tier === t).length}`)
      .join(', ')

  const counts = {
    total: rows.length,
    confirmed: confirmed.length,
    declined: declined.length,
    outstanding: outstanding.length,
    unreachable: unreachable.length,
    opened: opened.length,
    neverOpened: neverOpened.length,
  }

  const pct = rows.length ? Math.round((confirmed.length / (rows.length - unreachable.length)) * 100) : 0

  const line = (r: (typeof rows)[number]) =>
    `  tier ${r.tier ?? '-'}  ${r.name}${r.role ? ` (${r.role})` : ''}  ${r.email}  ` +
    `invited ${when(r.sentAt)}${r.remindedAt ? `, reminded ${when(r.remindedAt)}` : ''}` +
    `${r.openedAt ? ', opened it' : ', never opened'}`

  const text = [
    `The Outlander Directory, credit confirmations as of ${when(new Date())}.`,
    '',
    `Confirmed          ${confirmed.length}   (${pct} per cent of everyone reachable)`,
    `Still outstanding  ${outstanding.length}   (${opened.length} opened the link, ${neverOpened.length} never did)`,
    `Declined           ${declined.length}`,
    `No usable address  ${unreachable.length}`,
    `On the list        ${rows.length}`,
    '',
    `Confirmed by tier. ${byTier(confirmed)}`,
    `Outstanding by tier. ${byTier(outstanding)}`,
    '',
    `Deadline ${deadlineLabel()}, ${isSubmissionOpen() ? 'still open' : 'now closed'}.`,
    `Last reminder went out ${when(lastReminder)}. ${remindedCount} people have had at least one.`,
    '',
    `STILL OUTSTANDING (${outstanding.length})`,
    ...(outstanding.length ? outstanding.map(line) : ['  nobody, everyone reachable has answered']),
    '',
    `NO WAY TO REACH THESE (${unreachable.length})`,
    ...(unreachable.length
      ? unreachable.map(
          (r) =>
            `  tier ${r.tier ?? '-'}  ${r.name}  ${r.instagram ? `@${r.instagram}` : 'no handle either'}`
        )
      : ['  none']),
    '',
    ...(declined.length ? [`DECLINED (${declined.length})`, ...declined.map((r) => `  ${r.name}`), ''] : []),
    'Sent by OutlanderOS. The live sheet has the full detail.',
  ].join('\n')

  const esc = (v: string) =>
    v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const row = (r: (typeof rows)[number]) => `
      <tr>
        <td style="padding:4px 10px 4px 0;color:#6b6b6b">${r.tier ?? '-'}</td>
        <td style="padding:4px 10px 4px 0"><strong>${esc(r.name)}</strong>${r.role ? ` <span style="color:#6b6b6b">${esc(r.role)}</span>` : ''}</td>
        <td style="padding:4px 10px 4px 0;color:#6b6b6b">${esc(r.email ?? '')}</td>
        <td style="padding:4px 0;color:#6b6b6b">${r.openedAt ? 'opened' : 'never opened'}</td>
      </tr>`

  const html = `
  <div style="font-family:Helvetica,Arial,sans-serif;max-width:720px;margin:0 auto;color:#141414;font-size:15px;line-height:1.6">
    <p style="margin:24px 0 0;letter-spacing:.14em;font-size:11px;font-weight:700;color:#9a9a9a">THE OUTLANDER DIRECTORY</p>
    <h1 style="margin:10px 0 0;font-size:22px">Credit confirmations, ${when(new Date())}</h1>

    <table style="margin:20px 0 0;border-collapse:collapse;font-size:15px">
      <tr><td style="padding:3px 16px 3px 0">Confirmed</td><td><strong style="font-size:18px">${confirmed.length}</strong> <span style="color:#6b6b6b">${pct} per cent of everyone reachable</span></td></tr>
      <tr><td style="padding:3px 16px 3px 0">Still outstanding</td><td><strong>${outstanding.length}</strong> <span style="color:#6b6b6b">${opened.length} opened the link, ${neverOpened.length} never did</span></td></tr>
      <tr><td style="padding:3px 16px 3px 0">Declined</td><td>${declined.length}</td></tr>
      <tr><td style="padding:3px 16px 3px 0">No usable address</td><td>${unreachable.length}</td></tr>
      <tr><td style="padding:3px 16px 3px 0">On the list</td><td>${rows.length}</td></tr>
    </table>

    <p style="margin:18px 0 0;font-size:14px;color:#6b6b6b">
      Confirmed by tier. ${byTier(confirmed)}<br>
      Outstanding by tier. ${byTier(outstanding)}
    </p>

    <p style="margin:18px 0 0;font-size:14px">
      Deadline <strong>${deadlineLabel()}</strong>, ${isSubmissionOpen() ? 'still open' : 'now closed'}.<br>
      Last reminder went out <strong>${when(lastReminder)}</strong>. ${remindedCount} people have had at least one.
    </p>

    <h2 style="margin:26px 0 0;font-size:15px">Still outstanding (${outstanding.length})</h2>
    ${
      outstanding.length
        ? `<table style="margin:8px 0 0;border-collapse:collapse;font-size:13px">${outstanding.map(row).join('')}</table>`
        : '<p style="margin:8px 0 0;font-size:13px;color:#6b6b6b">Nobody. Everyone reachable has answered.</p>'
    }

    <h2 style="margin:26px 0 0;font-size:15px">No way to reach these (${unreachable.length})</h2>
    <p style="margin:8px 0 0;font-size:13px;color:#6b6b6b">
      ${
        unreachable.length
          ? unreachable
              .map(
                (r) =>
                  `tier ${r.tier ?? '-'} ${esc(r.name)} ${r.instagram ? `@${esc(r.instagram)}` : '(no handle either)'}`
              )
              .join('<br>')
          : 'None.'
      }
    </p>

    ${
      declined.length
        ? `<h2 style="margin:26px 0 0;font-size:15px">Declined (${declined.length})</h2>
    <p style="margin:8px 0 0;font-size:13px;color:#6b6b6b">${declined.map((r) => esc(r.name)).join('<br>')}</p>`
        : ''
    }

    <p style="margin:28px 0 40px;font-size:12px;color:#9a9a9a">Sent by OutlanderOS. The live sheet has the full detail.</p>
  </div>`

  const subject = `Directory credits. ${confirmed.length} in, ${outstanding.length} outstanding${
    isSubmissionOpen() ? '' : ', deadline passed'
  }`

  return { subject, text, html, counts }
}

/**
 * Sends the roundup. Returns rather than throws, so a failed report can never
 * take down the tick that also sends contributor reminders.
 */
export async function sendRoundup(
  recipients: string[]
): Promise<{ sent: boolean; to?: string[]; error?: string }> {
  const to = recipients.map((r) => r.trim()).filter((r) => EMAIL_OK.test(r))
  if (to.length === 0) return { sent: false, error: 'No valid recipients.' }
  if (!isMailConfigured()) return { sent: false, error: 'Mail is not configured.' }

  try {
    const report = await buildRoundup()
    await sendMail({ to: to.join(', '), subject: report.subject, text: report.text, html: report.html })
    console.log(`[credit-roundup] sent to ${to.join(', ')} — ${JSON.stringify(report.counts)}`)
    return { sent: true, to }
  } catch (err) {
    const message = String((err as Error).message).slice(0, 400)
    console.error('[credit-roundup] failed', message)
    return { sent: false, error: message }
  }
}
