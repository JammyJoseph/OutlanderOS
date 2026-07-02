import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

export const GET = withAuth(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  try {
    const tasks = await prisma.productionTask.findMany({
      where: { productionId: id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json({ tasks });
  } catch (e) {
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
});

export const POST = withAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const body = await request.json();
  try {
    const dependsOn = body.dependsOn || null;
    let initialStatus = body.status || "READY";
    if (dependsOn) {
      const parent = await prisma.productionTask.findUnique({ where: { id: dependsOn } });
      if (parent && parent.status !== "DONE") initialStatus = "LOCKED";
    }
    const count = await prisma.productionTask.count({ where: { productionId: id } });
    const task = await prisma.productionTask.create({
      data: {
        productionId: id,
        title: body.title || "Untitled task",
        description: body.description || null,
        owner: body.owner || null,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        status: initialStatus,
        dependsOn,
        sortOrder: body.sortOrder == null ? count : Number(body.sortOrder),
      },
    });
    return NextResponse.json({ task });
  } catch (e) {
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
});

export const PUT = withAuth(async (request: NextRequest) => {
  const url = new URL(request.url);
  const taskId = url.searchParams.get("taskId");
  if (!taskId) return NextResponse.json({ error: "taskId required" }, { status: 400 });
  const body = await request.json();
  try {
    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.description !== undefined) data.description = body.description || null;
    if (body.owner !== undefined) data.owner = body.owner || null;
    if (body.dueDate !== undefined)
      data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (body.status !== undefined) data.status = body.status;
    if (body.dependsOn !== undefined) data.dependsOn = body.dependsOn || null;
    if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder);

    const task = await prisma.productionTask.update({ where: { id: taskId }, data });

    let unlockedIds: string[] = [];
    if (body.status === "DONE") {
      const dependents = await prisma.productionTask.findMany({
        where: { dependsOn: taskId, status: "LOCKED" },
      });
      if (dependents.length > 0) {
        await prisma.productionTask.updateMany({
          where: { dependsOn: taskId, status: "LOCKED" },
          data: { status: "READY" },
        });
        unlockedIds = dependents.map((d) => d.id);
      }
    }
    return NextResponse.json({ task, unlockedIds });
  } catch (e) {
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
});

export const DELETE = withAuth(async (request: NextRequest) => {
  const url = new URL(request.url);
  const taskId = url.searchParams.get("taskId");
  if (!taskId) return NextResponse.json({ error: "taskId required" }, { status: 400 });
  try {
    await prisma.productionTask.updateMany({
      where: { dependsOn: taskId },
      data: { dependsOn: null },
    });
    await prisma.productionTask.delete({ where: { id: taskId } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
});
