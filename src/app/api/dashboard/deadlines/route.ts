import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { ACTIVE_STAGES } from "@/lib/deal-stages";

export const dynamic = "force-dynamic";

type Portal = "commercial" | "production";

interface Deadline {
  id: string;
  title: string;
  date: string; // ISO
  portal: Portal;
  project: string; // which project/deal it belongs to
  type: string; // shoot | brief | deliverable | deal
  href: string;
  daysUntil: number;
  urgency: "overdue" | "soon" | "later";
}

const DAY_MS = 86_400_000;

// GET /api/dashboard/deadlines — aggregates upcoming dated items across the
// commercial and production portals into one urgency-sorted list:
// production shoot dates, commercial brief due dates, deliverable due dates
// and deal due dates. Soonest (and overdue) first.
export const GET = withAuth(async () => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    // Look forward ~120 days; overdue items are always included.
    const horizon = new Date(todayStart.getTime() + 120 * DAY_MS);

    const [productions, dealsWithDates, dealDeliverables, prodDeliverables] = await Promise.all([
      prisma.production.findMany({
        where: { archived: false, status: { not: "ARCHIVED" }, shootDates: { isEmpty: false } },
        select: { id: true, title: true, shootDates: true, campaign: { select: { title: true } } },
      }),
      prisma.campaign.findMany({
        where: {
          archived: false,
          status: { not: "ARCHIVED" },
          stage: { in: ACTIVE_STAGES },
          OR: [{ dueDate: { not: null } }, { briefDueDate: { not: null } }],
        },
        select: {
          id: true,
          title: true,
          dueDate: true,
          briefDueDate: true,
          briefStatus: true,
          client: { select: { name: true } },
        },
      }),
      prisma.deliverable.findMany({
        where: {
          status: { not: "DELIVERED" },
          dueDate: { not: null, lte: horizon },
          campaign: { archived: false, status: { not: "ARCHIVED" } },
        },
        select: {
          id: true,
          title: true,
          type: true,
          dueDate: true,
          campaign: { select: { id: true, title: true, client: { select: { name: true } } } },
        },
      }),
      prisma.productionDeliverable.findMany({
        where: {
          status: { notIn: ["DELIVERED", "APPROVED"] },
          dueDate: { not: null, lte: horizon },
          production: { archived: false, status: { not: "ARCHIVED" } },
        },
        select: {
          id: true,
          title: true,
          dueDate: true,
          production: { select: { id: true, title: true } },
        },
      }),
    ]);

    const items: Deadline[] = [];

    function push(args: Omit<Deadline, "daysUntil" | "urgency">) {
      const date = new Date(args.date);
      const daysUntil = Math.round(
        (new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() -
          todayStart.getTime()) /
          DAY_MS
      );
      const urgency: Deadline["urgency"] =
        daysUntil < 0 ? "overdue" : daysUntil <= 7 ? "soon" : "later";
      items.push({ ...args, daysUntil, urgency });
    }

    // Production shoot dates (future only)
    for (const p of productions) {
      for (const d of p.shootDates) {
        if (d < todayStart) continue;
        push({
          id: `shoot-${p.id}-${d.toISOString()}`,
          title: `Shoot day — ${p.title}`,
          date: d.toISOString(),
          portal: "production",
          project: p.campaign?.title ?? p.title,
          type: "shoot",
          href: `/production/${p.id}`,
        });
      }
    }

    // Commercial deal + brief due dates
    for (const c of dealsWithDates) {
      if (c.dueDate) {
        push({
          id: `deal-${c.id}`,
          title: `Deal due — ${c.title}`,
          date: c.dueDate.toISOString(),
          portal: "commercial",
          project: c.client?.name ?? c.title,
          type: "deal",
          href: `/commercial/deals/${c.id}`,
        });
      }
      if (c.briefDueDate && c.briefStatus !== "SENT_TO_PRODUCTION") {
        push({
          id: `brief-${c.id}`,
          title: `Brief due — ${c.title}`,
          date: c.briefDueDate.toISOString(),
          portal: "commercial",
          project: c.client?.name ?? c.title,
          type: "brief",
          href: `/commercial/deals/${c.id}`,
        });
      }
    }

    // Deliverables (commercial)
    for (const d of dealDeliverables) {
      if (!d.dueDate) continue;
      push({
        id: `cdeliv-${d.id}`,
        title: `Deliverable — ${d.title ?? d.type ?? "Untitled"}`,
        date: d.dueDate.toISOString(),
        portal: "commercial",
        project: d.campaign?.client?.name ?? d.campaign?.title ?? "Deal",
        type: "deliverable",
        href: `/commercial/deals/${d.campaign?.id ?? ""}`,
      });
    }

    // Deliverables (production)
    for (const d of prodDeliverables) {
      if (!d.dueDate) continue;
      push({
        id: `pdeliv-${d.id}`,
        title: `Deliverable — ${d.title}`,
        date: d.dueDate.toISOString(),
        portal: "production",
        project: d.production?.title ?? "Production",
        type: "deliverable",
        href: `/production/${d.production?.id ?? ""}`,
      });
    }

    items.sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json(items.slice(0, 40));
  } catch (err) {
    console.error("GET /api/dashboard/deadlines", err);
    return NextResponse.json({ error: "Failed to aggregate deadlines" }, { status: 500 });
  }
});
