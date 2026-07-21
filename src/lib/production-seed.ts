import prisma from "@/lib/prisma";
import {
  buildTemplateRows,
  templateKeyOffsets,
  addDaysUTC,
} from "@/lib/production-templates";

// A new production starts with an EMPTY timeline — the standard template is
// opt-in from the Timeline tab ("Generate standard timeline"). The one thing
// seeded automatically is the shoot date entered in quick setup, so the date
// someone just typed isn't lost.
//
// Carries templateKey "shoot_day" so the existing recalculate/apply-template
// paths recognise it and never create a second shoot row. Idempotent.
export async function seedShootDateMilestone(
  productionId: string,
  shoot: Date
): Promise<number> {
  const existing = await prisma.productionMilestone.findFirst({
    where: { productionId, templateKey: "shoot_day" },
    select: { id: true },
  });
  if (existing) return 0;

  await prisma.productionMilestone.create({
    data: {
      productionId,
      phase: "PRODUCTION",
      date: addDaysUTC(shoot, 0),
      title: "SHOOT DAY",
      isMilestone: true,
      templateKey: "shoot_day",
      sortOrder: 0,
    },
  });
  return 1;
}

// Seed a production's standard timeline from a shoot date. Idempotent: rows are
// keyed by templateKey, so calling twice never duplicates. Parent milestones are
// created first, then post-production sub-tasks are wired to their parent.
//
// Returns the number of rows created (0 if the production was already seeded).
export async function seedTemplateMilestones(
  productionId: string,
  shoot: Date,
  billingType: string
): Promise<number> {
  const rows = buildTemplateRows(shoot, billingType);

  // Which template keys already exist for this production?
  const existing = await prisma.productionMilestone.findMany({
    where: { productionId, templateKey: { not: null } },
    select: { templateKey: true },
  });
  const seen = new Set(existing.map((r) => r.templateKey));

  const parents = rows.filter((r) => !r.parentKey && !seen.has(r.templateKey));
  const children = rows.filter((r) => r.parentKey && !seen.has(r.templateKey));

  let created = 0;

  for (const r of parents) {
    await prisma.productionMilestone.create({
      data: {
        productionId,
        phase: r.phase,
        date: r.date,
        title: r.title,
        description: r.description,
        isMilestone: r.isMilestone,
        templateKey: r.templateKey,
        sortOrder: r.sortOrder,
      },
    });
    created += 1;
  }

  // Resolve parent ids for sub-tasks now that parents exist.
  if (children.length > 0) {
    const parentRows = await prisma.productionMilestone.findMany({
      where: { productionId, templateKey: { not: null } },
      select: { id: true, templateKey: true },
    });
    const byKey = new Map(parentRows.map((p) => [p.templateKey, p.id]));
    for (const r of children) {
      await prisma.productionMilestone.create({
        data: {
          productionId,
          phase: r.phase,
          date: r.date,
          title: r.title,
          description: r.description,
          isMilestone: r.isMilestone,
          templateKey: r.templateKey,
          parentId: r.parentKey ? byKey.get(r.parentKey) ?? null : null,
          sortOrder: r.sortOrder,
        },
      });
      created += 1;
    }
  }

  return created;
}

// Recalculate the dates of every template-seeded milestone from a new shoot
// date. Only touches rows with a known templateKey; custom milestones and any
// manual date edits on non-template rows are left alone.
export async function recalcTemplateMilestones(
  productionId: string,
  shoot: Date,
  billingType: string
): Promise<number> {
  const offsets = templateKeyOffsets(billingType);
  const rows = await prisma.productionMilestone.findMany({
    where: { productionId, templateKey: { not: null } },
    select: { id: true, templateKey: true },
  });
  let updated = 0;
  for (const row of rows) {
    if (!row.templateKey || !(row.templateKey in offsets)) continue;
    await prisma.productionMilestone.update({
      where: { id: row.id },
      data: { date: addDaysUTC(shoot, offsets[row.templateKey]) },
    });
    updated += 1;
  }
  return updated;
}

// The earliest shoot date for a production, from its explicit shootDates and any
// call-sheet dates. Returns null when nothing is scheduled.
export function earliestShoot(dates: (Date | string)[]): Date | null {
  const parsed = (dates ?? [])
    .map((d) => (d instanceof Date ? d : new Date(d)))
    .filter((d) => !isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  return parsed[0] ?? null;
}
