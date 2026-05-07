import { NextRequest, NextResponse } from "next/server";
import { getChecklists } from "@/lib/trello";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const checklists = await getChecklists(id);
    return NextResponse.json({ checklists });
  } catch (err) {
    console.error("GET /api/trello/cards/[id]/checklist", err);
    const message = err instanceof Error ? err.message : "Failed to fetch checklists";
    return NextResponse.json({ error: message, checklists: [] }, { status: 500 });
  }
}
