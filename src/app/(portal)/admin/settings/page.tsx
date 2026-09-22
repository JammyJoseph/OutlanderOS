import { hasToken } from '@/lib/token-store'
import prisma from '@/lib/prisma'
import SettingsClient from './SettingsClient'

export default async function AdminSettingsPage() {
  const primaryConnected = hasToken('google_primary')
  const billingConnected = hasToken('google_billing')

  // Xero's connection lives in Postgres now, not `.tokens.json`. Reading the
  // old file here would report the expired July token as a live connection —
  // the page would say "Connected" over a portal showing zeros, which is the
  // most misleading thing this screen could do. `lastError` set means the
  // grant was rejected and a human has to re-consent.
  const xero = await prisma.xeroConnection.findUnique({
    where: { id: 'singleton' },
    select: { lastError: true },
  })
  const xeroConnected = !!xero && !xero.lastError

  return (
    <SettingsClient
      initialPrimary={primaryConnected}
      initialBilling={billingConnected}
      initialXeroConnected={xeroConnected}
    />
  )
}
