import { hasToken } from '@/lib/token-store'
import SettingsClient from './SettingsClient'

export default async function AdminSettingsPage() {
  const primaryConnected = hasToken('google_primary')
  const billingConnected = hasToken('google_billing')
  const xeroConnected = hasToken('xero')

  return (
    <SettingsClient
      initialPrimary={primaryConnected}
      initialBilling={billingConnected}
      initialXeroConnected={xeroConnected}
    />
  )
}
