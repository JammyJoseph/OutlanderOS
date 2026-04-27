import { NextRequest, NextResponse } from "next/server";
import { addComment, getComments } from "@/lib/trello";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const comments = await getComments(id);
    return NextResponse.json({ comments });
  } catch (err) {
    console.error("GET /api/trello/cards/[id]/comments", err);
    const message = err instanceof Error ? err.message : "Failed to fetch comments";
    return NextResponse.json({ error: message, comments: [] }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }
    const comment = await addComment(id, text);
    return NextResponse.json({ comment });
  } catch (err) {
    console.error("POST /api/trello/cards/[id]/comments", err);
    const message = err instanceof Error ? err.message : "Failed to add comment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
