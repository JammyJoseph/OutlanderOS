// Runs once per server instance, before requests are served.
//
// It exists for one reason: the credit sendout is paced over hours, and a
// deploy or a pm2 restart lands in the middle of one. Starting the drip worker
// only when somebody opens the credits panel would mean a restart at 2pm
// quietly stops the queue until a human happens to look — a stalled sendout
// that reports nothing, which is the failure mode this codebase has been
// bitten by before.
//
// Keep this cheap. `register` must finish before the server is ready, so it
// starts a timer and returns; no awaiting database work here.

export async function register() {
  // Also invoked for the edge runtime, which has no Prisma and no timers worth
  // starting. The dynamic import below must not be reached there.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  // The Xero mirror goes stale on its own, so its worker starts regardless of
  // whether NEXTAUTH_URL is set — unlike the drip, it builds no links and needs
  // no host. It is also the only thing keeping the finance portal's numbers
  // current, and "current" is the entire claim the portal makes.
  const { ensureXeroWorker } = await import('@/lib/xero-worker')
  ensureXeroWorker()

  const base = process.env.NEXTAUTH_URL
  // Without a base URL an invite link can't be built. The panel starts the
  // worker with a request-derived host instead, so this isn't fatal.
  if (!base) return

  const { ensureDripWorker } = await import('@/lib/credit-drip')
  ensureDripWorker(base)
}
