import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { sanitizeString } from "@/lib/validate";

interface CrewInput {
  name?: string;
  role?: string;
  email?: string;
  phone?: string;
}

function norm(v: string | null | undefined): string {
  return (v || "").trim().toLowerCase();
}

// Auto-saves a call sheet's crew into the Directory. For each named crew member
// we either link an existing Contact (matched by name, optionally narrowed by
// email) or create a new one tagged with the production as a credit, and append
// a "Worked on <Production> as <Role>" collaboration note.
export const POST = withAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  user
) => {
  const { id } = await params;
  const body = await request.json();
  const crew: CrewInput[] = Array.isArray(body.crew) ? body.crew : [];

  const sheet = await prisma.callSheet.findUnique({
    where: { id },
    select: { production: { select: { title: true } } },
  });
  if (!sheet) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const productionTitle = sheet.production.title;

  const results: { name: string; action: "linked" | "created"; contactId: string }[] = [];

  for (const member of crew) {
    const name = sanitizeString(member.name ?? "", 200);
    if (!name) continue;
    const role = sanitizeString(member.role ?? "", 120);
    const email = member.email ? sanitizeString(member.email, 320) : null;
    const phone = member.phone ? sanitizeString(member.phone, 50) : null;
    const credit = `Worked on ${productionTitle}${role ? ` as ${role}` : ""}`;

    // Match an existing contact by name (+ email when both have one).
    const candidates = await prisma.contact.findMany({
      where: { name: { equals: name, mode: "insensitive" } },
      select: { id: true, name: true, email: true, notes: true, tags: true, phone: true },
    });
    const match =
      candidates.find((c) => email && norm(c.email) === norm(email)) ??
      candidates[0];

    if (match) {
      const tags = Array.isArray(match.tags) ? match.tags : [];
      const hasTag = tags.some((t) => norm(t) === norm(productionTitle));
      const hasCredit = (match.notes || "").includes(credit);
      const nextNotes = hasCredit
        ? match.notes
        : `${match.notes ? match.notes + "\n" : ""}${credit}`;
      await prisma.contact.update({
        where: { id: match.id },
        data: {
          notes: nextNotes,
          tags: hasTag ? tags : [...tags, productionTitle].slice(0, 30),
          email: match.email || email,
          phone: match.phone || phone,
          lastInteraction: new Date(),
        },
      });
      results.push({ name, action: "linked", contactId: match.id });
    } else {
      const created = await prisma.contact.create({
        data: {
          name,
          email,
          phone,
          role: role || null,
          category: role || "Crew",
          tags: [productionTitle],
          notes: credit,
          lastInteraction: new Date(),
          createdBy: user.userId,
        },
        select: { id: true },
      });
      results.push({ name, action: "created", contactId: created.id });
    }
  }

  return NextResponse.json({ synced: results.length, results });
});
