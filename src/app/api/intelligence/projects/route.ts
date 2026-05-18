import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const GET = withAuth(async () => {
  try {
    const projects = await prisma.smartProject.findMany({
      where: { status: { not: "ARCHIVED" } },
      orderBy: { updatedAt: "desc" },
    });

    const [tasks, deadlines] = await Promise.all([
      prisma.task.findMany({ select: { id: true, status: true, dueDate: true } }),
      prisma.deadline.findMany({ select: { id: true, status: true, dueDate: true } }),
    ]);

    const taskMap = new Map(tasks.map((t) => [t.id, t]));
    const deadlineMap = new Map(deadlines.map((d) => [d.id, d]));
    const now = new Date();

    const enriched = projects.map((p) => {
      const linkedTasks = p.linkedTasks.map((id) => taskMap.get(id)).filter(Boolean);
      const linkedDeadlines = p.linkedDeadlines.map((id) => deadlineMap.get(id)).filter(Boolean);

      const overdue =
        linkedTasks.filter((t) => t!.status !== "DONE" && t!.dueDate && t!.dueDate < now).length +
        linkedDeadlines.filter((d) => d!.status !== "COMPLETED" && d!.dueDate < now).length;

      return {
        id: p.id,
        name: p.name,
        brand: p.brand,
        status: p.status,
        confidence: p.confidence,
        aiSummary: p.aiSummary,
        externalPeople: p.externalPeople,
        taskCount: p.linkedTasks.length,
        deadlineCount: p.linkedDeadlines.length,
        trelloCount: p.linkedTrelloCards.length,
        productionCount: p.linkedProductions.length,
        itemCount: p.linkedTasks.length + p.linkedDeadlines.length,
        overdueCount: overdue,
        lastAnalyzed: p.lastAnalyzed,
      };
    });

    return NextResponse.json(enriched);
  } catch (err) {
    console.error("GET /api/intelligence/projects", err);
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
});
