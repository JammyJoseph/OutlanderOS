"use client";

// Portal pages load their data from API routes that return 401 once the JWT
// expires. A 401 is not "no data": pages that fall back to an empty array on any
// failure render a convincing empty portal ("0 projects", "0 contacts"), which
// reads as total data loss rather than a lapsed session.
//
// `proxy.ts` bounces expired sessions before a page renders, but a session can
// still lapse while a tab sits open — so client fetches have to handle it too.
// On 401 we hard-navigate to /login (not router.push) so the request goes through
// the proxy and the cleared cookie is actually picked up.

export class SessionExpiredError extends Error {
  constructor() {
    super("Session expired");
    this.name = "SessionExpiredError";
  }
}

export function redirectToLogin(): void {
  if (typeof window !== "undefined") window.location.href = "/login";
}

// Fetches JSON, sending an expired session to /login and turning any other
// non-2xx into a throw. Callers show an error state with a retry; they must not
// treat a rejection as "empty".
export async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (res.status === 401) {
    redirectToLogin();
    throw new SessionExpiredError();
  }
  if (!res.ok) {
    throw new Error(`${init?.method ?? "GET"} ${url} → ${res.status}`);
  }
  return (await res.json()) as T;
}

// True when a rejection is just the session expiring. The page is already
// navigating to /login, so callers skip their error state and keep the skeleton
// up rather than flashing a scary message on the way out.
export function isSessionExpired(e: unknown): boolean {
  return e instanceof SessionExpiredError;
}
