// Keeps the Xero mirror current, unattended.
//
// There is no cron anywhere in this repo, so a "scheduled" sync is a timer
// inside the server process — the same pattern as the credit drip worker, and
// for the same reason: a pm2 restart must not quietly stop it until somebody
// happens to click something.
//
// Fifteen minutes is chosen against Xero's limits rather than against how fresh
// the data feels. A sync with nothing to fetch costs six calls; at four runs an
// hour that is 576 a day against an allowance of 5,000, leaving comfortable
// headroom for the portal, manual syncs and a first full backfill.
//
// ── Backing off ────────────────────────────────────────────────────────────
//
// The first version retried every fifteen minutes no matter what. When the
// Custom Connection's subscription was missing, every run hit a 403 that no
// amount of retrying could fix, and the worker kept knocking: 2,663 failed runs
// between 22 September and 20 October, each one minting a token and spending an
// API call to be told no.
//
// So a failure that needs a human (revoked grant, lapsed subscription, refused
// permission) doubles the wait, up to six hours. A transient failure (Xero
// down, rate limited) keeps the normal cadence, because those clear themselves.
// The first success snaps straight back to fifteen minutes. And a manual sync
// from the admin screen is never throttled by any of this — somebody who has
// just fixed the subscription should see the result immediately, not in six
// hours.

import { isSyncRunning, pruneSyncRuns, runXeroSync } from '@/lib/xero-sync'

const INTERVAL_MS = 15 * 60 * 1000
const MAX_BACKOFF_MS = 6 * 60 * 60 * 1000

// The first run waits, rather than firing at boot. A deploy restarts the
// process; syncing immediately on every restart means a rapid series of
// deploys becomes a rapid series of syncs, which is exactly when you least want
// to be spending the rate limit.
const FIRST_RUN_DELAY_MS = 90 * 1000

let started = false
let delayMs = INTERVAL_MS
let timer: ReturnType<typeof setTimeout> | null = null
let lastPrune = 0

function schedule(ms: number) {
  if (timer) clearTimeout(timer)
  timer = setTimeout(tick, ms)
  // Don't hold the process open on shutdown for the sake of a timer.
  if (typeof timer.unref === 'function') timer.unref()
}

async function tick() {
  try {
    if (!isSyncRunning()) {
      const outcome = await runXeroSync('SCHEDULED')

      if (outcome.status === 'FAILED' && outcome.needsHuman) {
        const next = Math.min(delayMs * 2, MAX_BACKOFF_MS)
        // Log only when the wait changes. Once it reaches the six-hour ceiling
        // the same line every six hours tells nobody anything new.
        if (next !== delayMs) {
          console.error(
            `[xero-worker] needs a human (${outcome.error ?? 'unknown'}); next attempt in ${Math.round(next / 60000)} min`
          )
        }
        delayMs = next
      } else {
        if (delayMs !== INTERVAL_MS && outcome.status !== 'FAILED') {
          console.log('[xero-worker] recovered; back to every 15 minutes')
        }
        // A transient failure keeps the normal cadence — those clear on their
        // own and the next run is the fastest way to find out.
        if (outcome.status !== 'FAILED' || !outcome.needsHuman) delayMs = INTERVAL_MS
      }
    }

    // Once a day is plenty for housekeeping.
    if (Date.now() - lastPrune > 86_400_000) {
      lastPrune = Date.now()
      const removed = await pruneSyncRuns(14)
      if (removed) console.log(`[xero-worker] pruned ${removed} sync runs older than 14 days`)
    }
  } catch (err) {
    // Never let a throw kill the loop. A worker that stops on the first bad
    // night is worse than one that logs and tries again.
    console.error('[xero-worker] tick threw:', err)
  } finally {
    schedule(delayMs)
  }
}

/**
 * Called after a manual sync succeeds, so the schedule does not stay in a long
 * backoff that the human has just fixed.
 */
export function resetXeroBackoff(): void {
  if (!started) return
  delayMs = INTERVAL_MS
  schedule(INTERVAL_MS)
}

export function ensureXeroWorker(): void {
  if (started) return
  started = true
  schedule(FIRST_RUN_DELAY_MS)
  console.log(`[xero-worker] started, syncing every ${INTERVAL_MS / 60000} minutes`)
}
