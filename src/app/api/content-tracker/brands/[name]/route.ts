import { withErrorHandling } from "@/lib/api-error"
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const GET__h = withAuth(async (
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) => {
  try {
    const { name: encoded } = await params;
    const name = decodeURIComponent(encoded);

    const posts = await prisma.instagramPost.findMany({
      where: { brands: { has: name } },
      orderBy: { timestamp: "desc" },
    });

    if (posts.length === 0) {
      return NextResponse.json({
        brand: name,
        stats: {
          totalPosts: 0,
          totalReach: 0,
          totalLikes: 0,
          totalComments: 0,
          avgEngagement: 0,
        },
        bestPost: null,
        timeline: [],
        posts: [],
      });
    }

    const totalReach = posts.reduce((s, p) => s + p.reachCount, 0);
    const totalLikes = posts.reduce((s, p) => s + p.likeCount, 0);
    const totalComments = posts.reduce((s, p) => s + p.commentCount, 0);
    const avgEngagement =
      posts.reduce((s, p) => s + p.engagementRate, 0) / posts.length;

    const bestPost = posts.reduce((best, p) =>
      p.engagementRate > best.engagementRate ? p : best
    );

    const byMonth = new Map<string, { posts: number; reach: number }>();
    for (const p of posts) {
      const key = p.timestamp.toISOString().slice(0, 7);
      const cur = byMonth.get(key) ?? { posts: 0, reach: 0 };
      cur.posts += 1;
      cur.reach += p.reachCount;
      byMonth.set(key, cur);
    }
    const timeline = Array.from(byMonth.entries())
      .map(([month, v]) => ({ month, ...v }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return NextResponse.json({
      brand: name,
      stats: {
        totalPosts: posts.length,
        totalReach,
        totalLikes,
        totalComments,
        avgEngagement: Math.round(avgEngagement * 100) / 100,
      },
      bestPost,
      timeline,
      posts,
    });
  } catch (err) {
    console.error("GET /api/content-tracker/brands/[name]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
});

export const GET = withErrorHandling(GET__h as any)
