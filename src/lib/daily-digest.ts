/**
 * Per-user daily digest.
 *
 * Gathers a user's tasks, deadlines, projects, shoots and cultural events,
 * writes a warm natural-language briefing with Claude, and stores it as a
 * "daily_digest" notification so the dashboard can show today's briefing.
 */
import Anthropic from "@anthropic-ai/sdk";
import prisma from "./prisma";

const DAY_MS = 86_400_000;
const anthropic = new Anthropic();
const MODEL = "claude-haiku-4-5";

export interface DigestItem {
  id: string;
  kind: "task" | "deadline" | "project" | "shoot" | "event";
  group: "completed" | "overdue" | "today" | "week" | "project" | "shoot" | "event";
  label: string;
  link: string;
  daysOverdue?: number;
  priority?: string;
}

export interface DigestCounts {
  overdue: number;
  dueToday: number;
  completedYesterday: number;
}

export interface UserDigest {
  userId: string;
  date: string;
  text: string;
  counts: DigestCounts;
  items: DigestItem[];
}

function dayStart(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysBetween(later: Date, earlier: Date): number {
  return Math.round((later.getTime() - earlier.getTime()) / DAY_MS);
}

interface Gathered {
  counts: DigestCounts;
  items: DigestItem[];
  promptLines: string[];
}

/**
 * Pulls everything relevant to a user's day. No AI — safe to call often.
 */
export async function gatherDigestData(userId: string): Promise<Gathered> {
  const now = new Date();
  const todayStart = dayStart(now);
  const todayEnd = new Date(todayStart.getTime() + DAY_MS);
  const yesterdayStart = new Date(todayStart.getTime() - DAY_MS);
  const weekEnd = new Date(todayStart.getTime() + 7 * DAY_MS);

  const [
    completedTasks,
    openTasks,
    openDeadlines,
    projects,
    productions,
    events,
  ] = await Promise.all([
    prisma.task.findMany({
      where: {
        assignedToId: userId,
        status: "DONE",
        updatedAt: { gte: yesterdayStart, lt: todayStart },
      },
    }),
    prisma.task.findMany({
      where: {
        assignedToId: userId,
        status: { in: ["TODO", "IN_PROGRESS"] },
        dueDate: { not: null, lt: weekEnd },
      },
    }),
    prisma.deadline.findMany({
      where: {
        assignedTo: userId,
        status: { in: ["ACTIVE", "OVERDUE"] },
        dueDate: { lt: weekEnd },
      },
    }),
    prisma.smartProject.findMany({ where: { status: "ACTIVE" } }),
    prisma.production.findMany({
      where: { status: { not: "ARCHIVED" } },
      select: { id: true, title: true, shootDates: true },
    }),
    prisma.culturalEvent.findMany({
      where: { date: { gte: now, lt: weekEnd } },
      orderBy: { date: "asc" },
    }),
  ]);

  const items: DigestItem[] = [];
  const promptLines: string[] = [];

  // Completed yesterday
  for (const t of completedTasks) {
    items.push({
      id: t.id,
      kind: "task",
      group: "completed",
      label: t.title,
      link: t.link ?? "/me/tasks",
    });
  }
  promptLines.push(`COMPLETED YESTERDAY: ${completedTasks.length} task(s)`);
  for (const t of completedTasks) promptLines.push(`  - ${t.title}`);

  const overdueTaskIds = new Set<string>();
  const overdueDeadlineIds = new Set<string>();
  const overdueLines: string[] = [];
  const todayLines: string[] = [];
  const weekLines: string[] = [];

  function bucket(
    id: string,
    kind: "task" | "deadline",
    title: string,
    due: Date,
    priority: string,
    link: string
  ) {
    if (due < todayStart) {
      const d = daysBetween(todayStart, dayStart(due));
      items.push({
        id,
        kind,
        group: "overdue",
        label: title,
        link,
        daysOverdue: d,
        priority,
      });
      overdueLines.push(`  - ${title} (${d}d overdue, ${priority})`);
      if (kind === "task") overdueTaskIds.add(id);
      else overdueDeadlineIds.add(id);
    } else if (due < todayEnd) {
      items.push({ id, kind, group: "today", label: title, link, priority });
      todayLines.push(`  - ${title} (${priority})`);
    } else {
      items.push({ id, kind, group: "week", label: title, link, priority });
      weekLines.push(`  - ${title} (due ${due.toLocaleDateString("en-GB")})`);
    }
  }

  for (const t of openTasks) {
    if (!t.dueDate) continue;
    bucket(t.id, "task", t.title, t.dueDate, t.priority, t.link ?? "/me/tasks");
  }
  for (const d of openDeadlines) {
    bucket(d.id, "deadline", d.title, d.dueDate, d.priority, "/me");
  }

  promptLines.push(`OVERDUE: ${overdueLines.length} item(s)`);
  promptLines.push(...overdueLines);
  promptLines.push(`DUE TODAY: ${todayLines.length} item(s)`);
  promptLines.push(...todayLines);
  promptLines.push(`DUE THIS WEEK: ${weekLines.length} item(s)`);
  promptLines.push(...weekLines);

  // Smart Projects with overdue items
  const projectLines: string[] = [];
  for (const p of projects) {
    const count =
      p.linkedTasks.filter((id) => overdueTaskIds.has(id)).length +
      p.linkedDeadlines.filter((id) => overdueDeadlineIds.has(id)).length;
    if (count === 0) continue;
    items.push({
      id: p.id,
      kind: "project",
      group: "project",
      label: `${p.name} — ${count} overdue`,
      link: `/projects/${p.id}`,
    });
    projectLines.push(`  - ${p.name}: ${count} overdue item(s)`);
  }
  if (projectLines.length > 0) {
    promptLines.push("PROJECTS NEEDING ATTENTION:");
    promptLines.push(...projectLines);
  }

  // Production shoots in the next 7 days
  const shootLines: string[] = [];
  for (const prod of productions) {
    for (const sd of prod.shootDates) {
      if (sd >= now && sd < weekEnd) {
        items.push({
          id: `${prod.id}-${sd.getTime()}`,
          kind: "shoot",
          group: "shoot",
          label: `${prod.title} shoot — ${sd.toLocaleDateString("en-GB")}`,
          link: `/production/${prod.id}`,
        });
        shootLines.push(`  - ${prod.title} on ${sd.toLocaleDateString("en-GB")}`);
      }
    }
  }
  promptLines.push(`PRODUCTION SHOOTS (next 7 days): ${shootLines.length}`);
  promptLines.push(...shootLines);

  // Cultural events in the next 7 days
  promptLines.push(`CULTURAL EVENTS (next 7 days): ${events.length}`);
  for (const e of events) {
    items.push({
      id: e.id,
      kind: "event",
      group: "event",
      label: `${e.title} — ${e.date.toLocaleDateString("en-GB")}`,
      link: "/me/calendar",
    });
    promptLines.push(
      `  - ${e.title} (${e.category}) on ${e.date.toLocaleDateString("en-GB")}`
    );
  }

  return {
    counts: {
      overdue: overdueLines.length,
      dueToday: todayLines.length,
      completedYesterday: completedTasks.length,
    },
    items,
    promptLines,
  };
}

const DIGEST_SYSTEM = `You write a warm, concise daily briefing for a team member at Outlander, a UK fashion and culture media company.

STYLE:
- Conversational and encouraging, never robotic or alarming.
- Open with a warm greeting that names the day.
- Short paragraphs: what they finished yesterday, what is due today, what is overdue (direct but kind), and what is coming up this week (shoots, cultural events).
- If a project has overdue items, name it.
- Never invent items. If a category is empty, skip it or note the calm.
- Under 180 words. Plain text — no markdown headings, no bullet symbols.`;

function fallbackText(name: string, dateLabel: string, c: DigestCounts): string {
  return `Good morning, ${name}. Here's your briefing for ${dateLabel}. You completed ${c.completedYesterday} task(s) yesterday, have ${c.dueToday} due today, and ${c.overdue} overdue item(s) needing attention. Have a focused day.`;
}

/**
 * Builds the AI briefing for a user, stores it as a daily_digest
 * notification (replacing any earlier one from today), and returns it.
 */
export async function generateUserDigest(userId: string): Promise<UserDigest> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const firstName = user?.name?.split(/\s+/)[0] ?? "there";
  const today = new Date();
  const dateLabel = today.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const { counts, items, promptLines } = await gatherDigestData(userId);

  const prompt = `Write today's briefing for ${firstName}. Today is ${dateLabel}.

${promptLines.join("\n")}

Write the briefing now.`;

  let text: string;
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 500,
      system: [
        { type: "text", text: DIGEST_SYSTEM, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: prompt }],
    });
    const block = response.content.find((c) => c.type === "text");
    text =
      block && block.type === "text"
        ? block.text.trim()
        : fallbackText(firstName, dateLabel, counts);
  } catch (err) {
    console.error("generateUserDigest AI call failed", err);
    text = fallbackText(firstName, dateLabel, counts);
  }

  const todayStart = dayStart(today);
  await prisma.notification.deleteMany({
    where: { userId, type: "daily_digest", createdAt: { gte: todayStart } },
  });
  await prisma.notification.create({
    data: { userId, type: "daily_digest", message: text, link: "/me" },
  });

  return { userId, date: today.toISOString(), text, counts, items };
}

/**
 * Returns today's stored digest notification for a user, or null.
 */
export async function getTodaysDigestNotification(userId: string) {
  const todayStart = dayStart(new Date());
  return prisma.notification.findFirst({
    where: { userId, type: "daily_digest", createdAt: { gte: todayStart } },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Generates the digest for every user — used by the scheduled dailyDigest job.
 */
export async function generateAllUserDigests(): Promise<number> {
  const users = await prisma.user.findMany({ select: { id: true } });
  let count = 0;
  for (const u of users) {
    try {
      await generateUserDigest(u.id);
      count++;
    } catch (err) {
      console.error(`daily digest failed for user ${u.id}`, err);
    }
  }
  return count;
}
