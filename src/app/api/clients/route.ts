import { withErrorHandling } from "@/lib/api-error"
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

const GET__h = withAuth(async () => {
  try {
    const clients = await prisma.client.findMany({
      select: {
        id: true,
        name: true,
        industry: true,
        brandColor: true,
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

export const GET = withErrorHandling(GET__h as any)
