import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAdmin } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { randomInt } from "crypto";

// Valid team assignments. Mirrors the labels surfaced in the admin UI.
export const TEAMS = ["COMMERCIAL", "PRODUCTION", "FINANCE", "OPERATIONS", "ADMIN"] as const;

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

// GET /api/admin/users — full staff list (admin only).
export const GET = withAdmin(async () => {
  const users = await prisma.user.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: STAFF_SELECT,
  });
  return NextResponse.json(users);
});

// Generates a readable 8-char alphanumeric temporary password. Excludes
// ambiguous characters (0/O, 1/l/I) so admins can dictate it without confusion.
function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += chars[randomInt(chars.length)];
  }
  return out;
}

// Basic shape check — not RFC-complete, just enough to catch typos and garbage.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/admin/users — create a staff member (admin only). A temporary
// password is auto-generated and returned ONCE in the response so the admin can
// share it; the new user must change it on first login (mustChangePassword).
export const POST = withAdmin(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const role = body.role === "ADMIN" ? "ADMIN" : "MEMBER";
    const teams = cleanTeams(body.teams);
    const department = typeof body.department === "string" ? body.department.trim() || null : null;

    if (!name || !email) {
      return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "A user with that email already exists" }, { status: 409 });
    }

    const tempPassword = generateTempPassword();
    const hashed = await bcrypt.hash(tempPassword, 10);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashed,
        role,
        teams,
        department,
        isActive: true,
        mustChangePassword: true,
      },
      select: STAFF_SELECT,
    });

    // tempPassword is included only on creation and never stored in plaintext.
    return NextResponse.json({ ...user, tempPassword }, { status: 201 });
  } catch (err) {
    console.error("POST /api/admin/users", err);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
});
