import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

// GET /api/commercial/activity — recent deal updates across the pipeline (last 20)
export const GET = withAuth(async () => {
  try {
    const activities = await prisma.dealActivity.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        campaign: {
          select: {
            id: true,
            title: true,
            stage: true,
            client: { select: { id: true, name: true } },
          },
        },
      },
    });

    return NextResponse.json({ activities });
  } catch (err) {
    console.error("GET /api/commercial/activity", err);
    return NextResponse.json({ error: "Failed to fetch activity" }, { status: 500 });
  }
});
