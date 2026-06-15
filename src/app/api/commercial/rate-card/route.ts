import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, isAdminInDb } from "@/lib/auth";
import { DEFAULT_RATE_CARD } from "@/lib/rate-card";

// GET /api/commercial/rate-card — the preset placements that pre-fill the media
// plan builder. Seeds Outlander's defaults the first time the table is empty.
export const GET = withAuth(async () => {
  try {
    let placements = await prisma.rateCardPlacement.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
    });

    if (placements.length === 0) {
      await prisma.rateCardPlacement.createMany({
        data: DEFAULT_RATE_CARD.map((p, i) => ({ ...p, sortOrder: i })),
        skipDuplicates: true,
      });
      placements = await prisma.rateCardPlacement.findMany({
        where: { active: true },
        orderBy: { sortOrder: "asc" },
      });
    }

    return NextResponse.json(
      placements.map((p) => ({
        name: p.name,
        rate: p.rate,
        impressions: p.impressions,
        rateType: p.rateType,
        measurement: p.measurement,
      }))
    );
  } catch (err) {
    console.error("GET /api/commercial/rate-card", err);
    // Fall back to the static defaults so the builder always has placements.
    return NextResponse.json(DEFAULT_RATE_CARD);
  }
});

// PUT /api/commercial/rate-card — replace the rate card (admin only).
// Body: { placements: [{ name, rate, impressions, rateType, measurement }] }
export const PUT = withAuth(async (request: NextRequest, _ctx, user) => {
  try {
    if (!(await isAdminInDb(user))) {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }
    const body = await request.json();
    const rows = Array.isArray(body.placements) ? body.placements : [];
    const cleaned = rows
      .filter((r: unknown): r is Record<string, unknown> => !!r && typeof r === "object")
      .map((r: Record<string, unknown>, i: number) => ({
        name: String(r.name ?? "").trim(),
        rate: Number(r.rate) || 0,
        impressions: Math.round(Number(r.impressions) || 0),
        rateType: String(r.rateType ?? "Flat Fee"),
        measurement: String(r.measurement ?? "Impressions"),
        sortOrder: i,
        active: true,
      }))
      .filter((r: { name: string }) => r.name.length > 0);

    // Replace wholesale: deactivate everything, then upsert the supplied rows.
    await prisma.rateCardPlacement.updateMany({ data: { active: false } });
    for (const row of cleaned) {
      await prisma.rateCardPlacement.upsert({
        where: { name: row.name },
        update: row,
        create: row,
      });
    }

    return NextResponse.json({ count: cleaned.length });
  } catch (err) {
    console.error("PUT /api/commercial/rate-card", err);
    return NextResponse.json({ error: "Failed to save rate card" }, { status: 500 });
  }
});
