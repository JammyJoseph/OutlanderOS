import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

export const GET = withAuth(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;
    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        campaigns: {
          where: { status: { not: "ARCHIVED" } },
          include: {
            mediaPlans: {
              select: { id: true, campaignName: true, status: true },
            },
            assets: {
              select: { id: true, fileName: true, fileUrl: true, fileType: true },
            },
            production: {
              select: {
                id: true,
                title: true,
                status: true,
                budgetTotal: true,
                productionBudgetStatus: true,
                shootDates: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(client);
  } catch (err) {
    console.error("GET /api/clients/[id]", err);
    return NextResponse.json({ error: "Failed to fetch client" }, { status: 500 });
  }
});
