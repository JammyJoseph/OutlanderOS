import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import jwt from "jsonwebtoken";
import prisma from "@/lib/prisma";

const JWT_SECRET = process.env.NEXTAUTH_SECRET || "outlander-os-secret";

/**
 * Server-component guard for admin-only portal sections (Finance, Admin).
 *
 * The JWT bakes the role in at login time, so we check the database role
 * instead — a freshly promoted admin is allowed immediately, and a demoted
 * member is locked out without needing to re-log in. MEMBER users (and anyone
 * unauthenticated) are redirected to their personal dashboard.
 */
export async function requireAdminPage(): Promise<void> {
  const token = (await cookies()).get("auth_token")?.value;
  if (!token) redirect("/me");

  let payload: jwt.JwtPayload | null = null;
  try {
    payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
  } catch {
    payload = null;
  }
  if (!payload?.userId) redirect("/me");
  const userId = String(payload.userId);

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (dbUser?.role !== "ADMIN") redirect("/me");
}
