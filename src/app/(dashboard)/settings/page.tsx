import { cookies } from 'next/headers'
import SettingsClient from './SettingsClient'

export default async function SettingsPage() {
  const cookieStore = await cookies()
  const primaryConnected = cookieStore.has('google_primary_token')
  const billingConnected = cookieStore.has('google_billing_token')

  return (
    <SettingsClient
      initialPrimary={primaryConnected}
      initialBilling={billingConnected}
    />
  )
}
