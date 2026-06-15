// The media plan: a spreadsheet-style breakdown of placements grouped into
// phases, stored as JSON on Campaign.mediaPlan. Its net grand total IS the
// deal budget (Campaign.value). All money is GBP.

export interface MediaPlanLine {
  id: string;
  placement: string;
  description: string;
  startDate: string | null;
  endDate: string | null;
  rateCard: number; // £ list rate
  discount: number; // %
  netRate: number; // rateCard × (1 - discount/100)
  units: number;
  totalCost: number; // netRate × units
  impressions: number;
  rateType: string; // Flat Fee | Flat Post
  measurement: string; // Impressions | Reach | N/A
  addedValue: string;
  notes: string;
}

export interface MediaPlanPhase {
  id: string;
  name: string;
  lines: MediaPlanLine[];
}

export interface MediaPlanData {
  phases: MediaPlanPhase[];
  version: number;
  updatedAt: string | null;
  updatedBy: string | null;
}

export function emptyMediaPlan(): MediaPlanData {
  return { phases: [], version: 1, updatedAt: null, updatedBy: null };
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function nullableDate(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

// Recompute the derived cells of a line from its inputs.
export function computeLine(line: MediaPlanLine): MediaPlanLine {
  const rateCard = num(line.rateCard);
  const discount = num(line.discount);
  const units = num(line.units) || 0;
  const netRate = Math.round(rateCard * (1 - discount / 100) * 100) / 100;
  const totalCost = Math.round(netRate * units * 100) / 100;
  return { ...line, rateCard, discount, units, netRate, totalCost };
}

export function parseLine(value: unknown, fallbackId: string): MediaPlanLine {
  const v = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const line: MediaPlanLine = {
    id: typeof v.id === "string" && v.id ? v.id : fallbackId,
    placement: str(v.placement),
    description: str(v.description),
    startDate: nullableDate(v.startDate),
    endDate: nullableDate(v.endDate),
    rateCard: num(v.rateCard),
    discount: num(v.discount),
    netRate: num(v.netRate),
    units: v.units === undefined || v.units === null || v.units === "" ? 1 : num(v.units),
    totalCost: num(v.totalCost),
    impressions: num(v.impressions),
    rateType: str(v.rateType) || "Flat Fee",
    measurement: str(v.measurement) || "Impressions",
    addedValue: str(v.addedValue),
    notes: str(v.notes),
  };
  // Always recompute the derived cells so a tampered/stale payload can't lie.
  return computeLine(line);
}

export function parseMediaPlan(value: unknown): MediaPlanData {
  if (!value || typeof value !== "object") return emptyMediaPlan();
  const v = value as Record<string, unknown>;
  const phasesRaw = Array.isArray(v.phases) ? v.phases : [];
  const phases: MediaPlanPhase[] = phasesRaw.map((p, pi) => {
    const po = (p && typeof p === "object" ? p : {}) as Record<string, unknown>;
    const linesRaw = Array.isArray(po.lines) ? po.lines : [];
    return {
      id: typeof po.id === "string" && po.id ? po.id : `phase-${pi}`,
      name: str(po.name) || `Phase ${pi + 1}`,
      lines: linesRaw.map((l, li) => parseLine(l, `phase-${pi}-line-${li}`)),
    };
  });
  return {
    phases,
    version: typeof v.version === "number" && v.version > 0 ? v.version : 1,
    updatedAt: nullableDate(v.updatedAt),
    updatedBy: str(v.updatedBy) || null,
  };
}

export interface MediaPlanTotals {
  gross: number; // sum of rateCard × units
  discount: number; // gross − net
  net: number; // sum of line totals (netRate × units)
}

export function phaseSubtotal(phase: MediaPlanPhase): number {
  return phase.lines.reduce((sum, l) => sum + computeLine(l).totalCost, 0);
}

export function mediaPlanTotals(plan: MediaPlanData): MediaPlanTotals {
  let gross = 0;
  let net = 0;
  for (const phase of plan.phases) {
    for (const line of phase.lines) {
      const c = computeLine(line);
      gross += Math.round(c.rateCard * c.units * 100) / 100;
      net += c.totalCost;
    }
  }
  gross = Math.round(gross * 100) / 100;
  net = Math.round(net * 100) / 100;
  return { gross, discount: Math.round((gross - net) * 100) / 100, net };
}

export function mediaPlanLineCount(plan: MediaPlanData): number {
  return plan.phases.reduce((n, p) => n + p.lines.length, 0);
}
