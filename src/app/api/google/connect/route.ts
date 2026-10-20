import { NextRequest, NextResponse } from 'next/server'
import { getAuthUrl } from '@/lib/google-client'
import { withAdmin } from '@/lib/auth'
import { isSharedGoogleAccount, signOAuthState } from '@/lib/oauth-state'

// Starts connecting one of the shared Google accounts (the dashboard calendar).
// Admin-only — whoever connects one decides whose mail and calendar the whole
// team's dashboard reads — and the account must be one we know about, because
// the label becomes a token-store key and a cookie name in the callback.
export const GET = withAdmin(async (request: NextRequest, _ctx, user) => {
  const label = request.nextUrl.searchParams.get('label') || 'primary'
  if (!isSharedGoogleAccount(label)) {
    return NextResponse.json({ error: 'Unknown account' }, { status: 400 })
  }
  // Google's own consent URL, so an absolute redirect is right here.
  return NextResponse.redirect(getAuthUrl(signOAuthState({ userId: user.userId, account: label })))
})
