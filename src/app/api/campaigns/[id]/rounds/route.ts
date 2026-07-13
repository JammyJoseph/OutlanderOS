import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, type AuthUser } from "@/lib/auth";
import { sanitizeString } from "@/lib/validate";
import { isCreativeRoundType, isCreativeRoundStatus } from "@/lib/deal-stages";

// GET /api/campaigns/[id]/rounds — list a deal's creative rounds in order.
export const GET = withAuth(async (
  _request: NextRequest,
  { params }: { params?: Promise<Record<string, string>> }
) => {
  try {
    const { id } = (await params) ?? {};
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const rounds = await prisma.creativeRound.findMany({
      where: { campaignId: id },
      orderBy: { roundNumber: "asc" },
    });
    return NextResponse.json(rounds);
  } catch (err) {
    console.error("GET /api/campaigns/[id]/rounds", err);
    return NextResponse.json({ error: "Failed to fetch rounds" }, { status: 500 });
  }
});

// POST /api/campaigns/[id]/rounds — create a new round. roundNumber is
// auto-incremented from the deal's existing rounds. Defaults: INTERNAL,
// IN_PROGRESS. type/title/brief/deadline/deckUrl can be supplied.
export const POST = withAuth(async (
  request: NextRequest,
  { params }: { params?: Promise<Record<string, string>> },
  user: AuthUser
) => {
  try {
    const { id } = (await params) ?? {};
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      select: { id: true, title: true },
    });
    if (!campaign) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const { type, title, brief, deadline, deckUrl, status } = body ?? {};

    if (type !== undefined && !isCreativeRoundType(type)) {
      return NextResponse.json({ error: `Invalid round type: ${type}` }, { status: 400 });
    }
    if (status !== undefined && !isCreativeRoundStatus(status)) {
      return NextResponse.json({ error: `Invalid round status: ${status}` }, { status: 400 });
    }

    const last = await prisma.creativeRound.findFirst({
      where: { campaignId: id },
      orderBy: { roundNumber: "desc" },
      select: { roundNumber: true },
    });
    const roundNumber = (last?.roundNumber ?? 0) + 1;

    const round = await prisma.creativeRound.create({
      data: {
        campaignId: id,
        roundNumber,
        type: isCreativeRoundType(type) ? type : "INTERNAL",
        status: isCreativeRoundStatus(status) ? status : "IN_PROGRESS",
        title: title ? sanitizeString(String(title), 200) : null,
        brief: brief ? sanitizeString(String(brief), 20000) : null,
        deadline: deadline ? new Date(deadline) : null,
        deckUrl: deckUrl ? sanitizeString(String(deckUrl), 2000) : null,
      },
    });

    await prisma.dealActivity.create({
      data: {
        campaignId: id,
        type: "field_update",
        message: `Creative round ${roundNumber} (${round.type === "CLIENT" ? "Client" : "Internal"}) started on "${campaign.title}"`,
        meta: { roundId: round.id, roundNumber, roundType: round.type },
        userId: user.userId,
        userName: user.name,
      },
    });

    return NextResponse.json(round, { status: 201 });
  } catch (err) {
    console.error("POST /api/campaigns/[id]/rounds", err);
    return NextResponse.json({ error: "Failed to create round" }, { status: 500 });
  }
});
