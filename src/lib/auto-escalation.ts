/**
 * Auto-ping & escalation engine.
 *
 * Continuously monitors tasks and deadlines: escalates overdue items,
 * unlocks run-on production tasks once their dependency is done, and flags
 * stale work. Runs on a schedule via the sync engine (source "autoPing")
 * and can be triggered manually through /api/auto-ping/escalate.
 *
 * All passes are idempotent — escalationLevel / staleFlaggedAt / status
 * guard against re-escalating or re-notifying the same item.
 */
import prisma from "./prisma";

const DAY_MS = 86_400_000;

const TASK_PRIORITY = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export interface EscalationResult {
  tasksEscalated: number;
  deadlinesEscalated: number;
  notificationsCreated: number;
  details: string[];
}

export interface RunOnResult {
  tasksUnlocked: number;
  notificationsCreated: number;
  details: string[];
}

export interface StaleResult {
  staleFlagged: number;
  deadlinesReactivated: number;
  notificationsCreated: number;
  details: string[];
}

export interface AutoPingResult {
  ranAt: string;
  escalation: EscalationResult;
  runOn: RunOnResult;
  stale: StaleResult;
  totalNotifications: number;
}

// Days overdue → escalation level. 0 none, 1 HIGH, 2 URGENT, 3 7-day alert.
function levelForDaysOverdue(days: number): number {
  if (days >= 7) return 3;
  if (days >= 3) return 2;
  if (days >= 1) return 1;
  return 0;
}

function daysBetween(later: Date, earlier: Date): number {
  return Math.floor((later.getTime() - earlier.getTime()) / DAY_MS);
}

async function adminIds(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true },
  });
  return admins.map((a) => a.id);
}

async function notify(
  userIds: Iterable<string>,
  type: string,
  message: string,
  link: string | null
): Promise<number> {
  let count = 0;
  for (const userId of new Set(userIds)) {
    if (!userId) continue;
    await prisma.notification.create({
      data: { userId, type, message, link },
    });
    count++;
  }
  return count;
}

/**
 * Raises priority on overdue tasks and deadlines and fires 7-day alerts.
 */
export async function escalateOverdueItems(): Promise<EscalationResult> {
  const now = new Date();
  const result: EscalationResult = {
    tasksEscalated: 0,
    deadlinesEscalated: 0,
    notificationsCreated: 0,
    details: [],
  };
  const admins = await adminIds();

  // --- Tasks ---
  const tasks = await prisma.task.findMany({
    where: {
      status: { in: ["TODO", "IN_PROGRESS"] },
      dueDate: { lt: now },
    },
  });

  for (const t of tasks) {
    if (!t.dueDate) continue;
    const days = daysBetween(now, t.dueDate);
    const level = levelForDaysOverdue(days);
    if (level <= t.escalationLevel) continue;

    const data: {
      escalatedAt: Date;
      escalationLevel: number;
      priority?: string;
    } = { escalatedAt: now, escalationLevel: level };

    if (level === 1 && t.priority !== "URGENT") {
      data.priority = "HIGH";
    } else if (level >= 2) {
      data.priority = "URGENT";
    }

    await prisma.task.update({ where: { id: t.id }, data });
    result.tasksEscalated++;
    result.details.push(`Task "${t.title}" overdue ${days}d → level ${level}`);

    if (level === 3) {
      result.notificationsCreated += await notify(
        [t.assignedToId, ...admins],
        "escalation",
        `Task "${t.title}" has been overdue for ${days} days — escalated to URGENT.`,
        t.link ?? "/me/tasks"
      );
    }
  }

  // --- Deadlines (ACTIVE or already-OVERDUE so escalation can continue) ---
  const deadlines = await prisma.deadline.findMany({
    where: {
      status: { in: ["ACTIVE", "OVERDUE"] },
      dueDate: { lt: now },
    },
  });

  for (const d of deadlines) {
    const days = daysBetween(now, d.dueDate);
    const level = levelForDaysOverdue(days);
    const becomingOverdue = d.status === "ACTIVE";
    if (level <= d.escalationLevel && !becomingOverdue) continue;

    const data: {
      status: string;
      escalatedAt: Date;
      escalationLevel: number;
      priority?: string;
    } = {
      status: "OVERDUE",
      escalatedAt: now,
      escalationLevel: Math.max(level, d.escalationLevel),
    };

    if (level === 1 && d.priority !== "URGENT") {
      data.priority = "HIGH";
    } else if (level >= 2) {
      data.priority = "URGENT";
    }

    await prisma.deadline.update({ where: { id: d.id }, data });
    result.deadlinesEscalated++;
    result.details.push(
      `Deadline "${d.title}" overdue ${days}d → level ${level}`
    );

    if (level === 3 && level > d.escalationLevel) {
      const recipients = [...admins];
      if (d.assignedTo) recipients.push(d.assignedTo);
      result.notificationsCreated += await notify(
        recipients,
        "escalation",
        `Deadline "${d.title}" has been overdue for ${days} days — escalated to URGENT.`,
        "/me"
      );
    }
  }

  return result;
}

/**
 * Unlocks production tasks whose dependency is now done.
 * Idempotent — only LOCKED tasks are scanned, and they leave LOCKED on unlock.
 */
export async function processRunOnTasks(): Promise<RunOnResult> {
  const now = new Date();
  const result: RunOnResult = {
    tasksUnlocked: 0,
    notificationsCreated: 0,
    details: [],
  };

  const locked = await prisma.productionTask.findMany({
    where: { status: "LOCKED", dependsOn: { not: null } },
  });
  if (locked.length === 0) return result;

  const depIds = [
    ...new Set(locked.map((t) => t.dependsOn).filter((id): id is string => !!id)),
  ];
  const deps = await prisma.productionTask.findMany({
    where: { id: { in: depIds } },
    select: { id: true, title: true, status: true },
  });
  const depById = new Map(deps.map((d) => [d.id, d]));
  const admins = await adminIds();

  for (const pt of locked) {
    const dep = pt.dependsOn ? depById.get(pt.dependsOn) : undefined;
    if (!dep || dep.status !== "DONE") continue;

    await prisma.productionTask.update({
      where: { id: pt.id },
      data: { status: "READY", unlockedAt: now },
    });
    result.tasksUnlocked++;
    result.details.push(`Unlocked "${pt.title}"`);

    // owner is a free-text name — resolve to a user if we can, else tell admins.
    let recipients: string[] = admins;
    if (pt.owner) {
      const user = await prisma.user.findFirst({
        where: { name: pt.owner },
        select: { id: true },
      });
      if (user) recipients = [user.id];
    }
    result.notificationsCreated += await notify(
      recipients,
      "task_unlocked",
      `Task "${pt.title}" is now ready — "${dep.title}" was just completed.`,
      "/production"
    );
  }

  return result;
}

/**
 * Flags long-running in-progress tasks and reactivates expired snoozes.
 */
export async function checkStaleItems(): Promise<StaleResult> {
  const now = new Date();
  const staleThreshold = new Date(now.getTime() - 7 * DAY_MS);
  const result: StaleResult = {
    staleFlagged: 0,
    deadlinesReactivated: 0,
    notificationsCreated: 0,
    details: [],
  };
  const admins = await adminIds();

  const staleTasks = await prisma.task.findMany({
    where: {
      status: "IN_PROGRESS",
      updatedAt: { lt: staleThreshold },
      staleFlaggedAt: null,
    },
  });

  for (const t of staleTasks) {
    await prisma.task.update({
      where: { id: t.id },
      data: { staleFlaggedAt: now },
    });
    result.staleFlagged++;
    result.details.push(`Stale: "${t.title}"`);
    result.notificationsCreated += await notify(
      t.assignedToId ? [t.assignedToId] : admins,
      "stale_item",
      `Task "${t.title}" has been in progress for 7 days — still on track?`,
      t.link ?? "/me/tasks"
    );
  }

  const expiredSnoozes = await prisma.deadline.findMany({
    where: { status: "SNOOZED", snoozedUntil: { lt: now } },
  });

  for (const d of expiredSnoozes) {
    await prisma.deadline.update({
      where: { id: d.id },
      data: { status: "ACTIVE", snoozedUntil: null },
    });
    result.deadlinesReactivated++;
    result.details.push(`Reactivated snoozed deadline "${d.title}"`);
  }

  return result;
}

/**
 * Runs the full auto-ping cycle: escalation, run-on unlocking, stale checks.
 */
export async function runAutoPing(): Promise<AutoPingResult> {
  const escalation = await escalateOverdueItems();
  const runOn = await processRunOnTasks();
  const stale = await checkStaleItems();

  return {
    ranAt: new Date().toISOString(),
    escalation,
    runOn,
    stale,
    totalNotifications:
      escalation.notificationsCreated +
      runOn.notificationsCreated +
      stale.notificationsCreated,
  };
}
