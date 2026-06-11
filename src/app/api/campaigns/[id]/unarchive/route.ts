import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { unarchiveCampaign } from "@/lib/archive";

// PATCH /api/campaigns/[id]/unarchive — restore an archived deal and its
// linked Production project.
export const PATCH = withAuth(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  user
) => {
  try {
    const { id } = await params;
    const campaign = await unarchiveCampaign(id, user);
    if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(campaign);
  } catch (err) {
    console.error("PATCH /api/campaigns/[id]/unarchive", err);
    return NextResponse.json({ error: "Failed to unarchive deal" }, { status: 500 });
  }
});
