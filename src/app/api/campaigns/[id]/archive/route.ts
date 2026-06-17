import { NextRequest, NextResponse } from "next/server";
import { withAuth, canArchiveDeals } from "@/lib/auth";
import { archiveCampaign } from "@/lib/archive";

// PATCH /api/campaigns/[id]/archive — archive a deal. Cascades to the linked
// Production project; the Finance CampaignBudget is kept for historical records.
// Restricted to ADMINs and Commercial-team members.
export const PATCH = withAuth(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  user
) => {
  try {
    if (!(await canArchiveDeals(user))) {
      return NextResponse.json(
        { error: "Only the commercial team or an admin can archive deals." },
        { status: 403 }
      );
    }
    const { id } = await params;
    const campaign = await archiveCampaign(id, user);
    if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(campaign);
  } catch (err) {
    console.error("PATCH /api/campaigns/[id]/archive", err);
    return NextResponse.json({ error: "Failed to archive deal" }, { status: 500 });
  }
});
