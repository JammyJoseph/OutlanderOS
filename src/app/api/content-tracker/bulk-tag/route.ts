import { withErrorHandling } from "@/lib/api-error"
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES = ["ORGANIC", "EDITORIAL", "PAID", "COMMUNITY", "UNCLASSIFIED"];

const POST__h = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const postIds: string[] = Array.isArray(body.postIds)
      ? body.postIds.filter((x: unknown): x is string => typeof x === "string")
      : [];
    const brand: string | null =
      typeof body.brand === "string" && body.brand.trim() ? body.brand.trim() : null;
    const postType: string | null =
      typeof body.postType === "string" && ALLOWED_TYPES.includes(body.postType)
        ? body.postType
        : null;
    const campaignId: string | null =
      typeof body.campaignId === "string" ? body.campaignId : null;
    const campaignName: string | null =
      typeof body.campaignName === "string" ? body.campaignName : null;

    if (postIds.length === 0) {
      return NextResponse.json({ updated: 0 });
    }

    if (brand) {
      const posts = await prisma.instagramPost.findMany({
        where: { id: { in: postIds } },
        select: { id: true, brands: true },
      });
      await Promise.all(
        posts.map((p) => {
          if (p.brands.includes(brand)) return Promise.resolve();
          return prisma.instagramPost.update({
            where: { id: p.id },
            data: { brands: [...p.brands, brand] },
          });
        })
      );
    }

    if (postType || campaignId !== null || campaignName !== null) {
      const update: Record<string, unknown> = {};
      if (postType) update.postType = postType;
      if (campaignId !== null) update.campaignId = campaignId;
      if (campaignName !== null) update.campaignName = campaignName;
      await prisma.instagramPost.updateMany({
        where: { id: { in: postIds } },
        data: update,
      });
    }

    return NextResponse.json({ updated: postIds.length });
  } catch (err) {
    console.error("POST /api/content-tracker/bulk-tag", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
});

export const POST = withErrorHandling(POST__h as any)
