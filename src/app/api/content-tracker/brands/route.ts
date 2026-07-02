import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const GET = withAuth(async () => {
  try {
    const posts = await prisma.instagramPost.findMany({
      select: { brands: true, reachCount: true, engagementRate: true },
    });

    const map = new Map<string, { count: number; reach: number; engSum: number }>();
    for (const p of posts) {
      for (const b of p.brands) {
        const cur = map.get(b) ?? { count: 0, reach: 0, engSum: 0 };
        cur.count += 1;
        cur.reach += p.reachCount;
        cur.engSum += p.engagementRate;
        map.set(b, cur);
      }
    }

    const brands = Array.from(map.entries())
      .map(([name, v]) => ({
        name,
        postCount: v.count,
        totalReach: v.reach,
        avgEngagement: v.count ? Math.round((v.engSum / v.count) * 100) / 100 : 0,
      }))
      .sort((a, b) => b.postCount - a.postCount);

    return NextResponse.json({ brands });
  } catch (err) {
    console.error("GET /api/content-tracker/brands", err);
    return NextResponse.json(
      { error: "An error occurred", brands: [] },
      { status: 500 }
    );
  }
});
