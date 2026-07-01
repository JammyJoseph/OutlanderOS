import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { businessDaysBetween } from "@/lib/holiday";
import { ACTIVE_STAGES } from "@/lib/deal-stages";

export const dynamic = "force-dynamic";

export interface UpcomingItem {
  id: string;
  title: string;
  date: string;
  portal: "commercial" | "production" | "print" | "personal";
  kind: "shoot" | "deal" | "print" | "task";
  href: string;
  context?: string; // cross-portal hint, e.g. the deal a shoot belongs to
}

// Single-call dashboard payload for /me: the user's tasks, the next few
// dated items across every portal, holiday balance, and quick-link counts.
export const GET = withAuth(async (_request: NextRequest, _ctx, user) => {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const yearEnd = new Date(now.getFullYear() + 1, 0, 1);

  const [
    dbUser,
    tasks,
    productions,
    dealDeadlines,
    printIssues,
    culturalEvents,
    holidays,
    counts,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.userId },
      select: { id: true, name: true, email: true, role: true, holidayAllowance: true },
    }),
    prisma.task.findMany({
      // Personal tasks plus tasks on projects/productions the user owns —
      // mirrors what the ACTION/TRACK panel shows.
      where: {
        OR: [
          { assignedToId: user.userId },
          { createdById: user.userId },
          { project: { assignedToId: user.userId } },
          { production: { leadId: user.userId } },
        ],
        // Tasks on archived deals/productions stay hidden until unarchived.
        NOT: [
          { project: { archived: true } },
          { production: { archived: true } },
        ],
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    }),
    prisma.production.findMany({
      where: { archived: false, status: { not: "ARCHIVED" } },
      select: {
        id: true,
        title: true,
        shootDates: true,
        campaign: { select: { title: true } },
      },
    }),
    prisma.campaign.findMany({
      where: {
        archived: false,
        status: { not: "ARCHIVED" },
        stage: { in: ACTIVE_STAGES },
        dueDate: { gte: todayStart },
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        client: { select: { name: true } },
        production: { select: { id: true } },
      },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),
    prisma.printIssue.findMany({
      where: { printDate: { gte: todayStart } },
      select: { id: true, title: true, printDate: true },
      orderBy: { printDate: "asc" },
      take: 10,
    }),
    prisma.culturalEvent.findMany({
      where: { date: { gte: now } },
      orderBy: { date: "asc" },
      take: 8,
    }),
    prisma.holidayRequest.findMany({
      where: {
        userId: user.userId,
        status: "APPROVED",
        type: "ANNUAL",
        startDate: { gte: yearStart, lt: yearEnd },
      },
      select: { startDate: true, endDate: true },
      orderBy: { startDate: "asc" },
    }),
    Promise.all([
      prisma.campaign.count({
        where: { archived: false, status: { not: "ARCHIVED" }, stage: { in: ACTIVE_STAGES } },
      }),
      prisma.production.count({ where: { archived: false, status: { not: "ARCHIVED" } } }),
      prisma.campaignBudget.count({
        where: { totalBudget: { gt: 0 }, status: { not: "RECONCILED" } },
      }),
      prisma.printIssue.count(),
    ]),
  ]);

  // Shoots — flattened future shoot dates across active productions.
  const shoots: { id: string; title: string; date: string; dealTitle: string | null }[] = [];
  for (const p of productions) {
    for (const d of p.shootDates) {
      if (d >= todayStart)
        shoots.push({
          id: p.id,
          title: p.title,
          date: d.toISOString(),
          dealTitle: p.campaign?.title ?? null,
        });
    }
  }
  shoots.sort((a, b) => a.date.localeCompare(b.date));

  // Upcoming — next 5 dated items across all portals, soonest first.
  const upcoming: UpcomingItem[] = [
    ...shoots.map((s) => ({
      id: `shoot-${s.id}-${s.date}`,
      title: `Shoot: ${s.title}`,
      date: s.date,
      portal: "production" as const,
      kind: "shoot" as const,
      href: `/production/${s.id}`,
      ...(s.dealTitle ? { context: `From deal: ${s.dealTitle}` } : {}),
    })),
    ...dealDeadlines.map((d) => ({
      id: `deal-${d.id}`,
      title: `${d.title}${d.client ? ` — ${d.client.name}` : ""}`,
      date: d.dueDate!.toISOString(),
      portal: "commercial" as const,
      kind: "deal" as const,
      href: `/commercial/deals/${d.id}`,
      ...(d.production ? { context: "Production started" } : {}),
    })),
    ...printIssues.map((p) => ({
      id: `print-${p.id}`,
      title: `Print: ${p.title}`,
      date: p.printDate!.toISOString(),
      portal: "print" as const,
      kind: "print" as const,
      href: `/print`,
    })),
    ...tasks
      .filter((t) => t.status !== "DONE" && t.dueDate && t.dueDate >= todayStart)
      .map((t) => ({
        id: `task-${t.id}`,
        title: t.title,
        date: t.dueDate!.toISOString(),
        portal: "personal" as const,
        kind: "task" as const,
        href: t.link ?? "/me",
      })),
  ]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  // Holiday balance — business days across approved annual leave this year.
  const allowance = dbUser?.holidayAllowance ?? 25;
  const used = holidays.reduce(
    (sum, h) => sum + businessDaysBetween(h.startDate, h.endDate),
    0,
  );
  const nextHoliday =
    holidays.find((h) => h.startDate >= todayStart || h.endDate >= todayStart) ?? null;

  const [dealCount, productionCount, financeProjectCount, printIssueCount] = counts;

  return NextResponse.json({
    user: dbUser ?? {
      id: user.userId,
      name: user.name,
      email: user.email,
      role: user.role,
      holidayAllowance: 25,
    },
    tasks,
    upcoming,
    shoots,
    culturalEvents,
    holiday: {
      allowance,
      used,
      remaining: Math.max(0, allowance - used),
      nextHoliday: nextHoliday
        ? {
            startDate: nextHoliday.startDate.toISOString(),
            endDate: nextHoliday.endDate.toISOString(),
          }
        : null,
    },
    counts: {
      deals: dealCount,
      productions: productionCount,
      financeProjects: financeProjectCount,
      printIssues: printIssueCount,
    },
  });
});
