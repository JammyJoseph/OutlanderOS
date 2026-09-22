import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { withAdminDb } from '@/lib/auth'
import { xeroConsentUrl } from '@/lib/xero'

// Starts the Xero consent flow.
//
// ADMIN ONLY, and via withAdminDb rather than withAdmin: the JWT bakes `role`
// in at login, so somebody promoted to admin this morning still carries MEMBER
// until they sign in again. There is exactly one Xero connection for the whole
// company and connecting overwrites it, so this is the wrong door to guard with
// a stale claim.
export const GET = withAdminDb(async (_request, _context, user) => {
  try {
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
