import { withErrorHandling } from "@/lib/api-error"
import { NextRequest, NextResponse } from "next/server";
import { getChecklists } from "@/lib/trello";
import { withAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const GET__h = withAuth(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;
    const checklists = await getChecklists(id);
    return NextResponse.json({ checklists });
  } catch (err) {
    console.error("GET /api/trello/cards/[id]/checklist", err);
    const message = err instanceof Error ? err.message : "Failed to fetch checklists";
    return NextResponse.json({ error: message, checklists: [] }, { status: 500 });
  }
});

export const GET = withErrorHandling(GET__h as any)
