import type { NextAuthOptions } from "next-auth"
import type { NextRequest } from "next/server"
import GoogleProvider from "next-auth/providers/google"
import jwt from "jsonwebtoken"

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub
      }
      return session
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id
      }
      return token
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
}

// ===== JWT AUTH HELPERS (custom email/password login) =====
// The portal logs users in via /api/auth/login, which issues a signed JWT
// stored in the httpOnly `auth_token` cookie. Every API route uses these
// helpers to verify that cookie before returning or mutating data.

const JWT_SECRET = process.env.NEXTAUTH_SECRET || "outlander-os-secret"

export interface AuthUser {
  userId: string
  email: string
  role: string
  name: string
}

export class AuthError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = "AuthError"
    this.status = status
  }
}

function readAuthToken(request: Request): string | null {
  const header = request.headers.get("cookie") || ""
  const match = header.match(/(?:^|;\s*)auth_token=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

// Returns the authenticated user, or null when no valid token is present.
export async function getOptionalAuthUser(request: Request): Promise<AuthUser | null> {
  const token = readAuthToken(request)
  if (!token) return null
  try {
    const payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload
    if (!payload?.userId) return null
    return {
      userId: String(payload.userId),
      email: String(payload.email ?? ""),
      role: String(payload.role ?? "MEMBER"),
      name: String(payload.name ?? ""),
    }
  } catch {
    return null
  }
}

// Returns the authenticated user, or throws AuthError(401).
export async function getAuthUser(request: Request): Promise<AuthUser> {
  const user = await getOptionalAuthUser(request)
  if (!user) throw new AuthError("Authentication required", 401)
  return user
}

// Returns the authenticated user only if they are an ADMIN, else throws.
export async function requireAdmin(request: Request): Promise<AuthUser> {
  const user = await getAuthUser(request)
  if (user.role !== "ADMIN") throw new AuthError("Admin access required", 403)
  return user
}

// The JWT bakes the role in at login time, so a user promoted to ADMIN after
// logging in still carries a stale MEMBER role until they sign in again.
// Role-gated actions (budget unlock, archive) check the database instead.
export async function isAdminInDb(user: AuthUser): Promise<boolean> {
  if (user.role === "ADMIN") return true
  const { default: prisma } = await import("@/lib/prisma")
  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { role: true },
  })
  return dbUser?.role === "ADMIN"
}

type RouteContext = { params?: Promise<Record<string, string>> }
type AuthedHandler = (
  request: NextRequest,
  context: RouteContext,
  user: AuthUser
) => Promise<Response> | Response

function authErrorResponse(err: unknown): Response {
  const status = err instanceof AuthError ? err.status : 401
  const message = err instanceof AuthError ? err.message : "Authentication required"
  return Response.json({ error: message }, { status })
}

// Wraps a route handler so it only runs for authenticated users. The verified
// user is passed as the third argument to the handler.
export function withAuth(handler: AuthedHandler) {
  return async (request: NextRequest, context: RouteContext) => {
    let user: AuthUser
    try {
      user = await getAuthUser(request)
    } catch (err) {
      return authErrorResponse(err)
    }
    return handler(request, context, user)
  }
}

// Wraps a route handler so it only runs for ADMIN users.
export function withAdmin(handler: AuthedHandler) {
  return async (request: NextRequest, context: RouteContext) => {
    let user: AuthUser
    try {
      user = await requireAdmin(request)
    } catch (err) {
      return authErrorResponse(err)
    }
    return handler(request, context, user)
  }
}
