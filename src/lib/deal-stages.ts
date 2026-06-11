// Shared constants + helpers for the Commercial deal pipeline.

export const DEAL_STAGES = [
  "LEAD",
  "PITCHED",
  "NEGOTIATING",
  "CONTRACTED",
  "LIVE",
  "COMPLETED",
  "PAID",
] as const;

export type DealStageValue = (typeof DEAL_STAGES)[number];

// Stages counted as "won" / revenue booked
export const WON_STAGES: DealStageValue[] = ["CONTRACTED", "LIVE", "COMPLETED", "PAID"];

// Stages counted in active pipeline value
export const ACTIVE_STAGES: DealStageValue[] = [
  "LEAD",
  "PITCHED",
  "NEGOTIATING",
  "CONTRACTED",
  "LIVE",
];

export const DEAL_TYPES = ["PARTNERSHIP", "ADVERTORIAL", "EVENT", "EDITORIAL"] as const;

export function isDealStage(value: string): value is DealStageValue {
  return (DEAL_STAGES as readonly string[]).includes(value);
}

export type BudgetSplit = { category: string; amount: number };

export function parseBudgetBreakdown(value: unknown): BudgetSplit[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (s): s is { category: unknown; amount: unknown } =>
        !!s && typeof s === "object" && "category" in s && "amount" in s
    )
    .map((s) => ({ category: String(s.category), amount: Number(s.amount) || 0 }))
    .filter((s) => s.category.trim().length > 0);
}

// Map a free-form split category onto the Production portal's budget
// category keys (BUDGET_CATEGORIES in the production components) so line
// items copied from a deal render inside the right group.
export function mapSplitToProductionCategory(category: string): string {
  const c = category.toLowerCase();
  if (c.includes("styl")) return "styling";
  if (c.includes("glam") || c.includes("mua") || c.includes("makeup") || c.includes("hair")) return "glam_mua";
  if (c.includes("talent") || c.includes("model")) return "talent";
  if (c.includes("location") || c.includes("studio")) return "location";
  if (c.includes("cater") || c.includes("food")) return "catering";
  if (c.includes("equip") || c.includes("camera") || c.includes("kit")) return "equipment";
  if (c.includes("travel") || c.includes("transport")) return "travel";
  if (c.includes("conting")) return "contingency";
  if (c.includes("internal") || c.includes("staff") || c.includes("fee")) return "internal";
  if (c.includes("production") || c.includes("shoot") || c.includes("crew")) return "production_company";
  return "other";
}

// Map free-form split categories onto the CampaignBudget fixed columns.
export function mapSplitsToCampaignBudget(splits: BudgetSplit[]) {
  let production = 0;
  let media = 0;
  let internal = 0;
  let other = 0;
  for (const s of splits) {
    const c = s.category.toLowerCase();
    if (c.includes("production") || c.includes("shoot") || c.includes("talent") || c.includes("crew")) {
      production += s.amount;
    } else if (c.includes("media") || c.includes("print") || c.includes("digital") || c.includes("ad")) {
      media += s.amount;
    } else if (c.includes("internal") || c.includes("staff") || c.includes("fee")) {
      internal += s.amount;
    } else {
      other += s.amount;
    }
  }
  return { productionBudget: production, mediaBudget: media, internalBudget: internal, otherBudget: other };
}
