import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

type MilestoneInput = {
  phase?: string;
  date?: string;
  title?: string;
  description?: string | null;
  done?: boolean;
  sortOrder?: number;
};

const PHASES = ["PRE_PRODUCTION", "PRODUCTION", "POST_PRODUCTION"];
function normPhase(p: string | undefined): string {
  return p && PHASES.includes(p) ? p : "PRE_PRODUCTION";
}

export const GET = withAuth(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  try {
    const milestones = await prisma.productionMilestone.findMany({
      where: { productionId: id },
      orderBy: [{ date: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json({ milestones });
  } catch (e) {
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
});

// POST accepts either a single milestone or a bulk import: { milestones: [...] }
// from the paste-a-timeline parser.
export const POST = withAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const body = await request.json();
  try {
    if (Array.isArray(body.milestones)) {
      const rows = (body.milestones as MilestoneInput[])
        .filter((m) => m.date)
        .map((m, i) => ({
          productionId: id,
          phase: normPhase(m.phase),
          date: new Date(m.date as string),
          title: m.title || "Milestone",
          description: m.description || null,
          done: !!m.done,
          sortOrder: m.sortOrder ?? i,
        }));
      if (rows.length === 0)
        return NextResponse.json({ error: "No valid milestones" }, { status: 400 });
      await prisma.productionMilestone.createMany({ data: rows });
      const milestones = await prisma.productionMilestone.findMany({
        where: { productionId: id },
        orderBy: [{ date: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
      });
      return NextResponse.json({ milestones });
    }

    const m = body as MilestoneInput;
    const item = await prisma.productionMilestone.create({
      data: {
        productionId: id,
        phase: normPhase(m.phase),
        date: m.date ? new Date(m.date) : new Date(),
        title: m.title || "Milestone",
        description: m.description || null,
        done: !!m.done,
        sortOrder: m.sortOrder ?? 0,
      },
    });
    return NextResponse.json({ item });
  } catch (e) {
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
});

export const PUT = withAuth(async (request: NextRequest) => {
  const url = new URL(request.url);
  const milestoneId = url.searchParams.get("milestoneId");
  if (!milestoneId)
    return NextResponse.json({ error: "milestoneId required" }, { status: 400 });
  const body = (await request.json()) as MilestoneInput;
  try {
    const data: Record<string, unknown> = {};
    if (body.phase !== undefined) data.phase = normPhase(body.phase);
    if (body.date !== undefined) data.date = new Date(body.date);
    if (body.title !== undefined) data.title = body.title;
    if (body.description !== undefined) data.description = body.description || null;
    if (body.done !== undefined) data.done = !!body.done;
    if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder;

    const item = await prisma.productionMilestone.update({
      where: { id: milestoneId },
      data,
    });
    return NextResponse.json({ item });
  } catch (e) {
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
});

export const DELETE = withAuth(async (request: NextRequest) => {
  const url = new URL(request.url);
  const milestoneId = url.searchParams.get("milestoneId");
  if (!milestoneId)
    return NextResponse.json({ error: "milestoneId required" }, { status: 400 });
  try {
    await prisma.productionMilestone.delete({ where: { id: milestoneId } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
});
