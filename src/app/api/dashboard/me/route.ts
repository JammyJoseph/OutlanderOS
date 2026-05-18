import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

const DAY_MS = 86_400_000;

// Single-call dashboard payload for /me. Scoped strictly to the
// authenticated user — their own tasks and their own deadlines.
export const GET = withAuth(async (_request: NextRequest, _ctx, user) => {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart.getTime() + DAY_MS);
  const weekEnd = new Date(todayStart.getTime() + 7 * DAY_MS);

  const [dbUser, tasks, deadlines, culturalEvents, productions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.userId },
      select: { id: true, name: true, email: true, role: true, holidayAllowance: true },
    }),
    prisma.task.findMany({
      where: { assignedToId: user.userId },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    }),
    prisma.deadline.findMany({
      where: { assignedTo: user.userId },
      orderBy: { dueDate: "asc" },
    }),
    prisma.culturalEvent.findMany({
      where: { date: { gte: now } },
      orderBy: { date: "asc" },
      take: 8,
    }),
    prisma.production.findMany({
      where: { status: { not: "ARCHIVED" } },
      select: { id: true, title: true, shootDates: true, leadId: true },
    }),
  ]);

  const shoots: { id: string; title: string; date: string }[] = [];
  for (const p of productions) {
    for (const d of p.shootDates) {
      if (d >= now) shoots.push({ id: p.id, title: p.title, date: d.toISOString() });
    }
  }
  shoots.sort((a, b) => a.date.localeCompare(b.date));

  let overdue = 0;
  let today = 0;
  let week = 0;
  const tally = (due: Date | null, done: boolean) => {
    if (!due || done) return;
    if (due < todayStart) overdue++;
    else if (due < todayEnd) today++;
    else if (due < weekEnd) week++;
  };
  for (const t of tasks) tally(t.dueDate, t.status === "DONE");
  for (const d of deadlines) tally(d.dueDate, d.status === "COMPLETED");

  return NextResponse.json({
    user: dbUser ?? {
      id: user.userId,
      name: user.name,
      email: user.email,
      role: user.role,
      holidayAllowance: 25,
    },
    tasks,
    deadlines,
    culturalEvents,
    shoots,
    counts: { overdue, today, week },
  });
});
