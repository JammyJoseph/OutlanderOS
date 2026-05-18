import { withErrorHandling } from "@/lib/api-error"
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAdmin } from "@/lib/auth";

/**
 * Reports auto-ping health: when escalation last ran and how many items are
 * currently overdue, due today, or flagged as stale.
 */
const GET__h = withAdmin(async () => {
  try {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart.getTime() + 86_400_000);

    const openTask = { in: ["TODO", "IN_PROGRESS"] };
    const openDeadline = { in: ["ACTIVE", "OVERDUE"] };

    const [
      syncStatus,
      tasksOverdue,
      deadlinesOverdue,
      tasksDueToday,
      deadlinesDueToday,
      staleCount,
    ] = await Promise.all([
      prisma.syncStatus.findUnique({ where: { source: "autoPing" } }),
      prisma.task.count({
        where: { status: openTask, dueDate: { lt: todayStart } },
      }),
      prisma.deadline.count({
        where: { status: openDeadline, dueDate: { lt: todayStart } },
      }),
      prisma.task.count({
        where: {
          status: openTask,
          dueDate: { gte: todayStart, lt: todayEnd },
        },
      }),
      prisma.deadline.count({
        where: {
          status: openDeadline,
          dueDate: { gte: todayStart, lt: todayEnd },
        },
      }),
      prisma.task.count({
        where: { status: "IN_PROGRESS", staleFlaggedAt: { not: null } },
      }),
    ]);

    return NextResponse.json({
      lastEscalationRun:
        syncStatus?.lastSuccessAt?.toISOString() ??
        syncStatus?.lastSyncAt?.toISOString() ??
        null,
      state: syncStatus?.state ?? "never run",
      overdue: tasksOverdue + deadlinesOverdue,
      dueToday: tasksDueToday + deadlinesDueToday,
      staleCount,
    });
  } catch (err) {
    console.error("GET /api/auto-ping/status", err);
    return NextResponse.json(
      { error: "Failed to fetch auto-ping status" },
      { status: 500 }
    );
  }
});

export const GET = withErrorHandling(GET__h as any)
