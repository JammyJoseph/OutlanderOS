// Standard production task templates.
//
// When a production is created (or a shoot date is first set) these seed a set
// of ProductionMilestone rows with dates calculated relative to the shoot date.
// Each row carries a stable `templateKey` so the dates can be recalculated if
// the shoot date changes, without duplicating rows.
//
// Offsets are in days relative to the shoot date (negative = before the shoot,
// 0 = shoot day, positive = after). `isMilestone` marks the key events that
// render as diamonds/flags on the timeline (everything else is a task circle).

export type MilestonePhase = "PRE_PRODUCTION" | "PRODUCTION" | "POST_PRODUCTION";

export interface TaskTemplate {
  key: string; // stable identifier (becomes templateKey)
  title: string;
  offsetDays: number; // relative to shoot date
  phase: MilestonePhase;
  description?: string;
  isMilestone?: boolean;
}

// Applies to every production, Editorial and Paid alike.
export const STANDARD_TASKS: TaskTemplate[] = [
  { key: "book_crew", title: "Book crew", offsetDays: -14, phase: "PRE_PRODUCTION" },
  { key: "confirm_locations", title: "Confirm locations", offsetDays: -10, phase: "PRE_PRODUCTION" },
  { key: "send_deck_approval", title: "Send deck for approval", offsetDays: -10, phase: "PRE_PRODUCTION" },
  { key: "receive_product_wardrobe", title: "Receive product/wardrobe", offsetDays: -7, phase: "PRE_PRODUCTION" },
  { key: "finalise_styling", title: "Finalise styling/looks", offsetDays: -5, phase: "PRE_PRODUCTION" },
  { key: "confirm_dietary", title: "Confirm dietary requirements", offsetDays: -3, phase: "PRE_PRODUCTION" },
  { key: "final_call_sheet", title: "Final call sheet + shot list", offsetDays: -2, phase: "PRE_PRODUCTION" },
  { key: "send_call_sheet", title: "Send call sheet to crew", offsetDays: -1, phase: "PRE_PRODUCTION" },
  { key: "shoot_day", title: "SHOOT DAY", offsetDays: 0, phase: "PRODUCTION", isMilestone: true },
  { key: "selects_delivered", title: "Selects delivered", offsetDays: 3, phase: "POST_PRODUCTION" },
  { key: "v1_assets", title: "V1 assets delivered", offsetDays: 7, phase: "POST_PRODUCTION" },
  { key: "client_feedback", title: "Client/editor feedback", offsetDays: 10, phase: "POST_PRODUCTION" },
  { key: "final_assets", title: "Final assets delivered", offsetDays: 14, phase: "POST_PRODUCTION" },
  { key: "go_live", title: "Go live / publish", offsetDays: 21, phase: "POST_PRODUCTION", isMilestone: true },
];

// Additional gates for Paid / Commercial productions only.
export const PAID_TASKS: TaskTemplate[] = [
  { key: "submit_deck_client", title: "Submit production deck to client", offsetDays: -14, phase: "PRE_PRODUCTION" },
  { key: "client_deck_approval", title: "Client deck approval", offsetDays: -10, phase: "PRE_PRODUCTION" },
  { key: "io_contract_signed", title: "IO/contract signed", offsetDays: -7, phase: "PRE_PRODUCTION" },
];

// Post-production sub-tasks — the explicit POST_PRODUCTION lifecycle stage.
// Seeded as sub-tasks under the "Selects delivered" milestone so they live in
// the post-production phase and read as a checklist.
export const POST_PRODUCTION_SUBTASKS: { key: string; title: string; offsetDays: number }[] = [
  { key: "post_selects", title: "Selects", offsetDays: 3 },
  { key: "post_edit", title: "Edit", offsetDays: 5 },
  { key: "post_colour", title: "Colour grade", offsetDays: 7 },
  { key: "post_retouch", title: "Retouch", offsetDays: 8 },
  { key: "post_sound", title: "Sound mix", offsetDays: 9 },
  { key: "post_review", title: "Review", offsetDays: 11 },
  { key: "post_exports", title: "Final exports", offsetDays: 13 },
];

export type BillingType = "EDITORIAL" | "PAID";

// Full ordered template for a billing type (standard + paid extras where
// relevant), sorted by offset so the timeline reads in sequence.
export function templateFor(billingType: string): TaskTemplate[] {
  const isPaid = billingType === "PAID" || billingType === "COMMERCIAL";
  const all = isPaid ? [...STANDARD_TASKS, ...PAID_TASKS] : [...STANDARD_TASKS];
  return all.sort((a, b) => a.offsetDays - b.offsetDays);
}

// Add whole days to a date without mutating the input. Anchored to noon UTC so
// the resulting calendar day is stable regardless of the server timezone.
export function addDaysUTC(shoot: Date, days: number): Date {
  const d = new Date(
    Date.UTC(shoot.getUTCFullYear(), shoot.getUTCMonth(), shoot.getUTCDate(), 12, 0, 0)
  );
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export interface SeedRow {
  phase: MilestonePhase;
  date: Date;
  title: string;
  description: string | null;
  isMilestone: boolean;
  templateKey: string;
  sortOrder: number;
  // Populated for sub-task rows so the API can wire up parentId after the
  // parent milestones exist.
  parentKey?: string;
}

// Build the flat list of template rows (parent milestones + post-production
// sub-tasks) for a shoot date and billing type. `parentKey` on sub-task rows
// points at the templateKey of their owning milestone.
export function buildTemplateRows(shoot: Date, billingType: string): SeedRow[] {
  const rows: SeedRow[] = templateFor(billingType).map((t, i) => ({
    phase: t.phase,
    date: addDaysUTC(shoot, t.offsetDays),
    title: t.title,
    description: t.description ?? null,
    isMilestone: !!t.isMilestone,
    templateKey: t.key,
    sortOrder: i,
  }));

  POST_PRODUCTION_SUBTASKS.forEach((s, i) => {
    rows.push({
      phase: "POST_PRODUCTION",
      date: addDaysUTC(shoot, s.offsetDays),
      title: s.title,
      description: null,
      isMilestone: false,
      templateKey: s.key,
      sortOrder: 100 + i,
      parentKey: "selects_delivered",
    });
  });

  return rows;
}

// All template keys (parents + sub-tasks) — used to recalculate dates for
// template-seeded rows and to detect whether a production has been seeded.
export function templateKeyOffsets(billingType: string): Record<string, number> {
  const map: Record<string, number> = {};
  for (const t of templateFor(billingType)) map[t.key] = t.offsetDays;
  for (const s of POST_PRODUCTION_SUBTASKS) map[s.key] = s.offsetDays;
  return map;
}
