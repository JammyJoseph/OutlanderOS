import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { parseClientBrief, parseCreativeResponse } from "@/lib/deal-stages";

// GET /api/production/creative-pipeline
// Creative-brief deals whose creative is in flight (brief sent to the creative
// team, response loop running, or approved) but which haven't been cleared for
// production yet. Gives the Production portal early visibility on incoming work.
export const GET = withAuth(async (_request: NextRequest) => {
  try {
    const campaigns = await prisma.campaign.findMany({
      where: {
        archived: false,
        workflowType: { not: "SUPPLIED_ASSETS" },
        production: null, // not yet cleared for production
        creativeStatus: { not: null },
      },
      select: {
        id: true,
        title: true,
        stage: true,
        creativeStatus: true,
        clientBrief: true,
        creativeResponse: true,
        briefContent: true,
        client: { select: { name: true } },
        assignedTo: { select: { name: true } },
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    const deals = campaigns
      .map((c) => {
        const brief = parseClientBrief(c.clientBrief);
        const response = parseCreativeResponse(c.creativeResponse);
        return {
          id: c.id,
          title: c.title,
          stage: c.stage,
          clientName: c.client?.name ?? null,
          assignedTo: c.assignedTo?.name ?? null,
          creativeStatus: c.creativeStatus,
          sentToCreativeAt: brief?.sentToCreativeAt ?? null,
          figmaUrl: response?.figmaUrl ?? null,
          briefExcerpt: (brief?.content || c.briefContent || "").slice(0, 240),
          updatedAt: c.updatedAt,
        };
      })
      // Only surface deals actually handed to creative (brief sent) or already
      // progressing through the response loop.
      .filter((d) => d.sentToCreativeAt || d.creativeStatus !== "AWAITING_RESPONSE");

    return NextResponse.json({ deals });
  } catch (e) {
    return NextResponse.json({ deals: [], error: "An error occurred" }, { status: 500 });
  }
});
