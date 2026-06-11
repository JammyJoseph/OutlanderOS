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

// Multi-select deal types stored in Campaign.dealTypes (string array).
export const DEAL_TYPES = [
  "PARTNERSHIP",
  "ADVERTORIAL",
  "EVENT",
  "DIGITAL_PARTNERSHIP",
  "EDITORIAL",
  "PRINT_AD",
  "CONTENT_CREATION",
  "SPONSORSHIP",
] as const;

export type DealTypeValue = (typeof DEAL_TYPES)[number];

export function isDealType(value: string): value is DealTypeValue {
  return (DEAL_TYPES as readonly string[]).includes(value);
}

// Deal types that involve production work — these unlock the creative brief
// and the "Clear for Production" flow.
export const PRODUCTION_DEAL_TYPES: DealTypeValue[] = [
  "EVENT",
  "CONTENT_CREATION",
  "PARTNERSHIP",
  "ADVERTORIAL",
  "EDITORIAL",
];

export const BRIEF_STATUSES = ["DRAFT", "READY", "SENT_TO_PRODUCTION"] as const;

export function isBriefStatus(value: string): value is (typeof BRIEF_STATUSES)[number] {
  return (BRIEF_STATUSES as readonly string[]).includes(value);
}

// The legacy Campaign.type enum is still required by the schema — map the new
// multi-select values onto it so old consumers keep working.
export function dealTypeToCampaignType(dealType: string): string {
  switch (dealType) {
    case "PARTNERSHIP":
    case "ADVERTORIAL":
    case "EVENT":
    case "EDITORIAL":
    case "PRINT_AD":
      return dealType;
    case "DIGITAL_PARTNERSHIP":
    case "SPONSORSHIP":
      return "PARTNERSHIP";
    case "CONTENT_CREATION":
      return "BESPOKE_PRODUCTION";
    default:
      return "PARTNERSHIP";
  }
}

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

// Budget allocations: where the deal money goes after the company margin.
// Stored on Campaign.allocations; the one flagged isProductionBudget is the
// amount handed to the Production team.
export type BudgetAllocation = { name: string; amount: number; isProductionBudget: boolean };

export function parseAllocations(value: unknown): BudgetAllocation[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (a): a is { name: unknown; amount: unknown; isProductionBudget?: unknown } =>
        !!a && typeof a === "object" && "name" in a && "amount" in a
    )
    .map((a) => ({
      name: String(a.name),
      amount: Number(a.amount) || 0,
      isProductionBudget: Boolean(a.isProductionBudget),
    }))
    .filter((a) => a.name.trim().length > 0);
}

export function productionAllocationOf(allocations: BudgetAllocation[]): number {
  return allocations.filter((a) => a.isProductionBudget).reduce((sum, a) => sum + a.amount, 0);
}

// Production budget lifecycle on a Production created from a deal:
// BUDGETING (line items editable) → LOCKED (budgeted amounts frozen) →
// IN_PROGRESS (actuals coming in) → FINAL (everything frozen).
export const PRODUCTION_BUDGET_STATUSES = ["BUDGETING", "LOCKED", "IN_PROGRESS", "FINAL"] as const;
export type ProductionBudgetStatus = (typeof PRODUCTION_BUDGET_STATUSES)[number];

export function isProductionBudgetStatus(value: string): value is ProductionBudgetStatus {
  return (PRODUCTION_BUDGET_STATUSES as readonly string[]).includes(value);
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
