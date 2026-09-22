// Keeps the Xero mirror current, unattended.
//
// There is no cron anywhere in this repo, so a "scheduled" sync is an interval
// inside the server process — the same pattern as the credit drip worker, and
// for the same reason: a pm2 restart must not quietly stop it until somebody
// happens to click something.
//
// Fifteen minutes is chosen against Xero's limits rather than against how fresh
// the data feels. A sync with nothing to fetch costs six calls; at four runs an
// hour that is 576 a day against an allowance of 5,000, leaving comfortable
// headroom for the portal, manual syncs and a first full backfill. Dropping to
// five minutes would triple that for numbers nobody refreshes that often — a
// bill entered in Xero at 11:02 being visible at 11:15 is not a business
// problem, and an exhausted rate limit is.

import { isSyncRunning, runXeroSync } from '@/lib/xero-sync'

const INTERVAL_MS = 15 * 60 * 1000

// The first run waits, rather than firing at boot. A deploy restarts the
// process; syncing immediately on every restart means a rapid series of
// deploys becomes a rapid series of syncs, which is exactly when you least want
// to be spending the rate limit.
const FIRST_RUN_DELAY_MS = 90 * 1000

let started = false

export function ensureXeroWorker(): void {
  if (started) return
  started = true

  const tick = async () => {
    if (isSyncRunning()) return
    try {
      const outcome = await runXeroSync('SCHEDULED')
      // Silence on success is deliberate — a log line every fifteen minutes
      // for four years buries the ones that matter. runXeroSync already logs
      // its own summary, and failures are recorded on XeroSyncRun where the
      // dashboard can show them.
      if (outcome.status === 'FAILED') {
        console.error(`[xero-worker] sync failed: ${outcome.error ?? 'unknown'}`)
      }
    } catch (err) {
      // Never let a throw here kill the interval. A worker that stops on the
      // first bad night is worse than one that logs and tries again.
      console.error('[xero-worker] tick threw:', err)
    }
  }

  const first = setTimeout(tick, FIRST_RUN_DELAY_MS)
  const timer = setInterval(tick, INTERVAL_MS)
  // Don't hold the process open on shutdown for the sake of a timer.
  if (typeof first.unref === 'function') first.unref()
  if (typeof timer.unref === 'function') timer.unref()

  console.log(`[xero-worker] started, syncing every ${INTERVAL_MS / 60000} minutes`)
}
