import { withErrorHandling } from "@/lib/api-error"
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { detectProjectFromNewItem } from "@/lib/ai-intelligence";

async function GET__inner(request: NextRequest) {
  const me = getCurrentUser(request);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const source = searchParams.get("source");
    const priority = searchParams.get("priority");
    const all = searchParams.get("all") === "true";

    const where: Record<string, unknown> = {};
    // Members only ever see their own deadlines; admins may request all.
    if (!(all && me.role === "ADMIN")) where.assignedTo = me.userId;
    if (status) where.status = status;
    if (type) where.type = type;
    if (source) where.source = source;
    if (priority) where.priority = priority;

    const deadlines = await prisma.deadline.findMany({
      where,
      orderBy: { dueDate: "asc" },
    });

    const now = new Date();
    const decorated = deadlines.map((d) => {
      if (d.status === "ACTIVE" && d.dueDate < now) {
        return { ...d, status: "OVERDUE" };
      }
      if (d.status === "SNOOZED" && d.snoozedUntil && d.snoozedUntil <= now) {
        return { ...d, status: d.dueDate < now ? "OVERDUE" : "ACTIVE" };
      }
      return d;
    });

    return NextResponse.json(decorated);
  } catch (err) {
    console.error("GET /api/deadlines", err);
    return NextResponse.json(
      { error: "Failed to fetch deadlines" },
      { status: 500 }
    );
  }
}

async function POST__inner(request: NextRequest) {
  const me = getCurrentUser(request);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const {
      title,
      description,
      dueDate,
      type = "other",
      priority = "MEDIUM",
      source = "manual",
      sourceRef,
      sourceUrl,
      emailFrom,
      emailSnippet,
    } = body;

    if (!title?.trim() || !dueDate) {
      return NextResponse.json(
        { error: "title and dueDate are required" },
        { status: 400 }
      );
    }

    const deadline = await prisma.deadline.create({
      data: {
        title: title.trim(),
        description: description ?? null,
        dueDate: new Date(dueDate),
        type,
        priority,
        source,
        sourceRef: sourceRef ?? null,
        sourceUrl: sourceUrl ?? null,
        emailFrom: emailFrom ?? null,
        emailSnippet: emailSnippet ?? null,
        assignedTo: me.userId,
        createdBy: me.userId,
      },
    });

    try {
      await detectProjectFromNewItem({
        type: "deadline",
        id: deadline.id,
        title: deadline.title,
        description: deadline.description,
        context: deadline.category ?? deadline.type,
      });
    } catch {
      // Non-fatal — periodic analysis will catch it
    }

    return NextResponse.json(deadline, { status: 201 });
  } catch (err) {
    console.error("POST /api/deadlines", err);
    return NextResponse.json(
      { error: "Failed to create deadline" },
      { status: 500 }
    );
  }
}

export const GET = withErrorHandling(GET__inner as any)
export const POST = withErrorHandling(POST__inner as any)
