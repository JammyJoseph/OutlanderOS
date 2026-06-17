import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAdmin } from "@/lib/auth";
import bcrypt from "bcryptjs";

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

// POST /api/admin/users — create a staff member (admin only).
export const POST = withAdmin(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const role = body.role === "ADMIN" ? "ADMIN" : "MEMBER";
    const teams = cleanTeams(body.teams);
    const department = typeof body.department === "string" ? body.department.trim() || null : null;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email and password are required" },
        { status: 400 }
      );
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "A user with that email already exists" }, { status: 409 });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, password: hashed, role, teams, department, isActive: true },
      select: STAFF_SELECT,
    });

    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    console.error("POST /api/admin/users", err);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
});
