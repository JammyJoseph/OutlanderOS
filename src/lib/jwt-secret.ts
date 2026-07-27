// Single source for the auth signing secret.
//
// This used to be `process.env.NEXTAUTH_SECRET || "outlander-os-secret"`, copied
// into seven files. That literal is in the repo and in git history, so any
// environment that lost NEXTAUTH_SECRET would silently keep working while
// accepting tokens anyone could forge — including `role: "ADMIN"` ones.
//
// Resolved lazily rather than at module load: route modules are imported during
// `next build`, and a module-scope throw would turn a missing secret into a
// build failure rather than a clear runtime error.
export function getJwtSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error(
      'NEXTAUTH_SECRET is not set. Auth cannot operate safely without it — ' +
        'set it in the environment (prod keeps it in .env.local) and restart.'
    )
  }
  return secret
}
