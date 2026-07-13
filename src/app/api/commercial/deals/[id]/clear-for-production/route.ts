import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import {
  parseBudgetBreakdown,
  parseAllocations,
  parseClientBrief,
  productionAllocationOf,
  mapSplitsToCampaignBudget,
  mapSplitToProductionCategory,
  clearForProductionChecklist,
  lastClientRound,
} from "@/lib/deal-stages";

// POST /api/commercial/deals/[id]/clear-for-production
//
// Clears a contracted deal for production in one step:
// - creates a Production (type COMMERCIAL, shown as "Planning") with the
//   deal's production allocation locked in and the creative brief copied across
// - creates a CampaignBudget in Finance with the deal's budget splits
//   (reuses an existing one if the budget was already submitted)
// - marks the deal's brief as SENT_TO_PRODUCTION and logs the activity
export const POST = withAuth(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  user
) => {
  try {
    const { id } = await params;

    const deal = await prisma.campaign.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true } },
        production: { select: { id: true } },
        deliverables: {
          orderBy: [{ isAdditional: "asc" }, { dueDate: { sort: "asc", nulls: "last" } }],
        },
        rounds: { orderBy: { roundNumber: "asc" } },
      },
    });
    if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

    if (deal.production) {
      return NextResponse.json(
        { error: "This deal has already been cleared for production" },
        { status: 400 }
      );
    }

    if (deal.workflowType === "SUPPLIED_ASSETS") {
      return NextResponse.json(
        { error: "Supplied-assets deals don't go to production — mark the deal as Live instead" },
        { status: 400 }
      );
    }

    // Launch checklist gate: creative approved, budget locked, brief attached,
    // deal far enough through the pipeline.
    const checklist = clearForProductionChecklist(deal);
    if (!checklist.ready) {
      const missing = checklist.items.filter((i) => !i.ok).map((i) => i.label);
      return NextResponse.json(
        { error: `Not ready for production. Missing: ${missing.join("; ")}`, checklist: checklist.items },
        { status: 400 }
      );
    }

    const splits = parseBudgetBreakdown(deal.budgetBreakdown);
    const splitTotal = splits.reduce((sum, s) => sum + s.amount, 0);
    const totalBudget = deal.value ?? (splitTotal > 0 ? splitTotal : 0);

    // New-style budget: margin + named allocations, one flagged as the
    // production budget. The production team only gets their allocation —
    // not the whole deal — and builds their own line items within it.
    const allocations = parseAllocations(deal.allocations);
    const hasAllocations = allocations.length > 0;
    const productionAllocation = productionAllocationOf(allocations);

    const productionBudgetTotal = hasAllocations
      ? productionAllocation
      : splitTotal > 0
        ? splitTotal
        : deal.value ?? 0;

    // The brief travels with the production — description for the overview,
    // brief for the "Brief from Commercial" panel. The client brief (case
    // builder) wins; legacy briefContent and the description are fallbacks.
    const clientBrief = parseClientBrief(deal.clientBrief);
    const briefText =
      clientBrief?.content?.trim() || deal.briefContent?.trim() || deal.description || null;

    // Structured production brief (Phase 4F) — the seed the production team
    // starts from. Assembled from the deal so nothing has to be re-keyed.
    const briefData = {
      clientName: deal.client.name,
      budget: productionBudgetTotal,
      deliverables: (deal.deliverables ?? []).map((d) => ({
        title: d.title || d.type,
        type: d.type,
        quantity: d.quantity ?? 1,
      })),
      timeline:
        deal.timelineStart || deal.timelineEnd
          ? [deal.timelineStart, deal.timelineEnd]
              .filter(Boolean)
              .map((d) => new Date(d as Date).toISOString().split("T")[0])
              .join(" → ")
          : deal.dueDate
            ? `Due ${new Date(deal.dueDate).toISOString().split("T")[0]}`
            : null,
      creativeDirection:
        clientBrief?.content?.trim() || deal.briefContent?.trim() || deal.description || null,
      // The approved deck from the final client round travels with the handover.
      approvedDeckUrl: lastClientRound(deal.rounds ?? [])?.deckUrl ?? null,
      // No dedicated audience field on the deal — left for the producer to fill.
      targetAudience: null,
      generatedAt: new Date().toISOString(),
      dealId: deal.id,
    };

    const production = await prisma.production.create({
      data: {
        campaignId: deal.id,
        title: deal.title,
        clientName: deal.client.name,
        brief: briefText,
        description: briefText,
        briefData,
        type: "COMMERCIAL",
        status: "DRAFT", // shown as "Planning" in the Production portal
        budgetTotal: productionBudgetTotal,
        marginTarget: deal.marginPercent ?? null,
        productionBudgetStatus: "BUDGETING",
        // Legacy deals without allocations: copy the splits as starter line
        // items. Allocation-based deals start empty — the production manager
        // budgets their allocation themselves.
        budgetItems: !hasAllocations && splits.length
          ? {
              create: splits.map((s, i) => ({
                category: mapSplitToProductionCategory(s.category),
                description: `${s.category} — from Commercial deal budget`,
                budgeted: s.amount,
                sortOrder: i,
              })),
            }
          : undefined,
      },
    });

    // Finance splits: the production allocation goes in productionBudget;
    // the rest of the allocations map onto the fixed columns by name.
    const financeSplits = hasAllocations
      ? (() => {
          const mapped = mapSplitsToCampaignBudget(
            allocations
              .filter((a) => !a.isProductionBudget)
              .map((a) => ({ category: a.name, amount: a.amount }))
          );
          return {
            productionBudget: productionAllocation + mapped.productionBudget,
            mediaBudget: mapped.mediaBudget,
            internalBudget: mapped.internalBudget,
            otherBudget: mapped.otherBudget,
          };
        })()
      : (() => {
          const mapped = mapSplitsToCampaignBudget(splits);
          return {
            ...mapped,
            otherBudget: splits.length ? mapped.otherBudget : totalBudget,
          };
        })();

    // Reuse a finance budget if one was already created for this deal.
    let campaignBudget = await prisma.campaignBudget.findFirst({
      where: { campaignId: id },
    });
    if (campaignBudget) {
      campaignBudget = await prisma.campaignBudget.update({
        where: { id: campaignBudget.id },
        data: { productionId: production.id, totalBudget, ...financeSplits },
      });
    } else {
      campaignBudget = await prisma.campaignBudget.create({
        data: {
          campaignId: deal.id,
          clientName: deal.client.name,
          campaignName: deal.title,
          totalBudget,
          ...financeSplits,
          status: "SUBMITTED",
          submittedBy: user.userId,
          productionId: production.id,
          notes: `Created from Commercial deal "${deal.title}"`,
        },
      });
    }

    await prisma.production.update({
      where: { id: production.id },
      data: { campaignBudgetId: campaignBudget.id },
    });

    await prisma.campaign.update({
      where: { id: deal.id },
      data: {
        briefStatus: "SENT_TO_PRODUCTION",
        stage: "IN_PRODUCTION",
        stageUpdatedAt: new Date(),
        lastSyncedToProduction: new Date(),
      },
    });

    await prisma.dealActivity.create({
      data: {
        campaignId: deal.id,
        type: "project_started",
        message: `"${deal.title}" cleared for production — brief sent to the production team with £${productionBudgetTotal.toLocaleString()} budget${hasAllocations ? ` (of £${totalBudget.toLocaleString()} total deal)` : ""}`,
        meta: {
          productionId: production.id,
          campaignBudgetId: campaignBudget.id,
          totalBudget,
          productionAllocation: productionBudgetTotal,
        },
        userId: user.userId,
        userName: user.name,
      },
    });

    return NextResponse.json({ production, campaignBudget });
  } catch (err) {
    console.error("POST /api/commercial/deals/[id]/clear-for-production", err);
    return NextResponse.json({ error: "Failed to clear for production" }, { status: 500 });
  }
});
