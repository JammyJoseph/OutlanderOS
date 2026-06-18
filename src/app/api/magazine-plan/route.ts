import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import {
  buildSeedPages,
  blankPage,
  computeStats,
  issueState,
  resetPageStructure,
  syncStatusFlags,
  sectionColour,
  SEED_ISSUES,
  SEED_TOTAL_PAGES,
  SEED_VERSION,
  type MagazinePage,
} from "@/lib/magazine-plan";

// GET /api/magazine-plan            -> list all plans with derived stats (no pages)
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

    // List view: pull pages so we can derive completion stats + a status badge,
    // then strip the heavy page array from the response.
    const rows = await prisma.magazinePlan.findMany({
      orderBy: { issueNumber: "desc" },
    });
    const issues = rows.map((row) => {
      const pages = (Array.isArray(row.pages) ? row.pages : []) as unknown as MagazinePage[];
      const stats = computeStats(pages);
      return {
        id: row.id,
        issueNumber: row.issueNumber,
        issueName: row.issueName,
        totalPages: row.totalPages,
        seedVersion: row.seedVersion,
        updatedAt: row.updatedAt,
        updatedBy: row.updatedBy,
        stats,
        state: issueState(stats),
      };
    });
    return NextResponse.json({ issues });
  } catch (e) {
    return NextResponse.json({ issues: [], plan: null, error: String(e) }, { status: 500 });
  }
});

// POST /api/magazine-plan
//   { seedAll: true }                                   -> create the two seed issues
//   { issueNumber, issueName, totalPages?, seed?: bool } -> create from seed/blank
//   { issueNumber, issueName, cloneFromIssue: N }        -> copy a structure, reset content
//   { issueNumber, issueName, pages: [...] }             -> create from an explicit page array
export const POST = withAuth(async (request: NextRequest, _ctx, user) => {
  const body = await request.json().catch(() => ({}));
  const updatedBy = user.name || user.email;

  // Bulk-seed the representative issues. New issues are created; existing seed
  // issues are refreshed only when their stored seedVersion is behind the current
  // blueprint (so blueprint edits reach already-seeded environments). Issues a
  // user created themselves are not in SEED_ISSUES and are never touched.
  if (body.seedAll === true) {
    try {
      const created = [];
      for (const issue of SEED_ISSUES) {
        const existing = await prisma.magazinePlan.findUnique({
          where: { issueNumber: issue.issueNumber },
        });
        if (existing && existing.seedVersion >= SEED_VERSION) {
          created.push({ id: existing.id, issueNumber: existing.issueNumber, refreshed: false });
          continue;
        }
        const pages = issue.build();
        const plan = await prisma.magazinePlan.upsert({
          where: { issueNumber: issue.issueNumber },
          update: {
            issueName: issue.issueName,
            totalPages: issue.totalPages,
            pages: pages as unknown as object,
            seedVersion: SEED_VERSION,
            updatedBy,
          },
          create: {
            issueNumber: issue.issueNumber,
            issueName: issue.issueName,
            totalPages: issue.totalPages,
            pages: pages as unknown as object,
            seedVersion: SEED_VERSION,
            updatedBy,
          },
        });
        created.push({ id: plan.id, issueNumber: plan.issueNumber, refreshed: true });
      }
      return NextResponse.json({ ok: true, created });
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  }

  const issueNumber = Number(body.issueNumber);
  const issueName = String(body.issueName ?? "").trim();

  if (!Number.isInteger(issueNumber) || !issueName) {
    return NextResponse.json(
      { error: "issueNumber (int) and issueName are required" },
      { status: 400 }
    );
  }

  let pages: MagazinePage[];
  let totalPages: number;

  if (Number.isInteger(Number(body.cloneFromIssue))) {
    // New Issue: inherit the structure of an existing issue, reset all content.
    const source = await prisma.magazinePlan.findUnique({
      where: { issueNumber: Number(body.cloneFromIssue) },
    });
    if (!source) {
      return NextResponse.json({ error: "Source issue not found" }, { status: 404 });
    }
    const srcPages = (Array.isArray(source.pages) ? source.pages : []) as unknown as MagazinePage[];
    pages = resetPageStructure(srcPages);
    totalPages = source.totalPages;
  } else if (Array.isArray(body.pages)) {
    // Explicit page array (already-shaped); normalise defensively.
    pages = (body.pages as MagazinePage[]).map((p, i) =>
      syncStatusFlags({ ...p, pageNumber: i + 1, colour: sectionColour(p.section) })
    );
    totalPages = pages.length;
  } else {
    const wantSeed = body.seed === true;
    totalPages = Number(body.totalPages ?? (wantSeed ? SEED_TOTAL_PAGES : 8));
    if (!Number.isInteger(totalPages) || totalPages < 8) totalPages = 8;
    totalPages = Math.round(totalPages / 8) * 8; // snap to a multiple of 8
    pages = wantSeed
      ? buildSeedPages(totalPages)
      : Array.from({ length: totalPages }, (_, i) => blankPage(i + 1));
  }

  try {
    const plan = await prisma.magazinePlan.upsert({
      where: { issueNumber },
      update: {
        issueName,
        totalPages,
        pages: pages as unknown as object,
        updatedBy,
      },
      create: {
        issueNumber,
        issueName,
        totalPages,
        pages: pages as unknown as object,
        updatedBy,
      },
    });
    return NextResponse.json({ plan });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
});
