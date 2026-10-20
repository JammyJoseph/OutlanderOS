import { NextRequest, NextResponse } from "next/server";
import { endAllSessions } from "@/lib/session";
import { passwordProblem } from "@/lib/password-policy";
import prisma from "@/lib/prisma";
import { withAdmin } from "@/lib/auth";
import bcrypt from "bcryptjs";

const TEAMS = ["COMMERCIAL", "PRODUCTION", "FINANCE", "OPERATIONS", "ADMIN"] as const;

function cleanTeams(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.filter(
    (t): t is string => typeof t === "string" && (TEAMS as readonly string[]).includes(t)
  );
}

const STAFF_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  department: true,
  teams: true,
  isActive: true,
  lastLoginAt: true,
  startDate: true,
  holidayAllowance: true,
  createdAt: true,
} as const;

// PATCH /api/admin/users/[id] — update role, teams, active status, and basic
// profile fields for a staff member (admin only).
export const PATCH = withAdmin(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  me
) => {
  try {
    const { id } = await params;
    const body = await request.json();

    const data: Record<string, unknown> = {};
    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
    if (typeof body.email === "string" && body.email.trim()) {
      const email = body.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
      }
      data.email = email;
    }
    if (typeof body.department === "string" || body.department === null)
      data.department = body.department ? String(body.department).trim() || null : null;
    if (body.role === "ADMIN" || body.role === "MEMBER") {
      // Guard against an admin demoting themselves and locking admin access.
      if (body.role !== "ADMIN" && id === me.userId) {
        return NextResponse.json(
          { error: "You can't remove your own admin role" },
          { status: 400 }
        );
      }
      data.role = body.role;
    }
    if (Array.isArray(body.teams)) data.teams = cleanTeams(body.teams);
    if (typeof body.isActive === "boolean") {
      // Guard against an admin locking themselves out.
      if (body.isActive === false && id === me.userId) {
        return NextResponse.json(
          { error: "You can't deactivate your own account" },
          { status: 400 }
        );
      }
      data.isActive = body.isActive;
    }
    if (typeof body.holidayAllowance === "number") data.holidayAllowance = body.holidayAllowance;
    if (typeof body.password === "string" && body.password) {
      const problem = passwordProblem(body.password);
      if (problem) return NextResponse.json({ error: problem }, { status: 400 });
      data.password = await bcrypt.hash(body.password, 10);
      // A password set by somebody else is a temporary one. The person has to
      // choose their own the next time they sign in, so nobody keeps knowing a
      // colleague's password. This used to be permanent, at six characters.
      data.mustChangePassword = true;
      data.failedLoginCount = 0;
      data.lockedUntil = null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: STAFF_SELECT,
    });

    // A new password, a change of role, or being switched off ends every
    // session this person has, on every device, on their very next request.
    // Before this, all three left an existing 30-day cookie working.
    if ("password" in data || "role" in data || data.isActive === false) {
      await endAllSessions(id);
    }

    return NextResponse.json(user);
  } catch (err) {
    console.error("PATCH /api/admin/users/[id]", err);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
});
