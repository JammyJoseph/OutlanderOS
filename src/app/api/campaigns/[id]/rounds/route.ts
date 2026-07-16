import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, type AuthUser } from "@/lib/auth";
import { sanitizeString } from "@/lib/validate";
import {
  isCreativeRoundType,
  isCreativeRoundStatus,
  deriveStageFromSignals,
  maybeAdvanceStage,
  AUTO_STAGE_REASONS,
} from "@/lib/deal-stages";

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
    const { type, title, brief, deadline, deckUrl, status, objectives, targetAudience, toneDirection, references } =
      body ?? {};

    if (type !== undefined && !isCreativeRoundType(type)) {
      return NextResponse.json({ error: `Invalid round type: ${type}` }, { status: 400 });
    }
    if (status !== undefined && !isCreativeRoundStatus(status)) {
      return NextResponse.json({ error: `Invalid round status: ${status}` }, { status: 400 });
    }
    const cleanRefs = Array.isArray(references)
      ? references.filter((r): r is string => typeof r === "string" && r.trim().length > 0).map((r) => r.trim())
      : [];

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
        objectives: objectives ? sanitizeString(String(objectives), 20000) : null,
        targetAudience: targetAudience ? sanitizeString(String(targetAudience), 2000) : null,
        toneDirection: toneDirection ? sanitizeString(String(toneDirection), 20000) : null,
        references: cleanRefs,
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

    // Auto stage tracking: a pitching round starting nudges the deal into
    // Pitching & Feedback (forward-only — no-op if the deal is already there
    // or further; manual stage changes always win).
    if (round.type !== "KICK_OFF") {
      const dealState = await prisma.campaign.findUnique({
        where: { id },
        select: { ioSigned: true, workflowType: true },
      });
      const allRounds = await prisma.creativeRound.findMany({
        where: { campaignId: id },
        select: { type: true, status: true, roundNumber: true },
      });
      const derived = dealState ? deriveStageFromSignals(dealState, allRounds) : null;
      if (derived) {
        await maybeAdvanceStage(
          prisma,
          id,
          derived,
          AUTO_STAGE_REASONS[derived] ?? "creative rounds under way"
        );
      }
    }

    return NextResponse.json(round, { status: 201 });
  } catch (err) {
    console.error("POST /api/campaigns/[id]/rounds", err);
    return NextResponse.json({ error: "Failed to create round" }, { status: 500 });
  }
});
