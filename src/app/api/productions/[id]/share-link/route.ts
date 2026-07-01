import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

const OUTLANDER_DOMAIN = "@outlandermag.com";

// Create-or-return a shareable internal deep-link for a production. Restricted
// to signed-in Outlander staff (verified email domain). The link resolves via
// /production/share/[token] and redirects to the normal production page —
// budget is never exposed through it.
export const GET = withAuth(async (_request, context, user) => {
  const { id } = (await context.params!) as { id: string };

  if (!user.email.toLowerCase().endsWith(OUTLANDER_DOMAIN)) {
    return NextResponse.json({ error: "Outlander staff only" }, { status: 403 });
  }

  const production = await prisma.production.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!production) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Reuse an existing non-expired link if one exists, otherwise mint a new one.
  const now = new Date();
  let link = await prisma.productionShareLink.findFirst({
    where: {
      productionId: id,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { createdAt: "desc" },
  });
  if (!link) {
    link = await prisma.productionShareLink.create({
      data: { token: randomUUID(), productionId: id, createdBy: user.userId },
    });
  }

  return NextResponse.json({ token: link.token });
});
