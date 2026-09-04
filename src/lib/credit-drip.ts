// ═══════════════════════════════════════════════════════════════════════════
// The credit sendout, paced.
//
// 239 invites cannot leave in one burst. Gmail's daily ceiling is 2,000 so the
// volume is fine; the problem is that a mailbox emitting 239 near-identical
// messages in five minutes gets filtered, and a filtered invite is a
// contributor who silently never appears in the Directory.
//
// So the queue lives in Postgres, not in a browser tab and not in a job runner
// we don't have: each invite carries `scheduledFor`, and this worker sends
// whatever is due. Consequences worth knowing:
//
//  • Closing the laptop doesn't stop the sendout, and a pm2 restart mid-way
//    resumes it — the schedule is data.
//  • Claiming is a conditional update (QUEUED → SENDING only if still QUEUED),
//    so two ticks can never send the same invite twice.
//  • A row left SENDING by a crash is put back on start; a crash between the
//    SMTP handoff and the status write could in principle re-send one invite,
//    which is a duplicate email — annoying, and far better than a silent gap.
// ═══════════════════════════════════════════════════════════════════════════

import prisma from '@/lib/prisma'
import {
  creditLink,
  isSendingLive,
  isSubmissionOpen,
  sendCreditInvite,
  sendCreditReminder,
} from '@/lib/credit-consent'

const TICK_MS = 60_000
// Per tick, not per hour. The schedule sets the real rate; this only stops one
// tick from emptying a backlog in a burst after a restart.
const MAX_PER_TICK = 3

let started = false

export interface DripResult {
  sent: number
  failed: number
  due: number
  /** True when the queue is holding because the deadline has passed. */
  closed?: boolean
}

/**
 * Sends every invite whose slot has passed, up to `max`. Safe to call from a
 * request handler as well as the ticker — that's how the panel's "send the due
 * ones now" button works.
 */
export async function drainDue(baseUrl: string, max = MAX_PER_TICK): Promise<DripResult> {
  // An invite that lands after the deadline asks someone to do something they
  // can no longer do. The queue stops rather than sending it.
  if (!isSubmissionOpen()) return { sent: 0, failed: 0, due: 0, closed: true }

  const due = await prisma.creditRequest.findMany({
    where: { status: 'QUEUED', scheduledFor: { lte: new Date() } },
    orderBy: { scheduledFor: 'asc' },
    take: max,
  })

  let sent = 0
  let failed = 0

  for (const row of due) {
    // Claim it. If another tick got there first, count says 0 and we skip.
    const claim = await prisma.creditRequest.updateMany({
      where: { id: row.id, status: 'QUEUED' },
      data: { status: 'SENDING' },
    })
    if (claim.count !== 1) continue

    try {
      const result = await sendCreditInvite({
        to: row.email ?? '',
        name: row.name,
        role: row.role,
        link: creditLink({ fallbackBase: baseUrl, token: row.token }),
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
      // One bad address must not stall the queue behind it.
      await prisma.creditRequest.update({
        where: { id: row.id },
        data: {
          status: 'FAILED',
          emailError: String((err as Error).message).slice(0, 500),
          scheduledFor: null,
        },
      })
      failed++
    }
  }

  return { sent, failed, due: due.length }
}

/**
 * Sends reminders that have come due.
 *
 * The selection that matters happens HERE, not when the pass was scheduled: a
 * row is skipped if it has been answered since, so "everyone who still hasn't
 * done it" means at the moment of sending. Scheduling stamps all 150; by
 * Saturday morning most of them may have answered and will be passed over
 * silently.
 *
 * A failed reminder does not mark the row FAILED. They already received the
 * invite, and losing their delivered status because a nudge bounced would make
 * the tracker lie about the thing that matters.
 */
export async function drainDueReminders(baseUrl: string, max = MAX_PER_TICK): Promise<DripResult> {
  if (!isSubmissionOpen()) return { sent: 0, failed: 0, due: 0, closed: true }

  const due = await prisma.creditRequest.findMany({
    where: {
      remindAt: { lte: new Date() },
      respondedAt: null,
      status: { in: ['SENT', 'OPENED'] },
    },
    orderBy: { remindAt: 'asc' },
    take: max,
  })

  let sent = 0
  let failed = 0

  for (const row of due) {
    // Claim by clearing the slot, conditional on it still being set and the
    // person still not having answered.
    const claim = await prisma.creditRequest.updateMany({
      where: { id: row.id, remindAt: { not: null }, respondedAt: null },
      data: { remindAt: null },
    })
    if (claim.count !== 1) continue

    try {
      await sendCreditReminder({
        to: row.email ?? '',
        name: row.name,
        link: creditLink({ fallbackBase: baseUrl, token: row.token }),
      })
      await prisma.creditRequest.update({
        where: { id: row.id },
        data: { remindedAt: new Date(), emailError: null },
      })
      sent++
    } catch (err) {
      await prisma.creditRequest.update({
        where: { id: row.id },
        data: { emailError: `Reminder failed. ${String((err as Error).message).slice(0, 400)}` },
      })
      failed++
    }
  }

  return { sent, failed, due: due.length }
}

/**
 * Starts the ticker once per process. Called lazily from the credits route, so
 * no work happens on a server that never opens the panel.
 */
export function ensureDripWorker(baseUrl: string): void {
  if (started) return
  started = true

  // A row stuck in SENDING means the process died mid-send. Put it back rather
  // than leaving an invite that never goes out and never reports why.
  void prisma.creditRequest
    .updateMany({
      where: { status: 'SENDING' },
      data: { status: 'QUEUED' },
    })
    .then((r) => {
      if (r.count > 0) console.log(`[credit-drip] requeued ${r.count} interrupted send(s)`)
    })
    .catch((e) => console.error('[credit-drip] requeue failed', e))

  const tick = async () => {
    try {
      const result = await drainDue(baseUrl)
      if (result.sent > 0 || result.failed > 0) {
        console.log(
          `[credit-drip] sent ${result.sent}, failed ${result.failed}${isSendingLive() ? '' : ' (test mode)'}`
        )
      }
    } catch (err) {
      console.error('[credit-drip] tick failed', err)
    }
    try {
      const reminders = await drainDueReminders(baseUrl)
      if (reminders.sent > 0 || reminders.failed > 0) {
        console.log(
          `[credit-drip] reminded ${reminders.sent}, failed ${reminders.failed}${isSendingLive() ? '' : ' (test mode)'}`
        )
      }
    } catch (err) {
      console.error('[credit-drip] reminder tick failed', err)
    }
  }

  const timer = setInterval(tick, TICK_MS)
  // Don't hold the process open on shutdown for the sake of a timer.
  if (typeof timer.unref === 'function') timer.unref()
  void tick()
  console.log('[credit-drip] worker started')
}
