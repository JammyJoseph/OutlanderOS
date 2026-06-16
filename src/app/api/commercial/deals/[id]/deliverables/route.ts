import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, isAdminInDb } from "@/lib/auth";
import { validateRequired, sanitizeString } from "@/lib/validate";
import { normalizeStage, PIPELINE_STAGES } from "@/lib/deal-stages";

// Contracted deliverables lock once the deal reaches IO_SIGNED. Additional
// (scope-creep) deliverables can be added at any point after sign-off.
function contractedLocked(stage: string): boolean {
  return PIPELINE_STAGES.indexOf(normalizeStage(stage)) >= PIPELINE_STAGES.indexOf("IO_SIGNED");
}

// GET /api/commercial/deals/[id]/deliverables
export const GET = withAuth(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;
    const deliverables = await prisma.deliverable.findMany({
      where: { campaignId: id },
      orderBy: [{ isAdditional: "asc" }, { dueDate: { sort: "asc", nulls: "last" } }],
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

    // `type` carries the title for the simple add form; `title` is preferred.
    const titleOrType = body.title ?? body.type;
    if (!titleOrType || !String(titleOrType).trim()) {
      const missing = validateRequired(body, ["type"]);
      return NextResponse.json({ error: missing ?? "A title is required" }, { status: 400 });
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      select: { id: true, title: true, stage: true },
    });
    if (!campaign) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

    const isAdditional = Boolean(body.isAdditional);

    // Contracted deliverables are frozen once the IO is signed — only an admin
    // can add one after that. Additional deliverables are always allowed.
    if (!isAdditional && contractedLocked(campaign.stage) && !(await isAdminInDb(user))) {
      return NextResponse.json(
        { error: "Contracted deliverables are locked once the deal is past IO Signed. Add it as an Additional (scope creep) deliverable, or ask an admin." },
        { status: 403 }
      );
    }

    const overageCost =
      body.overageCost === undefined || body.overageCost === null || body.overageCost === ""
        ? null
        : Number(body.overageCost);
    const approvedBy = body.approvedBy ? sanitizeString(body.approvedBy, 200) : null;

    const deliverable = await prisma.deliverable.create({
      data: {
        campaignId: id,
        title: body.title ? sanitizeString(body.title, 300) : null,
        type: sanitizeString(String(titleOrType), 300),
        quantity: body.quantity != null ? Math.max(1, parseInt(String(body.quantity), 10) || 1) : 1,
        description: body.description ? sanitizeString(body.description, 2000) : null,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        status: "PENDING",
        isAdditional,
        overageCost: isAdditional ? overageCost : null,
        approvedBy: isAdditional ? approvedBy : null,
        approvedAt: isAdditional && approvedBy ? new Date() : null,
        postedUrl: body.postedUrl ? sanitizeString(body.postedUrl, 1000) : null,
      },
    });

    await prisma.dealActivity.create({
      data: {
        campaignId: id,
        type: "deliverable",
        message: isAdditional
          ? `Additional deliverable "${deliverable.title ?? deliverable.type}" added to "${campaign.title}"${overageCost ? ` (+£${overageCost.toLocaleString("en-GB")} overage)` : ""}`
          : `Deliverable "${deliverable.title ?? deliverable.type}" added to "${campaign.title}"`,
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
