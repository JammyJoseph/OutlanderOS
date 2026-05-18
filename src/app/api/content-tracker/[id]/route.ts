import { withErrorHandling } from "@/lib/api-error"
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES = ["ORGANIC", "EDITORIAL", "PAID", "COMMUNITY", "UNCLASSIFIED"];

const PUT__h = withAuth(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;
    const body = await req.json();
    const data: Record<string, unknown> = {};

    if (Array.isArray(body.brands)) {
      data.brands = body.brands.filter((b: unknown): b is string => typeof b === "string");
    }
    if (typeof body.postType === "string" && ALLOWED_TYPES.includes(body.postType)) {
      data.postType = body.postType;
    }
    if (body.campaignId === null || typeof body.campaignId === "string") {
      data.campaignId = body.campaignId;
    }
    if (body.campaignName === null || typeof body.campaignName === "string") {
      data.campaignName = body.campaignName;
    }
    if (body.notes === null || typeof body.notes === "string") {
      data.notes = body.notes;
    }

    const post = await prisma.instagramPost.update({ where: { id }, data });
    return NextResponse.json(post);
  } catch (err) {
    console.error("PUT /api/content-tracker/[id]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
});

const GET__h = withAuth(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;
    const post = await prisma.instagramPost.findUnique({ where: { id } });
    if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(post);
  } catch (err) {
    console.error("GET /api/content-tracker/[id]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
});

export const PUT = withErrorHandling(PUT__h as any)
export const GET = withErrorHandling(GET__h as any)
