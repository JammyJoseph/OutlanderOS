// Simplified deal economics — Noah's model.
//
// Media spend has no hard costs (100% margin). Only production has hard costs,
// split between the company margin and the hard-cost budget that goes to the
// Production team.
//
//   Deal Value = Media Spend + Production Budget
//   Production Budget = Company Margin + Hard Cost Budget
//   Company Margin   = Production Budget × (split / 100)
//   Hard Cost Budget = Production Budget − Company Margin   ← sent to Production
//
//   Total Company Revenue = Media Spend + Company Margin  (+ production savings)

import type { BudgetAllocation } from "@/lib/deal-stages";

export const DEFAULT_PRODUCTION_MARGIN_PCT = 60;

export interface SimplifiedEconomics {
  dealValue: number;
  mediaSpend: number;
  productionBudget: number; // dealValue − mediaSpend
  productionMarginPct: number; // company side of the split (0–100)
  companyMargin: number; // production margin kept by the company
  hardCostBudget: number; // goes to the Production team
  totalCompanyRevenue: number; // mediaSpend + companyMargin
}

function clampNumber(n: unknown, fallback = 0): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

// Derives the full breakdown from the three stored inputs. Media spend is
// clamped to [0, dealValue]; the margin split to [0, 100].
export function computeEconomics(input: {
  dealValue?: number | null;
  mediaSpend?: number | null;
  productionMarginPct?: number | null;
}): SimplifiedEconomics {
  const dealValue = Math.max(0, clampNumber(input.dealValue));
  const mediaSpend = Math.min(Math.max(0, clampNumber(input.mediaSpend)), dealValue);
  const productionBudget = Math.max(0, dealValue - mediaSpend);
  const productionMarginPct = Math.min(
    100,
    Math.max(
      0,
      input.productionMarginPct == null || input.productionMarginPct === undefined
        ? DEFAULT_PRODUCTION_MARGIN_PCT
        : clampNumber(input.productionMarginPct, DEFAULT_PRODUCTION_MARGIN_PCT)
    )
  );
  const companyMargin = round2((productionBudget * productionMarginPct) / 100);
  const hardCostBudget = round2(productionBudget - companyMargin);
  const totalCompanyRevenue = round2(mediaSpend + companyMargin);

  return {
    dealValue,
    mediaSpend,
    productionBudget,
    productionMarginPct,
    companyMargin,
    hardCostBudget,
    totalCompanyRevenue,
  };
}

// Maps the simplified economics onto the legacy allocations + margin shape so
// the existing clear-for-production and Finance pipelines keep working unchanged:
//   - Media Spend → a non-production allocation
//   - Hard Cost Budget → the production allocation (isProductionBudget)
//   - Company Margin → marginAmount (the company keeps it)
// margin + allocations === deal value, so the lock balance check passes.
export function economicsToAllocations(eco: SimplifiedEconomics): BudgetAllocation[] {
  const allocations: BudgetAllocation[] = [];
  if (eco.mediaSpend > 0) {
    allocations.push({ name: "Media Spend", amount: round2(eco.mediaSpend), isProductionBudget: false });
  }
  if (eco.hardCostBudget > 0 || eco.productionBudget > 0) {
    allocations.push({ name: "Production", amount: round2(eco.hardCostBudget), isProductionBudget: true });
  }
  return allocations;
}

// marginPercent stored on the deal is the company margin as a % of the deal
// value — keeps the Finance "target margin %" displays meaningful.
export function marginPercentOfDeal(eco: SimplifiedEconomics): number | null {
  if (eco.dealValue <= 0) return null;
  return round2((eco.companyMargin / eco.dealValue) * 100);
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
