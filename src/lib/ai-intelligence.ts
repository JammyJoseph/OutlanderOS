import Anthropic from "@anthropic-ai/sdk";
import prisma from "./prisma";
import { getCachedSnapshot } from "./trello-cache";

const client = new Anthropic();

// Fast + cheap — this engine runs frequently
const MODEL = "claude-haiku-4-5";

// ===== Types =====
export interface GroupingResult {
  projectsCreated: number;
  itemsGrouped: number;
  projects: { id: string; name: string; brand: string | null; itemCount: number }[];
}

export interface DailyDigest {
  greeting: string;
  briefing: string;
  stats: { overdue: number; dueToday: number; dueThisWeek: number; projectsActive: number };
  highlights: string[];
  generatedAt: string;
}

export interface NewItem {
  type: "task" | "deadline";
  id: string;
  title: string;
  description?: string | null;
  context?: string | null;
}

// ===== Helpers =====
const ACTIVE_TASK = { status: { not: "DONE" } };
const ACTIVE_DEADLINE = { status: { not: "COMPLETED" } };

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function timeGreeting(name?: string): string {
  const h = new Date().getHours();
  const part = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  return name ? `${part}, ${name}. Here's your day:` : `${part}. Here's your day:`;
}

function trelloCards(): { id: string; name: string; client: string }[] {
  const snapshot = getCachedSnapshot();
  if (!snapshot) return [];
  return snapshot.stages.flatMap((s) =>
    s.cards.map((c) => ({ id: c.id, name: c.name, client: c.client }))
  );
}

// ===== analyzeAndGroupTasks =====
const GROUP_TOOL: Anthropic.Tool = {
  name: "group_projects",
  description: "Group related tasks, deadlines, trello cards and productions into smart projects",
  input_schema: {
    type: "object" as const,
    properties: {
      groups: {
        type: "array",
        description: "Detected project groupings. Only include groups with 2+ related items.",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Short, descriptive project name" },
            summary: { type: "string", description: "One-line summary of what this project is about" },
            brand: { type: "string", description: "Brand or client name if applicable" },
            externalPeople: {
              type: "array",
              items: { type: "string" },
              description: "Names of external people (clients, partners) involved",
            },
            confidence: { type: "number", description: "0.0-1.0 confidence in this grouping" },
            taskIds: { type: "array", items: { type: "string" } },
            deadlineIds: { type: "array", items: { type: "string" } },
            trelloCardIds: { type: "array", items: { type: "string" } },
            productionIds: { type: "array", items: { type: "string" } },
          },
          required: ["name", "summary", "confidence", "taskIds", "deadlineIds"],
        },
      },
    },
    required: ["groups"],
  },
};

const GROUP_SYSTEM = `You are the Task Intelligence engine for OutlanderOS, the operating system for Outlander Magazine (a UK fashion and culture media company).
Analyse tasks, deadlines, trello cards and productions. Group related items into projects based on:
- brand/client name overlap
- the same external people mentioned
- similar topics or descriptions
- overlapping timelines
Only group items that genuinely belong together. A project must have at least 2 linked items. Leave unrelated items ungrouped. Always call the group_projects tool.`;

export async function analyzeAndGroupTasks(_userId?: string): Promise<GroupingResult> {
  const empty: GroupingResult = { projectsCreated: 0, itemsGrouped: 0, projects: [] };

  // Items already linked to a smart project should not be regrouped
  const existing = await prisma.smartProject.findMany({
    where: { status: { not: "ARCHIVED" } },
    select: { linkedTasks: true, linkedDeadlines: true },
  });
  const linkedTaskIds = new Set(existing.flatMap((p) => p.linkedTasks));
  const linkedDeadlineIds = new Set(existing.flatMap((p) => p.linkedDeadlines));

  const [tasks, deadlines, productions] = await Promise.all([
    prisma.task.findMany({ where: ACTIVE_TASK }),
    prisma.deadline.findMany({ where: ACTIVE_DEADLINE }),
    prisma.production.findMany({
      where: { status: { not: "ARCHIVED" } },
      select: { id: true, title: true, clientName: true },
    }),
  ]);

  const ungroupedTasks = tasks.filter((t) => !linkedTaskIds.has(t.id));
  const ungroupedDeadlines = deadlines.filter((d) => !linkedDeadlineIds.has(d.id));
  const cards = trelloCards();

  if (ungroupedTasks.length + ungroupedDeadlines.length < 2) return empty;

  const prompt = `Group these items into smart projects.

TASKS:
${ungroupedTasks.map((t) => `- [${t.id}] "${t.title}" | portal: ${t.portal ?? "?"} | due: ${t.dueDate?.toISOString().slice(0, 10) ?? "none"} | ${t.description ?? ""}`).join("\n") || "(none)"}

DEADLINES:
${ungroupedDeadlines.map((d) => `- [${d.id}] "${d.title}" | category: ${d.category ?? "?"} | type: ${d.type} | due: ${d.dueDate.toISOString().slice(0, 10)} | ${d.description ?? ""}`).join("\n") || "(none)"}

TRELLO CARDS:
${cards.map((c) => `- [${c.id}] "${c.name}" | client: ${c.client}`).join("\n") || "(none)"}

PRODUCTIONS:
${productions.map((p) => `- [${p.id}] "${p.title}" | client: ${p.clientName ?? "?"}`).join("\n") || "(none)"}

Call group_projects with related items grouped together.`;

  let groups: Array<{
    name: string;
    summary: string;
    brand?: string;
    externalPeople?: string[];
    confidence: number;
    taskIds: string[];
    deadlineIds: string[];
    trelloCardIds?: string[];
    productionIds?: string[];
  }> = [];

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: [{ type: "text", text: GROUP_SYSTEM, cache_control: { type: "ephemeral" } }],
      tools: [GROUP_TOOL],
      tool_choice: { type: "tool", name: "group_projects" },
      messages: [{ role: "user", content: prompt }],
    });
    const toolUse = response.content.find((c) => c.type === "tool_use");
    if (toolUse && toolUse.type === "tool_use") {
      groups = (toolUse.input as { groups: typeof groups }).groups ?? [];
    }
  } catch (err) {
    console.error("analyzeAndGroupTasks AI call failed", err);
    return empty;
  }

  const validTaskIds = new Set(ungroupedTasks.map((t) => t.id));
  const validDeadlineIds = new Set(ungroupedDeadlines.map((d) => d.id));
  const validProductionIds = new Set(productions.map((p) => p.id));
  const validCardIds = new Set(cards.map((c) => c.id));
  const created: GroupingResult["projects"] = [];
  let itemsGrouped = 0;

  for (const g of groups) {
    const taskIds = (g.taskIds ?? []).filter((id) => validTaskIds.has(id));
    const deadlineIds = (g.deadlineIds ?? []).filter((id) => validDeadlineIds.has(id));
    if (taskIds.length + deadlineIds.length < 2) continue;

    const project = await prisma.smartProject.create({
      data: {
        name: g.name,
        aiSummary: g.summary,
        description: g.summary,
        brand: g.brand ?? null,
        confidence: Math.min(Math.max(g.confidence ?? 0.8, 0), 1),
        linkedTasks: taskIds,
        linkedDeadlines: deadlineIds,
        linkedTrelloCards: (g.trelloCardIds ?? []).filter((id) => validCardIds.has(id)),
        linkedProductions: (g.productionIds ?? []).filter((id) => validProductionIds.has(id)),
        externalPeople: g.externalPeople ?? [],
        lastAnalyzed: new Date(),
      },
    });
    itemsGrouped += taskIds.length + deadlineIds.length;
    created.push({
      id: project.id,
      name: project.name,
      brand: project.brand,
      itemCount: taskIds.length + deadlineIds.length,
    });
  }

  return { projectsCreated: created.length, itemsGrouped, projects: created };
}

// ===== detectProjectFromNewItem =====
const MATCH_TOOL: Anthropic.Tool = {
  name: "match_project",
  description: "Decide whether a new item belongs to an existing smart project",
  input_schema: {
    type: "object" as const,
    properties: {
      projectId: {
        type: "string",
        description: "ID of the matching project, or empty string if none match",
      },
      confidence: { type: "number", description: "0.0-1.0 confidence in the match" },
      reasoning: { type: "string" },
    },
    required: ["projectId", "confidence", "reasoning"],
  },
};

export async function detectProjectFromNewItem(
  item: NewItem
): Promise<{ matched: boolean; projectId?: string; confidence: number }> {
  const projects = await prisma.smartProject.findMany({ where: { status: "ACTIVE" } });
  if (projects.length === 0) return { matched: false, confidence: 0 };

  const prompt = `A new ${item.type} was created:
- Title: "${item.title}"
- Description: ${item.description ?? "none"}
- Context: ${item.context ?? "none"}

EXISTING SMART PROJECTS:
${projects.map((p) => `- [${p.id}] "${p.name}" | brand: ${p.brand ?? "?"} | people: ${p.externalPeople.join(", ") || "none"} | ${p.aiSummary ?? ""}`).join("\n")}

Does this item belong to one of these projects? Match on brand, people, and topic overlap. Call match_project.`;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 400,
      tools: [MATCH_TOOL],
      tool_choice: { type: "tool", name: "match_project" },
      messages: [{ role: "user", content: prompt }],
    });
    const toolUse = response.content.find((c) => c.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") return { matched: false, confidence: 0 };

    const input = toolUse.input as { projectId: string; confidence: number };
    const project = projects.find((p) => p.id === input.projectId);
    if (!project || !input.projectId || input.confidence <= 0.7) {
      return { matched: false, confidence: input.confidence ?? 0 };
    }

    const field = item.type === "task" ? "linkedTasks" : "linkedDeadlines";
    const current = item.type === "task" ? project.linkedTasks : project.linkedDeadlines;
    if (!current.includes(item.id)) {
      await prisma.smartProject.update({
        where: { id: project.id },
        data: { [field]: [...current, item.id], lastAnalyzed: new Date() },
      });
    }
    return { matched: true, projectId: project.id, confidence: input.confidence };
  } catch (err) {
    console.error("detectProjectFromNewItem failed", err);
    return { matched: false, confidence: 0 };
  }
}

// ===== generateDailyDigest =====
export async function generateDailyDigest(name?: string): Promise<DailyDigest> {
  const today = startOfToday();
  const dayMs = 86_400_000;
  const weekEnd = new Date(today.getTime() + 7 * dayMs);

  const [tasks, deadlines, projects, recentlyDone] = await Promise.all([
    prisma.task.findMany({ where: ACTIVE_TASK }),
    prisma.deadline.findMany({ where: ACTIVE_DEADLINE }),
    prisma.smartProject.findMany({ where: { status: "ACTIVE" } }),
    prisma.task.findMany({
      where: { status: "DONE", updatedAt: { gte: new Date(today.getTime() - dayMs) } },
    }),
  ]);

  const dated = [
    ...tasks.filter((t) => t.dueDate).map((t) => ({ title: t.title, due: t.dueDate as Date })),
    ...deadlines.map((d) => ({ title: d.title, due: d.dueDate })),
  ];
  const overdue = dated.filter((i) => i.due < today);
  const dueToday = dated.filter((i) => i.due >= today && i.due < new Date(today.getTime() + dayMs));
  const dueThisWeek = dated.filter((i) => i.due >= today && i.due < weekEnd);

  const stats = {
    overdue: overdue.length,
    dueToday: dueToday.length,
    dueThisWeek: dueThisWeek.length,
    projectsActive: projects.length,
  };

  // Cross-reference projects with overdue items
  const overdueTaskIds = new Set(
    tasks.filter((t) => t.dueDate && t.dueDate < today).map((t) => t.id)
  );
  const overdueDeadlineIds = new Set(deadlines.filter((d) => d.dueDate < today).map((d) => d.id));
  const projectAlerts = projects
    .map((p) => ({
      name: p.name,
      count:
        p.linkedTasks.filter((id) => overdueTaskIds.has(id)).length +
        p.linkedDeadlines.filter((id) => overdueDeadlineIds.has(id)).length,
    }))
    .filter((p) => p.count > 0);

  const prompt = `Write a warm, conversational morning briefing for ${name ?? "the team"} at Outlander Magazine.

TODAY: ${today.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}

NUMBERS:
- ${stats.overdue} overdue items
- ${stats.dueToday} due today
- ${stats.dueThisWeek} due this week
- ${stats.projectsActive} active projects
- ${recentlyDone.length} tasks completed in the last day

OVERDUE ITEMS:
${overdue.map((i) => `- "${i.title}" (was due ${i.due.toLocaleDateString("en-GB")})`).join("\n") || "- none"}

DUE TODAY:
${dueToday.map((i) => `- "${i.title}"`).join("\n") || "- none"}

PROJECTS NEEDING ATTENTION:
${projectAlerts.map((p) => `- ${p.name}: ${p.count} overdue item(s)`).join("\n") || "- none"}

Write 2-4 short sentences. Be warm and human, not robotic. Lead with what matters most. If a project has overdue items, call it out by name. If everything is calm, say so encouragingly.`;

  let briefing = "";
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });
    briefing = response.content[0]?.type === "text" ? response.content[0].text.trim() : "";
  } catch (err) {
    console.error("generateDailyDigest failed", err);
  }
  if (!briefing) {
    briefing =
      stats.overdue > 0
        ? `You have ${stats.overdue} overdue item${stats.overdue === 1 ? "" : "s"} and ${stats.dueToday} due today. Worth a look this morning.`
        : `Nothing overdue — ${stats.dueToday} item${stats.dueToday === 1 ? "" : "s"} due today. A clear run ahead.`;
  }

  const highlights = projectAlerts.map(
    (p) => `${p.name} needs attention — ${p.count} item${p.count === 1 ? "" : "s"} overdue`
  );

  return {
    greeting: timeGreeting(name),
    briefing,
    stats,
    highlights,
    generatedAt: new Date().toISOString(),
  };
}

// ===== suggestNextActions =====
export async function suggestNextActions(projectId: string): Promise<string[]> {
  const project = await prisma.smartProject.findUnique({ where: { id: projectId } });
  if (!project) return [];

  const [tasks, deadlines] = await Promise.all([
    prisma.task.findMany({ where: { id: { in: project.linkedTasks } } }),
    prisma.deadline.findMany({ where: { id: { in: project.linkedDeadlines } } }),
  ]);

  const prompt = `Project: "${project.name}" (brand: ${project.brand ?? "n/a"})
Summary: ${project.aiSummary ?? "none"}

TASKS:
${tasks.map((t) => `- "${t.title}" [${t.status}]${t.dueDate ? ` due ${t.dueDate.toLocaleDateString("en-GB")}` : ""}`).join("\n") || "- none"}

DEADLINES:
${deadlines.map((d) => `- "${d.title}" [${d.status}] due ${d.dueDate.toLocaleDateString("en-GB")}`).join("\n") || "- none"}

Based on what is done and what is pending, suggest 2-4 concrete next actions. Return one action per line, no numbering, no preamble.`;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });
    const text = response.content[0]?.type === "text" ? response.content[0].text : "";
    return text
      .split("\n")
      .map((l) => l.replace(/^[-*\d.\s]+/, "").trim())
      .filter(Boolean)
      .slice(0, 4);
  } catch (err) {
    console.error("suggestNextActions failed", err);
    return [];
  }
}
