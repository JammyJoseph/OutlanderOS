import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

const DAY_MS = 86_400_000;
const MODEL = "claude-haiku-4-5";

interface Suggestion {
  title: string;
  detail: string;
}

function daysFrom(todayStart: Date, due: Date): number {
  return Math.round((due.getTime() - todayStart.getTime()) / DAY_MS);
}

// Claude generates proactive nudges from the user's own workload.
export const POST = withAuth(async (_request: NextRequest, _ctx, user) => {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const horizon = new Date(todayStart.getTime() + 42 * DAY_MS);

  const [tasks, deadlines, events, productions, deals] = await Promise.all([
    prisma.task.findMany({
      where: { assignedToId: user.userId, status: { not: "DONE" } },
      orderBy: { dueDate: "asc" },
    }),
    prisma.deadline.findMany({
      where: { assignedTo: user.userId, status: { in: ["ACTIVE", "OVERDUE"] } },
      orderBy: { dueDate: "asc" },
    }),
    prisma.culturalEvent.findMany({
      where: { date: { gte: now, lt: horizon } },
      orderBy: { date: "asc" },
      take: 10,
    }),
    prisma.production.findMany({
      where: { status: { not: "ARCHIVED" } },
      select: { title: true, shootDates: true },
    }),
    prisma.campaign.findMany({
      where: { status: { notIn: ["ARCHIVED", "PAID", "DELIVERED"] } },
      select: {
        title: true,
        status: true,
        updatedAt: true,
        client: { select: { name: true } },
      },
      orderBy: { updatedAt: "asc" },
      take: 12,
    }),
  ]);

  const lines: string[] = [];
  for (const t of tasks) {
    const due = t.dueDate ? `due in ${daysFrom(todayStart, t.dueDate)}d` : "no due date";
    lines.push(`TASK [${t.priority}] ${t.title} (${due})`);
  }
  for (const d of deadlines) {
    const days = daysFrom(todayStart, d.dueDate);
    const from = d.emailFrom ? ` from ${d.emailFrom}` : "";
    lines.push(`DEADLINE [${d.priority}] ${d.title}${from} (due in ${days}d, source ${d.source})`);
  }
  for (const e of events) {
    lines.push(`CULTURAL EVENT ${e.title} in ${daysFrom(todayStart, e.date)}d (${e.category})`);
  }
  for (const p of productions) {
    for (const sd of p.shootDates) {
      if (sd >= now && sd < horizon) {
        lines.push(`SHOOT ${p.title} in ${daysFrom(todayStart, sd)}d`);
      }
    }
  }
  for (const c of deals) {
    const stale = Math.abs(daysFrom(todayStart, c.updatedAt));
    lines.push(
      `DEAL ${c.client?.name ?? "Unknown"} — ${c.title} [${c.status}, last updated ${stale}d ago]`,
    );
  }

  const overdueCount =
    tasks.filter((t) => t.dueDate && t.dueDate < todayStart).length +
    deadlines.filter((d) => d.dueDate < todayStart).length;

  const fallback = (): { digest: string; suggestions: Suggestion[] } => {
    const open = tasks.length + deadlines.length;
    const digest =
      open === 0
        ? "Your plate is clear — no open tasks or deadlines assigned to you."
        : `You have ${open} open item${open === 1 ? "" : "s"}${
            overdueCount > 0 ? `, ${overdueCount} of them overdue` : ""
          }.`;
    const suggestions: Suggestion[] = [];
    const oldestOverdue = [
      ...tasks.filter((t) => t.dueDate && t.dueDate < todayStart).map((t) => ({ title: t.title, due: t.dueDate! })),
      ...deadlines.filter((d) => d.dueDate < todayStart).map((d) => ({ title: d.title, due: d.dueDate })),
    ].sort((a, b) => a.due.getTime() - b.due.getTime())[0];
    if (oldestOverdue) {
      suggestions.push({
        title: `Overdue: ${oldestOverdue.title}`,
        detail: `This was due ${Math.abs(daysFrom(todayStart, oldestOverdue.due))} day(s) ago — clear it first.`,
      });
    }
    if (events[0]) {
      suggestions.push({
        title: `${events[0].title} in ${daysFrom(todayStart, events[0].date)} days`,
        detail: `Cultural moment coming up — worth planning content around it.`,
      });
    }
    return { digest, suggestions };
  };

  if (!process.env.ANTHROPIC_API_KEY || lines.length === 0) {
    return NextResponse.json(fallback());
  }

  try {
    const anthropic = new Anthropic();
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 700,
      system:
        "You are an executive assistant for a team member at Outlander Magazine, a UK fashion and culture publication. " +
        "Given their current workload, write a short digest and 2-3 sharp, proactive suggestions. " +
        "Suggestions should be specific and actionable (e.g. chasing a stalled deadline, following up a brand deal that has gone quiet, prepping for an upcoming cultural moment or shoot). " +
        'Respond with STRICT JSON only, no prose: {"digest":"1-2 sentences","suggestions":[{"title":"short headline","detail":"one sentence"}]}',
      messages: [
        {
          role: "user",
          content: `Today is ${now.toDateString()}. Workload for ${user.name}:\n\n${lines.join("\n")}`,
        },
      ],
    });

    const block = message.content.find((c) => c.type === "text");
    const text = block && block.type === "text" ? block.text : "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return NextResponse.json(fallback());

    const parsed = JSON.parse(match[0]) as { digest?: string; suggestions?: Suggestion[] };
    return NextResponse.json({
      digest: parsed.digest || fallback().digest,
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 3) : [],
    });
  } catch {
    return NextResponse.json(fallback());
  }
});
