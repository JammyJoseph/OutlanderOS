import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

// Aggregates every shot from the production's call-sheet shot lists into a flat,
// de-duplicated list keyed by shot number. Used by the Deliverables views to
// map deliverables to the shots they're produced from.
export const GET = withAuth(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  try {
    const callSheets = await prisma.callSheet.findMany({
      where: { productionId: id },
      orderBy: { shootDate: "asc" },
      select: { id: true, shootTitle: true, shootDate: true, shotlist: true },
    });

    const byNumber = new Map<
      string,
      { shotNumber: string; description: string; locationRef: string; callSheetId: string }
    >();

    for (const cs of callSheets) {
      const list = Array.isArray(cs.shotlist) ? (cs.shotlist as unknown[]) : [];
      list.forEach((raw, i) => {
        const s = (raw ?? {}) as Record<string, unknown>;
        const num = String(s.shotNumber || i + 1);
        if (byNumber.has(num)) return; // first occurrence wins
        byNumber.set(num, {
          shotNumber: num,
          description: typeof s.description === "string" ? s.description : "",
          locationRef: typeof s.locationRef === "string" ? s.locationRef : "",
          callSheetId: cs.id,
        });
      });
    }

    // Numeric-aware sort so "2" precedes "10".
    const shots = Array.from(byNumber.values()).sort((a, b) => {
      const na = parseInt(a.shotNumber, 10);
      const nb = parseInt(b.shotNumber, 10);
      if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
      return a.shotNumber.localeCompare(b.shotNumber);
    });

    return NextResponse.json({ shots });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
});
