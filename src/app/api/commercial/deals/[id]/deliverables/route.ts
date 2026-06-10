import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { validateRequired, sanitizeString } from "@/lib/validate";

// GET /api/commercial/deals/[id]/deliverables
export const GET = withAuth(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;
    const deliverables = await prisma.deliverable.findMany({
      where: { campaignId: id },
      orderBy: { dueDate: { sort: "asc", nulls: "last" } },
    });
    return NextResponse.json({ deliverables });
  } catch (err) {
    console.error("GET /api/commercial/deals/[id]/deliverables", err);
    return NextResponse.json({ error: "Failed to fetch deliverables" }, { status: 500 });
  }
});

// POST /api/commercial/deals/[id]/deliverables — add a deliverable to the deal
export const POST = withAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  user
) => {
  try {
    const { id } = await params;
    const body = await request.json();

    const missing = validateRequired(body, ["type"]);
    if (missing) return NextResponse.json({ error: missing }, { status: 400 });

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      select: { id: true, title: true },
    });
    if (!campaign) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

    const deliverable = await prisma.deliverable.create({
      data: {
        campaignId: id,
        type: sanitizeString(body.type, 300),
        description: body.description ? sanitizeString(body.description, 2000) : null,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        status: "PENDING",
      },
    });

    await prisma.dealActivity.create({
      data: {
        campaignId: id,
        type: "deliverable",
        message: `Deliverable "${deliverable.type}" added to "${campaign.title}"`,
        userId: user.userId,
        userName: user.name,
      },
    });

    return NextResponse.json(deliverable, { status: 201 });
  } catch (err) {
    console.error("POST /api/commercial/deals/[id]/deliverables", err);
    return NextResponse.json({ error: "Failed to add deliverable" }, { status: 500 });
  }
});
