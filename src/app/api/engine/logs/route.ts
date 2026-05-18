import { withErrorHandling } from "@/lib/api-error"
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

const GET__h = withAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // optional filter
    const limit = parseInt(searchParams.get("limit") ?? "50");

    const logs = await prisma.intelligenceLog.findMany({
      where: type ? { type } : undefined,
      include: {
        campaign: {
          select: {
            id: true,
            title: true,
            status: true,
            client: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 200),
    });

    return NextResponse.json(logs);
  } catch (err) {
    console.error("GET /api/engine/logs", err);
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }
});

export const GET = withErrorHandling(GET__h as any)
