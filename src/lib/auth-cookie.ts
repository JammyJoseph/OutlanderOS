// Shared options for the auth cookies.
//
// `secure` is derived from NEXTAUTH_URL rather than hardcoded, because
// production is currently served over plain HTTP on a bare IP with no
// certificate. Setting `secure: true` there would stop the browser sending the
// cookie at all and lock everyone out. Deriving it means the flag switches
// itself on the moment the site is served over https — no code change, and no
// window where the cookie is marked secure on a site that can't offer TLS.
//
// See docs/BACKLOG.md §0 — TLS is the blocking item here.
export function authCookieSecure(): boolean {
  return (process.env.NEXTAUTH_URL ?? '').startsWith('https://')
}

export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30

export function authCookieOptions(maxAge: number = AUTH_COOKIE_MAX_AGE) {
  return {
    httpOnly: true,
    // Lax still accompanies top-level navigations, so ordinary links into the
    // portal keep working, while cross-site POSTs no longer carry the session.
    // There is no CSRF token anywhere in the app yet, so this is the only
    // protection against a cross-site form post.
    sameSite: 'lax' as const,
    secure: authCookieSecure(),
    maxAge,
    path: '/',
  }
}
