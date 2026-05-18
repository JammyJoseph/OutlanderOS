import { withErrorHandling } from "@/lib/api-error"
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { suggestNextActions } from "@/lib/ai-intelligence";
import { withAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const GET__h = withAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;
    const project = await prisma.smartProject.findUnique({ where: { id } });
    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const [tasks, deadlines, productions] = await Promise.all([
      prisma.task.findMany({ where: { id: { in: project.linkedTasks } } }),
      prisma.deadline.findMany({ where: { id: { in: project.linkedDeadlines } } }),
      prisma.production.findMany({
        where: { id: { in: project.linkedProductions } },
        select: { id: true, title: true, clientName: true, status: true },
      }),
    ]);

    const wantSuggestions = new URL(request.url).searchParams.get("suggest") === "1";
    const suggestions = wantSuggestions ? await suggestNextActions(id) : [];

    return NextResponse.json({
      ...project,
      tasks,
      deadlines,
      productions,
      trelloCardIds: project.linkedTrelloCards,
      suggestions,
    });
  } catch (err) {
    console.error("GET /api/intelligence/projects/[id]", err);
    return NextResponse.json({ error: "Failed to fetch project" }, { status: 500 });
  }
});

const PUT__h = withAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      name,
      description,
      brand,
      status,
      linkedTasks,
      linkedDeadlines,
      linkedTrelloCards,
      linkedProductions,
      externalPeople,
      mergeWith,
    } = body;

    // Merge: absorb another project's linked items into this one, archive the other
    if (mergeWith) {
      const [current, other] = await Promise.all([
        prisma.smartProject.findUnique({ where: { id } }),
        prisma.smartProject.findUnique({ where: { id: mergeWith } }),
      ]);
      if (!other || !current) {
        return NextResponse.json({ error: "Project to merge not found" }, { status: 404 });
      }
      const uniq = (a: string[], b: string[]) => Array.from(new Set([...a, ...b]));
      const merged = await prisma.smartProject.update({
        where: { id },
        data: {
          linkedTasks: uniq(current.linkedTasks, other.linkedTasks),
          linkedDeadlines: uniq(current.linkedDeadlines, other.linkedDeadlines),
          linkedTrelloCards: uniq(current.linkedTrelloCards, other.linkedTrelloCards),
          linkedProductions: uniq(current.linkedProductions, other.linkedProductions),
          externalPeople: uniq(current.externalPeople, other.externalPeople),
        },
      });
      await prisma.smartProject.update({
        where: { id: mergeWith },
        data: { status: "ARCHIVED" },
      });
      return NextResponse.json(merged);
    }

    const project = await prisma.smartProject.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(description !== undefined ? { description: description || null } : {}),
        ...(brand !== undefined ? { brand: brand || null } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(linkedTasks !== undefined ? { linkedTasks } : {}),
        ...(linkedDeadlines !== undefined ? { linkedDeadlines } : {}),
        ...(linkedTrelloCards !== undefined ? { linkedTrelloCards } : {}),
        ...(linkedProductions !== undefined ? { linkedProductions } : {}),
        ...(externalPeople !== undefined ? { externalPeople } : {}),
      },
    });

    return NextResponse.json(project);
  } catch (err) {
    console.error("PUT /api/intelligence/projects/[id]", err);
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
});

const DELETE__h = withAuth(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;
    await prisma.smartProject.update({
      where: { id },
      data: { status: "ARCHIVED" },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/intelligence/projects/[id]", err);
    return NextResponse.json({ error: "Failed to archive project" }, { status: 500 });
  }
});

export const GET = withErrorHandling(GET__h as any)
export const PUT = withErrorHandling(PUT__h as any)
export const DELETE = withErrorHandling(DELETE__h as any)
