import { withErrorHandling } from "@/lib/api-error"
import { NextRequest, NextResponse } from "next/server";
import { updateCheckItem } from "@/lib/trello";
import { withAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const PUT__h = withAuth(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) => {
  try {
    const { id, itemId } = await params;
    const body = await req.json();
    const state = body?.state === "complete" ? "complete" : "incomplete";
    const item = await updateCheckItem(id, itemId, state);
    return NextResponse.json({ item });
  } catch (err) {
    console.error("PUT /api/trello/cards/[id]/checkitem/[itemId]", err);
    const message = err instanceof Error ? err.message : "Failed to update checkitem";
    return NextResponse.json({ error: message }, { status: 500 });
  }
});

export const PUT = withErrorHandling(PUT__h as any)
