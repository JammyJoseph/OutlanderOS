import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { rateLimitResponse } from '@/lib/rate-limit'

const STATIC_ASSET =
  /\.(?:ico|png|jpe?g|gif|svg|webp|avif|css|js|map|woff2?|ttf|otf|eot|txt|xml|webmanifest|pdf)$/i

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // API routes: rate-limit per IP, then let the route's own auth helpers run.
  if (pathname.startsWith('/api/')) {
    const limited = rateLimitResponse(request, pathname)
    if (limited) return limited
    return NextResponse.next()
  }

  if (pathname === '/login') return NextResponse.next()
  // Public: reset links are opened by users who can't sign in yet.
  if (pathname === '/reset-password') return NextResponse.next()
  // Public: Google drops the user here after consent to surface the auth code.
  if (pathname === '/auth/google/callback') return NextResponse.next()
  // Public: shared call sheets — crew and talent open these without an account.
  if (pathname.startsWith('/call-sheet/')) return NextResponse.next()
  // Public: invoice submission. Crew aren't OutlanderOS users, so the token in
  // the URL is the credential — see api/invoice/[token]/route.ts.
  if (pathname.startsWith('/invoice/')) return NextResponse.next()
  // Public: contributor credit confirmation — same token-is-credential pattern.
  if (pathname.startsWith('/credit/')) return NextResponse.next()
  // Static assets only. This used to be `pathname.includes('.')`, which let any
  // path containing a period skip the auth check entirely (`/finance/x.y` walked
  // straight past this gate). Match real asset extensions instead.
  if (pathname.startsWith('/_next/') || STATIC_ASSET.test(pathname)) {
    return NextResponse.next()
  }

  const token = request.cookies.get('auth_token')?.value
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    if (!payload.userId) throw new Error('Invalid token')

    // Expired sessions must bounce here. The signature is verified server-side by
    // the pages themselves, but an expired token still decodes and carries a
    // userId — without this check it reaches the page, fails jwt.verify there,
    // and the user sees an empty portal instead of the login screen.
    if (typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now()) {
      const expired = NextResponse.redirect(new URL('/login', request.url))
      expired.cookies.delete('auth_token')
      expired.cookies.delete('must_change_pw')
      return expired
    }

    // First-login lock. Staff created by an admin carry a temporary password and
    // a `must_change_pw` cookie (set at login). Until they set a real password —
    // which clears the cookie in /api/me/password — every page bounces to the
    // change-password screen so they can't reach anything else first.
    if (
      request.cookies.get('must_change_pw')?.value === '1' &&
      pathname !== '/me/change-password'
    ) {
      return NextResponse.redirect(new URL('/me/change-password', request.url))
    }

    if ((pathname.startsWith('/finance') || pathname.startsWith('/admin')) && payload.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/hub', request.url))
    }
  } catch {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
