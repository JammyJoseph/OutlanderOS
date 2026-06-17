import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { syncStatusFlags, sectionColour, type MagazinePage } from "@/lib/magazine-plan";

export const GET = withAuth(async (
  _request: NextRequest,
  { params }: { params?: Promise<Record<string, string>> }
) => {
  const { id } = (await params)!;
  try {
    const plan = await prisma.magazinePlan.findUnique({ where: { id } });
    if (!plan) return NextResponse.json({ plan: null }, { status: 404 });
    return NextResponse.json({ plan });
  } catch (e) {
    return NextResponse.json({ plan: null, error: String(e) }, { status: 500 });
  }
});

// PUT /api/magazine-plan/[id]  { pages, totalPages?, issueName? }
// Replaces the page array wholesale (both the tracker and the flat plan send the
// full, normalised array on every save). Status flags + colours are re-derived
// server-side so the two booleans can never drift from `status`.
export const PUT = withAuth(async (
  request: NextRequest,
  { params }: { params?: Promise<Record<string, string>> },
  user
) => {
  const { id } = (await params)!;
  const body = await request.json().catch(() => ({}));

  if (!Array.isArray(body.pages)) {
    return NextResponse.json({ error: "pages array required" }, { status: 400 });
  }

  const pages: MagazinePage[] = (body.pages as MagazinePage[]).map((p, i) =>
    syncStatusFlags({
      ...p,
      pageNumber: i + 1,
      colour: sectionColour(p.section),
    })
  );

  let totalPages = Number(body.totalPages ?? pages.length);
  if (!Number.isInteger(totalPages) || totalPages < 8) totalPages = pages.length;

  try {
    const plan = await prisma.magazinePlan.update({
      where: { id },
      data: {
        pages: pages as unknown as object,
        totalPages,
        ...(typeof body.issueName === "string" ? { issueName: body.issueName } : {}),
        updatedBy: user.name || user.email,
      },
    });
    return NextResponse.json({ plan });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
});

export const DELETE = withAuth(async (
  _request: NextRequest,
  { params }: { params?: Promise<Record<string, string>> }
) => {
  const { id } = (await params)!;
  try {
    await prisma.magazinePlan.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
});
