import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { validateRequired, sanitizeString } from "@/lib/validate";
import { seedShootDateMilestone, earliestShoot } from "@/lib/production-seed";

export const GET = withAuth(async (request: NextRequest) => {
  try {
    const trelloCardId = request.nextUrl.searchParams.get("trelloCardId");
    if (trelloCardId) {
      const production = await prisma.production.findFirst({
        where: { trelloCardId },
        select: { id: true, title: true, status: true, clientName: true },
      });
      return NextResponse.json({ production });
    }
    // Archived productions are hidden by default; ?includeArchived=true
    // returns them too (the landing page shows them muted).
    const includeArchived = request.nextUrl.searchParams.get("includeArchived") === "true";
    const productions = await prisma.production.findMany({
      where: includeArchived ? {} : { archived: false },
      include: {
        campaign: { include: { client: true } },
        crew: { include: { contact: true } },
        callSheets: {
          select: { id: true, shootDate: true, status: true, callTime: true, location: true, shootTitle: true, notes: true },
        },
        // Milestones feed the dashboard hero calendar (deadlines + key events)
        // and support inline quick-complete.
        milestones: {
          select: { id: true, phase: true, date: true, title: true, done: true, isMilestone: true },
          orderBy: [{ date: "asc" }, { sortOrder: "asc" }],
        },
      },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json({ productions });
  } catch (e) {
    // Never answer 200 + [] here. An empty list is indistinguishable from
    // "every project was deleted", so a transient DB error would read to the
    // user as data loss. Fail loudly and let the client show an error state.
    console.error("GET /api/productions failed:", e);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
});

export const POST = withAuth(async (request: NextRequest) => {
  const body = await request.json();

  const missing = validateRequired(body, ["title"]);
  if (missing) return NextResponse.json({ error: missing }, { status: 400 });

  try {
    const data: Record<string, unknown> = {
      title: sanitizeString(body.title, 300),
      brief: body.brief || null,
      description: body.description || null,
      figmaUrl: body.figmaUrl || null,
      clientName: body.clientName || body.client || null,
      status: body.status || "DRAFT",
      budgetTotal: body.budgetTotal != null ? Number(body.budgetTotal) : null,
      // Productions created from the Production dashboard are EDITORIAL.
      // COMMERCIAL productions are only created via /api/commercial/projects.
      type: body.type === "COMMERCIAL" ? "COMMERCIAL" : "EDITORIAL",
      // Colour-coding / billing classification (green vs gold). Independent of
      // `type`'s budget-lock semantics. COMMERCIAL implies PAID.
      billingType:
        body.type === "COMMERCIAL" || body.billingType === "PAID" ? "PAID" : "EDITORIAL",
    };
    if (Array.isArray(body.shootDates) && body.shootDates.length > 0) {
      data.shootDates = body.shootDates
        .filter((d: string) => d)
        .map((d: string) => new Date(d));
    }
    if (body.campaignId) data.campaignId = body.campaignId;
    if (body.leadId) data.leadId = body.leadId;

    const production = await prisma.production.create({
      data: data as never,
      include: {
        campaign: { include: { client: true } },
        crew: { include: { contact: true } },
        callSheets: { select: { id: true, shootDate: true, status: true, callTime: true, location: true, shootTitle: true, notes: true } },
      },
    });

    // The timeline starts empty — the standard template is applied on demand
    // from the Timeline tab. The only auto-seeded row is the shoot date from
    // quick setup, so it isn't lost. Best-effort: a hiccup here must not fail
    // project creation.
    if (body.seedTemplate !== false) {
      try {
        const shoot = earliestShoot(
          Array.isArray(data.shootDates) ? (data.shootDates as Date[]) : []
        );
        if (shoot) await seedShootDateMilestone(production.id, shoot);
      } catch {
        // ignore — the shoot date can be added from the Timeline tab
      }
    }

    return NextResponse.json({ production });
  } catch (e) {
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
});
