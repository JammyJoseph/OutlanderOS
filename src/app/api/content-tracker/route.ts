import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { withAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req: NextRequest) => {
  try {
    const sp = req.nextUrl.searchParams;
    const brand = sp.get("brand");
    const postType = sp.get("postType");
    const campaign = sp.get("campaign");
    const search = sp.get("search");
    const mediaType = sp.get("mediaType");
    const dateFrom = sp.get("dateFrom");
    const dateTo = sp.get("dateTo");
    const sort = sp.get("sort") ?? "date";
    const limit = Math.min(Number(sp.get("limit") ?? "60"), 200);
    const offset = Number(sp.get("offset") ?? "0");

    const where: Prisma.InstagramPostWhereInput = {};
    if (brand) where.brands = { has: brand };
    if (postType && postType !== "ALL") where.postType = postType;
    if (campaign) where.campaignId = campaign;
    if (mediaType && mediaType !== "ALL") where.mediaType = mediaType;
    if (search) where.caption = { contains: search, mode: "insensitive" };
    if (dateFrom || dateTo) {
      where.timestamp = {};
      if (dateFrom) where.timestamp.gte = new Date(dateFrom);
      if (dateTo) where.timestamp.lte = new Date(dateTo);
    }

    const orderBy: Prisma.InstagramPostOrderByWithRelationInput =
      sort === "likes"
        ? { likeCount: "desc" }
        : sort === "reach"
        ? { reachCount: "desc" }
        : sort === "engagement"
        ? { engagementRate: "desc" }
        : { timestamp: "desc" };

    const [posts, total] = await Promise.all([
      prisma.instagramPost.findMany({ where, orderBy, take: limit, skip: offset }),
      prisma.instagramPost.count({ where }),
    ]);

    return NextResponse.json({ posts, total, limit, offset });
  } catch (err) {
    console.error("GET /api/content-tracker", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err), posts: [], total: 0 },
      { status: 500 }
    );
  }
});
