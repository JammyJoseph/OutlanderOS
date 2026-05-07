import { NextRequest, NextResponse } from "next/server";
import { createCard } from "@/lib/trello";
import { clearCachedSnapshot } from "@/lib/trello-cache";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body?.idList || !body?.name) {
      return NextResponse.json({ error: "idList and name are required" }, { status: 400 });
    }
    const card = await createCard({
      name: String(body.name),
      desc: typeof body.desc === "string" ? body.desc : undefined,
      idList: String(body.idList),
      due: body.due ?? undefined,
      idLabels: Array.isArray(body.idLabels) ? body.idLabels : undefined,
      idMembers: Array.isArray(body.idMembers) ? body.idMembers : undefined,
      pos: body.pos ?? "top",
    });
    clearCachedSnapshot();
    return NextResponse.json(card);
  } catch (err) {
    console.error("POST /api/trello/cards", err);
    const message = err instanceof Error ? err.message : "Failed to create card";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
