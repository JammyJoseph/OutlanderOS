import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { rateLimitResponse } from '@/lib/rate-limit'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // API routes: rate-limit per IP, then let the route's own auth helpers run.
  if (pathname.startsWith('/api/')) {
    const limited = rateLimitResponse(request, pathname)
    if (limited) return limited
    return NextResponse.next()
  }

  if (pathname === '/login') return NextResponse.next()
  // Public: Google drops the user here after consent to surface the auth code.
  if (pathname === '/auth/google/callback') return NextResponse.next()
  // Public: shared call sheets — crew and talent open these without an account.
  if (pathname.startsWith('/call-sheet/')) return NextResponse.next()
  if (pathname.startsWith('/_next/') || pathname.includes('.')) return NextResponse.next()

  const token = request.cookies.get('auth_token')?.value
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    if (!payload.userId) throw new Error('Invalid token')

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
