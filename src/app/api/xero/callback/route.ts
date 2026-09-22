import { NextRequest, NextResponse } from 'next/server'
import { completeXeroConnect } from '@/lib/xero'
import { runXeroSync } from '@/lib/xero-sync'

// Where Xero sends the browser back after consent.
//
// Unauthenticated by necessity — it is Xero's redirect, not a staff request —
// so the CSRF state cookie set by /connect is the only thing establishing that
// this flow was started by one of our admins. No state, no connection.
//
// Every redirect here is RELATIVE. Building one from `request.url` behind nginx
// resolves to the address the app listens on rather than the hostname the
// browser asked for, and staples the forwarded scheme to it — that is exactly
// how a successful Google OAuth ended on an ERR_SSL_PROTOCOL_ERROR page at
// https://localhost:3000. See AGENTS.md, "Redirects from API routes".
function back(path: string) {
  return new NextResponse(null, { status: 307, headers: { Location: path } })
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const denied = searchParams.get('error')

  if (denied) return back(`/admin/settings?xero_error=${encodeURIComponent(denied)}`)
  if (!code) return back('/admin/settings?xero_error=no_code')

  const expected = request.cookies.get('xero_oauth_state')?.value
  if (!expected || !state || state !== expected) {
    return back('/admin/settings?xero_error=state_mismatch')
  }

  const [userId, name] = (request.cookies.get('xero_oauth_by')?.value ?? '').split('|')

  try {
    const { tenantName } = await completeXeroConnect(code, {
      userId: userId || undefined,
      name: name || undefined,
    })

    // First sync immediately, so the finance portal has real numbers by the
    // time the admin lands back on it. Deliberately not awaited past its own
    // error handling — a slow first pull must not hang the redirect.
    void runXeroSync('CONNECT').catch((e) => console.error('[xero] first sync failed:', e))

    const response = back(
      `/admin/settings?xero_connected=${encodeURIComponent(tenantName)}`
    )
    response.cookies.delete('xero_oauth_state')
    response.cookies.delete('xero_oauth_by')
    return response
  } catch (err) {
    console.error('[xero] callback failed:', err)
    const message = err instanceof Error ? err.message : 'callback_failed'
    return back(`/admin/settings?xero_error=${encodeURIComponent(message.slice(0, 120))}`)
  }
}
