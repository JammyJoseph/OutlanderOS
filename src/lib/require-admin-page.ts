import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { resolveSession } from "@/lib/session";

/**
 * Server-component guard for admin-only portal sections (Finance, Admin).
 *
 * resolveSession reads the role from the database rather than the token, so a
 * freshly promoted admin is let in immediately and a demoted one is turned away
 * on their very next page load. It also refuses deactivated accounts and
 * sessions that have been ended, which this guard previously did not check.
 */
export async function requireAdminPage(): Promise<void> {
  const user = await resolveSession((await cookies()).get("auth_token")?.value);
  if (user?.role !== "ADMIN") redirect("/me");
}
