import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

export const GET = withAuth(async (request: NextRequest) => {
  try {
    // Archived clients are hidden by default; ?includeArchived=true returns
    // them too (used by the "Show archived" toggle on the clients list).
    const includeArchived =
      request.nextUrl.searchParams.get("includeArchived") === "true";

    const clients = await prisma.client.findMany({
      where: includeArchived ? {} : { archived: false },
      select: {
        id: true,
        name: true,
        industry: true,
        brandColor: true,
        archived: true,
        archivedAt: true,
        campaigns: {
          where: { status: { not: "ARCHIVED" } },
          select: { value: true, currency: true, status: true },
        },
      },
      orderBy: { name: "asc" },
    });

    const result = clients.map((c) => {
      const totalSpend = c.campaigns.reduce((sum, camp) => sum + (camp.value ?? 0), 0);
      return {
        id: c.id,
        name: c.name,
        industry: c.industry,
        brandColor: c.brandColor,
        archived: c.archived,
        archivedAt: c.archivedAt,
        campaignCount: c.campaigns.length,
        totalSpend,
        currency: c.campaigns[0]?.currency ?? "GBP",
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("GET /api/clients", err);
    return NextResponse.json({ error: "Failed to fetch clients" }, { status: 500 });
  }
});
