import { NextRequest, NextResponse } from "next/server";
import { archiveCard, fetchCard, getChecklists, getComments, updateCard } from "@/lib/trello";
import { clearCachedSnapshot } from "@/lib/trello-cache";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const includeChecklists = url.searchParams.get("checklists") === "true";
    const includeComments = url.searchParams.get("comments") === "true";

    const card = await fetchCard(id);
    const result: Record<string, unknown> = { card };
    if (includeChecklists) result.checklists = await getChecklists(id);
    if (includeComments) result.comments = await getComments(id);
    return NextResponse.json(result);
  } catch (err) {
    console.error("GET /api/trello/cards/[id]", err);
    const message = err instanceof Error ? err.message : "Failed to fetch card";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const card = await updateCard(id, {
      name: typeof body.name === "string" ? body.name : undefined,
      desc: typeof body.desc === "string" ? body.desc : undefined,
      due: body.due === null ? null : typeof body.due === "string" ? body.due : undefined,
      idList: typeof body.idList === "string" ? body.idList : undefined,
      idLabels: Array.isArray(body.idLabels) ? body.idLabels : undefined,
      idMembers: Array.isArray(body.idMembers) ? body.idMembers : undefined,
      pos: body.pos,
    });
    clearCachedSnapshot();
    return NextResponse.json(card);
  } catch (err) {
    console.error("PUT /api/trello/cards/[id]", err);
    const message = err instanceof Error ? err.message : "Failed to update card";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const card = await archiveCard(id);
    clearCachedSnapshot();
    return NextResponse.json(card);
  } catch (err) {
    console.error("DELETE /api/trello/cards/[id]", err);
    const message = err instanceof Error ? err.message : "Failed to archive card";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
