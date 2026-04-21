import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname === '/login' || pathname.startsWith('/api/')) return NextResponse.next()
  if (pathname.startsWith('/_next/') || pathname.includes('.')) return NextResponse.next()

  const token = request.cookies.get('auth_token')?.value
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    if (!payload.userId) throw new Error('Invalid token')

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
