import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { withAdminDb } from '@/lib/auth'
import { xeroConsentUrl, xeroMode } from '@/lib/xero'

// Starts the Xero consent flow.
//
// ADMIN ONLY, and via withAdminDb rather than withAdmin: the JWT bakes `role`
// in at login, so somebody promoted to admin this morning still carries MEMBER
// until they sign in again. There is exactly one Xero connection for the whole
// company and connecting overwrites it, so this is the wrong door to guard with
// a stale claim.
export const GET = withAdminDb(async (_request, _context, user) => {
  try {
    // A Custom Connection has no consent flow. Sending somebody to Xero's
    // authorize screen with these credentials produces an unhelpful error on
    // Xero's side, so refuse here where the reason can be explained.
    if (xeroMode() === 'CUSTOM') {
      return NextResponse.json(
        {
          ok: false,
          mode: 'CUSTOM',
          error:
            'This install uses a Xero Custom Connection, which needs no consent click. ' +
            'It authenticates from the client id and secret alone. If Xero reports no ' +
            'organisation, authorise the app against the Outlander organisation in the ' +
            'Xero developer portal.',
        },
        { status: 400 }
      )
    }

    // CSRF: a random state echoed back by Xero and checked in the callback,
    // in a short-lived httpOnly cookie. Without it, anyone who can make an
    // admin's browser hit the callback can bind this company's OutlanderOS to
    // a Xero organisation of their choosing.
    const state = crypto.randomBytes(24).toString('base64url')

    const response = NextResponse.redirect(xeroConsentUrl(state))
    response.cookies.set('xero_oauth_state', state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: (process.env.NEXTAUTH_URL || '').startsWith('https://'),
      maxAge: 600,
      path: '/',
    })
    // Who to attribute the connection to, read back in the callback. Not
    // sensitive, but it rides the same 10-minute window.
    response.cookies.set('xero_oauth_by', `${user.userId}|${user.name ?? ''}`, {
      httpOnly: true,
      sameSite: 'lax',
      secure: (process.env.NEXTAUTH_URL || '').startsWith('https://'),
      maxAge: 600,
      path: '/',
    })
    return response
  } catch (err) {
    console.error('[xero] connect failed:', err)
    return new NextResponse(null, {
      status: 307,
      headers: { Location: '/admin/settings?xero_error=connect_failed' },
    })
  }
})

// Drops the stored connection.
//
// The Disconnect button used to call `setXeroConnected(false)` and nothing
// else — it changed a variable in the browser. The tokens stayed in storage,
// the sync worker carried on using them, and a page refresh put the green
// "Connected" pill straight back. A control that reports success while doing
// nothing is worse than no control.
export const DELETE = withAdminDb(async () => {
  const { disconnectXero } = await import('@/lib/xero')
  await disconnectXero()
  return NextResponse.json({ ok: true, connected: false })
})
