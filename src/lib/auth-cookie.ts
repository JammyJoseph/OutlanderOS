// Shared options for the auth cookies.
//
// `secure` is derived from NEXTAUTH_URL rather than hardcoded, so local dev
// over plain http still works while production (https since 2026) gets the
// flag automatically.
export function authCookieSecure(): boolean {
  return (process.env.NEXTAUTH_URL ?? '').startsWith('https://')
}

export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30

/**
 * `maxAge: "session"` leaves the expiry off, so the browser drops the cookie
 * when it closes — what "Keep me logged in" unticked means. The token inside
 * still expires after 30 days either way.
 */
export function authCookieOptions(maxAge: number | "session" = AUTH_COOKIE_MAX_AGE) {
  return {
    httpOnly: true,
    // Lax still accompanies top-level navigations, so ordinary links into the
    // portal keep working, while cross-site POSTs no longer carry the session.
    // There is no CSRF token anywhere in the app yet, so this is the only
    // protection against a cross-site form post.
    sameSite: 'lax' as const,
    secure: authCookieSecure(),
    ...(maxAge === "session" ? {} : { maxAge }),
    path: '/',
  }
}
