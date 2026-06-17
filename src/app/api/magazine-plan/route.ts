import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import {
  buildSeedPages,
  blankPage,
  SEED_TOTAL_PAGES,
  type MagazinePage,
} from "@/lib/magazine-plan";

// GET /api/magazine-plan            -> list all plans (lightweight, no pages)
// GET /api/magazine-plan?issue=2    -> full plan for an issue number (with pages)
export const GET = withAuth(async (request: NextRequest) => {
  const issueParam = request.nextUrl.searchParams.get("issue");

  try {
    if (issueParam) {
      const issueNumber = parseInt(issueParam, 10);
      const plan = await prisma.magazinePlan.findUnique({
        where: { issueNumber },
      });
      return NextResponse.json({ plan: plan ?? null });
    }

    const plans = await prisma.magazinePlan.findMany({
      orderBy: { issueNumber: "desc" },
      select: {
        id: true,
        issueNumber: true,
        issueName: true,
        totalPages: true,
        updatedAt: true,
        updatedBy: true,
      },
    });
    return NextResponse.json({ plans });
  } catch (e) {
    return NextResponse.json({ plans: [], plan: null, error: String(e) }, { status: 500 });
  }
});

// POST /api/magazine-plan
//   { issueNumber, issueName, totalPages?, seed?: boolean }
// Creates a plan. When seed is true the page array is pre-populated with the
// representative SS26 structure; otherwise it starts as blank Space pages.
export const POST = withAuth(async (request: NextRequest, _ctx, user) => {
  const body = await request.json().catch(() => ({}));
  const issueNumber = Number(body.issueNumber);
  const issueName = String(body.issueName ?? "").trim();

  if (!Number.isInteger(issueNumber) || !issueName) {
    return NextResponse.json(
      { error: "issueNumber (int) and issueName are required" },
      { status: 400 }
    );
  }

  const wantSeed = body.seed === true;
  let totalPages = Number(body.totalPages ?? (wantSeed ? SEED_TOTAL_PAGES : 8));
  if (!Number.isInteger(totalPages) || totalPages < 8) totalPages = 8;
  totalPages = Math.round(totalPages / 8) * 8; // snap to a multiple of 8

  const pages: MagazinePage[] = wantSeed
    ? buildSeedPages(totalPages)
    : Array.from({ length: totalPages }, (_, i) => blankPage(i + 1));

  try {
    const plan = await prisma.magazinePlan.upsert({
      where: { issueNumber },
      update: {
        issueName,
        totalPages,
        pages: pages as unknown as object,
        updatedBy: user.name || user.email,
      },
      create: {
        issueNumber,
        issueName,
        totalPages,
        pages: pages as unknown as object,
        updatedBy: user.name || user.email,
      },
    });
    return NextResponse.json({ plan });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
});
