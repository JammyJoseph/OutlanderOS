import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

// Catering readiness for upcoming shoots. For each future call sheet we report
// how many dietary requirements have been captured ("returned") against the
// roster headcount ("total") — e.g. "3/8 dietary forms returned".

type DietaryItem = { name?: string; requirement?: string };
type Catering = { headcountOverride?: string; dietary?: DietaryItem[] };

function rosterCount(crew: unknown, talent: unknown): number {
  const c = Array.isArray(crew) ? crew.length : 0;
  const t = Array.isArray(talent) ? talent.length : 0;
  return c + t;
}

export const GET = withAuth(async (_request: NextRequest) => {
  try {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const sheets = await prisma.callSheet.findMany({
      where: {
        shootDate: { gte: now },
        production: { archived: false },
      },
      orderBy: { shootDate: "asc" },
      take: 12,
      select: {
        id: true,
        shootDate: true,
        shootTitle: true,
        cateringDetails: true,
        crew: true,
        talent: true,
        production: { select: { id: true, title: true, billingType: true, type: true } },
      },
    });

    const shoots = sheets.map((cs) => {
      const catering = (cs.cateringDetails ?? {}) as Catering;
      const dietary = Array.isArray(catering.dietary) ? catering.dietary : [];
      const returned = dietary.filter((d) => (d.name ?? "").trim() !== "").length;

      const roster = rosterCount(cs.crew, cs.talent);
      const override = parseInt(catering.headcountOverride ?? "", 10);
      const total =
        Number.isFinite(override) && (catering.headcountOverride ?? "").trim() !== ""
          ? override
          : roster;

      const isPaid =
        cs.production.billingType === "PAID" || cs.production.type === "COMMERCIAL";

      return {
        callSheetId: cs.id,
        productionId: cs.production.id,
        productionTitle: cs.production.title,
        shootTitle: cs.shootTitle,
        shootDate: cs.shootDate,
        billingType: isPaid ? "PAID" : "EDITORIAL",
        returned,
        total,
      };
    });

    return NextResponse.json({ shoots });
  } catch (e) {
    return NextResponse.json({ shoots: [], error: "An error occurred" });
  }
});
