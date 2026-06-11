import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { archiveCampaign } from "@/lib/archive";

// PATCH /api/campaigns/[id]/archive — archive a deal. Cascades to the linked
// Production project; the Finance CampaignBudget is kept for historical records.
export const PATCH = withAuth(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  user
) => {
  try {
    const { id } = await params;
    const campaign = await archiveCampaign(id, user);
    if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(campaign);
  } catch (err) {
    console.error("PATCH /api/campaigns/[id]/archive", err);
    return NextResponse.json({ error: "Failed to archive deal" }, { status: 500 });
  }
});
