import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, type AuthUser } from "@/lib/auth";
import { sanitizeString } from "@/lib/validate";
import { isCreativeRoundStatus } from "@/lib/deal-stages";

// PUT /api/campaigns/[id]/rounds/[roundId] — update a round's status,
// feedback, deadline, deck link, brief or title.
//
// Status timestamps are stamped automatically: SUBMITTED sets submittedAt,
// the review outcomes (REVIEWED/APPROVED/REVISION_NEEDED) set reviewedAt.
// Moving a round to REVISION_NEEDED auto-creates the next round (same type,
// IN_PROGRESS) so the loop continues without a manual step.
export const PUT = withAuth(async (
  request: NextRequest,
  { params }: { params?: Promise<Record<string, string>> },
  user: AuthUser
) => {
  try {
    const { id, roundId } = (await params) ?? {};
    if (!id || !roundId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const existing = await prisma.creativeRound.findUnique({ where: { id: roundId } });
    if (!existing || existing.campaignId !== id) {
      return NextResponse.json({ error: "Round not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const { status, feedback, deadline, deckUrl, brief, title, objectives, targetAudience, toneDirection, references } =
      body ?? {};

    if (status !== undefined && !isCreativeRoundStatus(status)) {
      return NextResponse.json({ error: `Invalid round status: ${status}` }, { status: 400 });
    }

    const statusChanged = status !== undefined && status !== existing.status;

    const round = await prisma.creativeRound.update({
      where: { id: roundId },
      data: {
        ...(status !== undefined ? { status } : {}),
        ...(feedback !== undefined
          ? { feedback: feedback ? sanitizeString(String(feedback), 20000) : null }
          : {}),
        ...(deadline !== undefined ? { deadline: deadline ? new Date(deadline) : null } : {}),
        ...(deckUrl !== undefined
          ? { deckUrl: deckUrl ? sanitizeString(String(deckUrl), 2000) : null }
          : {}),
        ...(brief !== undefined ? { brief: brief ? sanitizeString(String(brief), 20000) : null } : {}),
        ...(title !== undefined ? { title: title ? sanitizeString(String(title), 200) : null } : {}),
        ...(objectives !== undefined
          ? { objectives: objectives ? sanitizeString(String(objectives), 20000) : null }
          : {}),
        ...(targetAudience !== undefined
          ? { targetAudience: targetAudience ? sanitizeString(String(targetAudience), 2000) : null }
          : {}),
        ...(toneDirection !== undefined
          ? { toneDirection: toneDirection ? sanitizeString(String(toneDirection), 20000) : null }
          : {}),
        ...(references !== undefined
          ? {
              references: Array.isArray(references)
                ? references
                    .filter((r): r is string => typeof r === "string" && r.trim().length > 0)
                    .map((r) => r.trim())
                : [],
            }
          : {}),
        // Stamp the lifecycle timestamps when the status crosses them.
        ...(statusChanged && status === "SUBMITTED" && !existing.submittedAt
          ? { submittedAt: new Date() }
          : {}),
        ...(statusChanged && ["REVIEWED", "APPROVED", "REVISION_NEEDED"].includes(status)
          ? { reviewedAt: new Date() }
          : {}),
      },
    });

    // A revision request spawns the next round automatically.
    let nextRound = null;
    if (statusChanged && status === "REVISION_NEEDED") {
      const last = await prisma.creativeRound.findFirst({
        where: { campaignId: id },
        orderBy: { roundNumber: "desc" },
        select: { roundNumber: true },
      });
      nextRound = await prisma.creativeRound.create({
        data: {
          campaignId: id,
          roundNumber: (last?.roundNumber ?? existing.roundNumber) + 1,
          type: existing.type,
          status: "IN_PROGRESS",
          title: `${existing.type === "CLIENT" ? "Client Revision" : "Internal Revision"}`,
        },
      });
    }

    if (statusChanged) {
      const LABELS: Record<string, string> = {
        IN_PROGRESS: "In Progress",
        SUBMITTED: "Submitted",
        REVIEWED: "Reviewed",
        APPROVED: "Approved",
        REVISION_NEEDED: "Revision Needed",
      };
      await prisma.dealActivity.create({
        data: {
          campaignId: id,
          type: "field_update",
          message: `Creative round ${existing.roundNumber} → ${LABELS[status] ?? status}`,
          meta: { roundId, from: existing.status, to: status },
          userId: user.userId,
          userName: user.name,
        },
      });
    }

    return NextResponse.json({ round, nextRound });
  } catch (err) {
    console.error("PUT /api/campaigns/[id]/rounds/[roundId]", err);
    return NextResponse.json({ error: "Failed to update round" }, { status: 500 });
  }
});
