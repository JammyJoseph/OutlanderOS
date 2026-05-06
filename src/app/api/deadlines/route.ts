import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

async function resolveUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  let userId = session?.user?.id;
  if (!userId) {
    const fallback = await prisma.user.findFirst();
    if (!fallback) return null;
    userId = fallback.id;
  }
  return userId;
}

export async function GET(request: NextRequest) {
  try {
    const userId = await resolveUserId();
    if (!userId) {
      return NextResponse.json({ error: "No user found" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const source = searchParams.get("source");
    const priority = searchParams.get("priority");

    const where: Record<string, unknown> = { assignedTo: userId };
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
      if (
        d.status === "SNOOZED" &&
        d.snoozedUntil &&
        d.snoozedUntil <= now
      ) {
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

export async function POST(request: NextRequest) {
  try {
    const userId = await resolveUserId();
    if (!userId) {
      return NextResponse.json({ error: "No user found" }, { status: 500 });
    }

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
        assignedTo: userId,
        createdBy: userId,
      },
    });

    return NextResponse.json(deadline, { status: 201 });
  } catch (err) {
    console.error("POST /api/deadlines", err);
    return NextResponse.json(
      { error: "Failed to create deadline" },
      { status: 500 }
    );
  }
}
