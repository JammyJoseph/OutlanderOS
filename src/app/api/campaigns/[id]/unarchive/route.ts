import { NextRequest, NextResponse } from "next/server";
import { withAuth, canArchiveDeals } from "@/lib/auth";
import { unarchiveCampaign } from "@/lib/archive";

// PATCH /api/campaigns/[id]/unarchive — restore an archived deal and its
// linked Production project. Restricted to ADMINs and Commercial-team members.
export const PATCH = withAuth(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  user
) => {
  try {
    if (!(await canArchiveDeals(user))) {
      return NextResponse.json(
        { error: "Only the commercial team or an admin can unarchive deals." },
        { status: 403 }
      );
    }
    const { id } = await params;
    const campaign = await unarchiveCampaign(id, user);
    if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(campaign);
  } catch (err) {
    console.error("PATCH /api/campaigns/[id]/unarchive", err);
    return NextResponse.json({ error: "Failed to unarchive deal" }, { status: 500 });
  }
});
