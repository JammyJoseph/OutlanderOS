import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

export const GET = withAuth(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  try {
    const production = await prisma.production.findUnique({
      where: { id },
      include: {
        campaign: { include: { client: true } },
        crew: { include: { contact: true } },
        callSheets: {
          orderBy: { shootDate: "asc" },
          select: {
            id: true,
            status: true,
            shootDate: true,
            callTime: true,
            location: true,
            notes: true,
            distributedAt: true,
          },
        },
        expenses: { orderBy: { createdAt: "asc" } },
        budgetItems: { orderBy: [{ category: "asc" }, { sortOrder: "asc" }] },
        productionTasks: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
        teamMembers: { orderBy: [{ status: "desc" }, { createdAt: "asc" }] },
        creativeAssets: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
        scheduleBlocks: { orderBy: [{ shootDay: "asc" }, { time: "asc" }] },
        prodDeliverables: { orderBy: [{ status: "asc" }, { createdAt: "asc" }] },
      },
    });
    if (!production) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ production });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
});

export const PUT = withAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const body = await request.json();
  try {
    const existing = await prisma.production.findUnique({
      where: { id },
      select: { type: true, status: true, campaignId: true },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.brief !== undefined) updateData.brief = body.brief;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.figmaUrl !== undefined) updateData.figmaUrl = body.figmaUrl || null;
    if (body.clientName !== undefined) updateData.clientName = body.clientName || null;
    if (body.client !== undefined && body.clientName === undefined) {
      updateData.clientName = body.client || null;
    }
    if (body.status !== undefined) updateData.status = body.status;
    if (body.budgetTotal !== undefined) {
      // COMMERCIAL productions have their total allocation locked by the
      // Commercial team — production can log costs but not change the total.
      if (existing.type === "COMMERCIAL") {
        return NextResponse.json(
          { error: "Budget allocation is locked by the Commercial team and cannot be changed from Production." },
          { status: 403 }
        );
      }
      updateData.budgetTotal = body.budgetTotal === null || body.budgetTotal === ""
        ? null
        : Number(body.budgetTotal);
    }
    if (body.budgetActual !== undefined) {
      updateData.budgetActual = body.budgetActual === null || body.budgetActual === ""
        ? null
        : Number(body.budgetActual);
    }
    if (body.marginTarget !== undefined) updateData.marginTarget = body.marginTarget;
    if (body.shootDates !== undefined) {
      updateData.shootDates = (body.shootDates ?? [])
        .filter((d: string) => d)
        .map((d: string) => new Date(d));
    }
    if (body.campaignId !== undefined) updateData.campaignId = body.campaignId || null;
    if (body.leadId !== undefined) updateData.leadId = body.leadId || null;
    if (body.trelloCardId !== undefined) {
      updateData.trelloCardId = body.trelloCardId || null;
    }

    const production = await prisma.production.update({
      where: { id },
      data: updateData,
      include: {
        campaign: { include: { client: true } },
        crew: { include: { contact: true } },
        callSheets: {
          orderBy: { shootDate: "asc" },
          select: {
            id: true,
            status: true,
            shootDate: true,
            callTime: true,
            location: true,
            notes: true,
          },
        },
      },
    });

    // Stage sync: production delivered → move the linked deal from Live to
    // Completed in the Commercial pipeline.
    if (
      body.status === "DELIVERED" &&
      existing.status !== "DELIVERED" &&
      production.campaignId
    ) {
      const campaign = await prisma.campaign.findUnique({
        where: { id: production.campaignId },
        select: { id: true, stage: true, title: true },
      });
      if (campaign?.stage === "LIVE") {
        await prisma.campaign.update({
          where: { id: campaign.id },
          data: { stage: "COMPLETED", stageUpdatedAt: new Date() },
        });
        await prisma.dealActivity.create({
          data: {
            campaignId: campaign.id,
            type: "stage_change",
            message: `"${campaign.title}" moved from LIVE to COMPLETED — production "${production.title}" delivered`,
            meta: { from: "LIVE", to: "COMPLETED", source: "production" },
          },
        });
      }
    }

    return NextResponse.json({ production });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
});

export const DELETE = withAuth(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  try {
    await prisma.production.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
});
