import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

// ⌘K search: deals, productions, clients and contacts in one call.
//
// Read-only and signed-in only. It returns what the portals already show any
// staff member — no finance figures beyond a deal's headline value, which the
// pipeline shows everyone. Archived records are left out, as they are in the
// lists themselves.

const PER_GROUP = 5;

const STAGE_LABEL: Record<string, string> = {
  NEW_BRIEF: "New brief",
  PITCHING_FEEDBACK: "Pitching",
  APPROVAL: "Approval",
  SIGN_OFF: "Sign off",
  IO_SIGNED_KICK_OFF: "IO signed",
  IN_PRODUCTION: "In production",
  LIVE: "Live",
  COMPLETED: "Completed",
  PAID: "Paid",
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  BRIEFED: "Briefed",
  PRE_PRODUCTION: "Pre-production",
  SHOOTING: "Shooting",
  POST_PRODUCTION: "Post-production",
  DELIVERED: "Delivered",
  ARCHIVED: "Archived",
};

const gbp = (n: number | null | undefined) =>
  typeof n === "number" ? `£${Math.round(n).toLocaleString("en-GB")}` : null;

export const GET = withAuth(async (request: NextRequest) => {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) {
    return NextResponse.json({ deals: [], productions: [], clients: [], contacts: [] });
  }
  const has = { contains: q, mode: "insensitive" as const };

  try {
    const [deals, productions, clients, contacts] = await Promise.all([
      prisma.campaign.findMany({
        where: { archived: false, OR: [{ title: has }, { client: { name: has } }] },
        select: {
          id: true,
          title: true,
          stage: true,
          dealValue: true,
          value: true,
          client: { select: { name: true } },
          assignedTo: { select: { name: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: PER_GROUP,
      }),
      prisma.production.findMany({
        where: { archived: false, OR: [{ title: has }, { clientName: has }] },
        select: { id: true, title: true, status: true, clientName: true },
        orderBy: { updatedAt: "desc" },
        take: PER_GROUP,
      }),
      prisma.client.findMany({
        where: { archived: false, name: has },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
        take: PER_GROUP,
      }),
      prisma.contact.findMany({
        where: {
          archived: false,
          OR: [{ name: has }, { company: has }, { role: has }, { instagram: has }],
        },
        select: { id: true, name: true, role: true, company: true },
        orderBy: { name: "asc" },
        take: PER_GROUP,
      }),
    ]);

    return NextResponse.json({
      deals: deals.map((d) => ({
        id: d.id,
        href: `/commercial/deals/${d.id}`,
        title: d.client?.name ? `${d.client.name} · ${d.title}` : d.title,
        detail: [STAGE_LABEL[d.stage] ?? null, gbp(d.dealValue ?? d.value), d.assignedTo?.name ?? null]
          .filter(Boolean)
          .join(" · "),
      })),
      productions: productions.map((p) => ({
        id: p.id,
        href: `/production/${p.id}`,
        title: p.title,
        detail: [STATUS_LABEL[p.status] ?? p.status, p.clientName].filter(Boolean).join(" · "),
      })),
      clients: clients.map((c) => ({
        id: c.id,
        href: `/commercial/clients/${c.id}`,
        title: c.name,
        detail: "Client",
      })),
      contacts: contacts.map((c) => ({
        id: c.id,
        href: `/directory/${c.id}`,
        title: c.name,
        detail: [c.role, c.company].filter(Boolean).join(", "),
      })),
    });
  } catch (err) {
    console.error("GET /api/search", err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
});
