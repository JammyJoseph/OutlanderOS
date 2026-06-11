// Shared constants + helpers for the Commercial deal pipeline.

export const DEAL_STAGES = [
  "LEAD",
  "PITCHED",
  "NEGOTIATING", // legacy — folded into PITCHED in the UI
  "BRIEF_RECEIVED",
  "CREATIVE_RESPONSE",
  "CLIENT_REVIEW",
  "CLIENT_APPROVED",
  "CONTRACTED",
  "BUDGET_SET",
  "CLEARED_FOR_PRODUCTION",
  "LIVE",
  "COMPLETED",
  "PAID",
] as const;

export type DealStageValue = (typeof DEAL_STAGES)[number];

// Display order of the pipeline (legacy NEGOTIATING excluded — normalizeStage
// folds those deals into PITCHED).
export const PIPELINE_STAGES: DealStageValue[] = [
  "LEAD",
  "PITCHED",
  "BRIEF_RECEIVED",
  "CREATIVE_RESPONSE",
  "CLIENT_REVIEW",
  "CLIENT_APPROVED",
  "CONTRACTED",
  "BUDGET_SET",
  "CLEARED_FOR_PRODUCTION",
  "LIVE",
  "COMPLETED",
  "PAID",
];

export function normalizeStage(stage: string): DealStageValue {
  if (stage === "NEGOTIATING") return "PITCHED";
  return isDealStage(stage) ? stage : "LEAD";
}

// Creative workflow stages — only CREATIVE_BRIEF deals pass through these.
export const CREATIVE_STAGES: DealStageValue[] = [
  "BRIEF_RECEIVED",
  "CREATIVE_RESPONSE",
  "CLIENT_REVIEW",
  "CLIENT_APPROVED",
];

// Stages a SUPPLIED_ASSETS deal can be in (skips creative + production).
export const SUPPLIED_ASSETS_STAGES: DealStageValue[] = [
  "LEAD",
  "PITCHED",
  "CONTRACTED",
  "BUDGET_SET",
  "LIVE",
  "COMPLETED",
  "PAID",
];

// Stages counted as "won" / revenue booked
export const WON_STAGES: DealStageValue[] = [
  "CONTRACTED",
  "BUDGET_SET",
  "CLEARED_FOR_PRODUCTION",
  "LIVE",
  "COMPLETED",
  "PAID",
];

// Stages counted in active pipeline value
export const ACTIVE_STAGES: DealStageValue[] = [
  "LEAD",
  "PITCHED",
  "NEGOTIATING",
  "BRIEF_RECEIVED",
  "CREATIVE_RESPONSE",
  "CLIENT_REVIEW",
  "CLIENT_APPROVED",
  "CONTRACTED",
  "BUDGET_SET",
  "CLEARED_FOR_PRODUCTION",
  "LIVE",
];

// ── Workflow type — determines the PROCESS a deal goes through ──────────────
export const WORKFLOW_TYPES = ["CREATIVE_BRIEF", "SUPPLIED_ASSETS"] as const;
export type WorkflowTypeValue = (typeof WORKFLOW_TYPES)[number];

export function isWorkflowType(value: string): value is WorkflowTypeValue {
  return (WORKFLOW_TYPES as readonly string[]).includes(value);
}

export function stagesForWorkflow(workflowType: string): DealStageValue[] {
  return workflowType === "SUPPLIED_ASSETS" ? SUPPLIED_ASSETS_STAGES : PIPELINE_STAGES;
}

// ── Creative status — where the brief/response/approval loop is ─────────────
export const CREATIVE_STATUSES = [
  "AWAITING_RESPONSE",
  "RESPONSE_SENT",
  "IN_REVIEW",
  "REVISIONS_REQUESTED",
  "APPROVED",
] as const;
export type CreativeStatusValue = (typeof CREATIVE_STATUSES)[number];

export function isCreativeStatus(value: string): value is CreativeStatusValue {
  return (CREATIVE_STATUSES as readonly string[]).includes(value);
}

// ── Creative workflow JSON shapes stored on Campaign ────────────────────────
export type ClientBrief = {
  content: string;
  references: string[];
  receivedDate: string | null;
  responseDueDate: string | null;
};

export function parseClientBrief(value: unknown): ClientBrief | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  return {
    content: typeof v.content === "string" ? v.content : "",
    references: Array.isArray(v.references)
      ? v.references.filter((r): r is string => typeof r === "string" && r.trim().length > 0)
      : [],
    receivedDate: typeof v.receivedDate === "string" && v.receivedDate ? v.receivedDate : null,
    responseDueDate:
      typeof v.responseDueDate === "string" && v.responseDueDate ? v.responseDueDate : null,
  };
}

export type CreativeRevision = {
  treatment: string;
  moodBoardLinks: string[];
  sentDate: string | null;
};

export type CreativeResponse = CreativeRevision & {
  revisions: CreativeRevision[];
};

export function parseCreativeResponse(value: unknown): CreativeResponse | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const parseRevision = (r: unknown): CreativeRevision | null => {
    if (!r || typeof r !== "object") return null;
    const x = r as Record<string, unknown>;
    return {
      treatment: typeof x.treatment === "string" ? x.treatment : "",
      moodBoardLinks: Array.isArray(x.moodBoardLinks)
        ? x.moodBoardLinks.filter((l): l is string => typeof l === "string" && l.trim().length > 0)
        : [],
      sentDate: typeof x.sentDate === "string" && x.sentDate ? x.sentDate : null,
    };
  };
  const base = parseRevision(value);
  if (!base) return null;
  return {
    ...base,
    revisions: Array.isArray(v.revisions)
      ? (v.revisions.map(parseRevision).filter(Boolean) as CreativeRevision[])
      : [],
  };
}

export type FeedbackEntry = {
  date: string;
  from: string;
  text: string;
  type: "note" | "revision" | "approval";
};

export function parseClientFeedback(value: unknown): FeedbackEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((f): f is Record<string, unknown> => !!f && typeof f === "object")
    .map((f) => ({
      date: typeof f.date === "string" ? f.date : new Date().toISOString(),
      from: typeof f.from === "string" ? f.from : "",
      text: typeof f.text === "string" ? f.text : "",
      type: (["note", "revision", "approval"].includes(String(f.type))
        ? String(f.type)
        : "note") as FeedbackEntry["type"],
    }))
    .filter((f) => f.text.trim().length > 0);
}

// ── Clear for Production readiness checklist ─────────────────────────────────
// Shared by the API gate and the deal page launch checklist.
export type ChecklistItem = { key: string; label: string; ok: boolean; detail?: string };

export function clearForProductionChecklist(deal: {
  stage: string;
  workflowType: string;
  budgetLocked: boolean;
  creativeStatus: string | null;
  clientBrief: unknown;
  briefContent: string | null;
  description?: string | null;
}): { items: ChecklistItem[]; ready: boolean } {
  const creative = deal.workflowType !== "SUPPLIED_ASSETS";
  const stageIdx = PIPELINE_STAGES.indexOf(normalizeStage(deal.stage));
  const contractedIdx = PIPELINE_STAGES.indexOf("CONTRACTED");
  const stageOk = creative
    ? deal.stage === "CLIENT_APPROVED" || stageIdx >= contractedIdx
    : stageIdx >= contractedIdx;

  const brief = parseClientBrief(deal.clientBrief);
  const briefOk = Boolean(brief?.content?.trim() || deal.briefContent?.trim());

  const items: ChecklistItem[] = [
    {
      key: "creative",
      label: creative ? "Creative approved by client" : "Creative approval (N/A — supplied assets)",
      ok: creative ? deal.creativeStatus === "APPROVED" : true,
      detail: creative && deal.creativeStatus !== "APPROVED"
        ? "Log an approval in Client Feedback on the Brief & Creative tab"
        : undefined,
    },
    {
      key: "budget",
      label: "Budget locked",
      ok: deal.budgetLocked,
      detail: !deal.budgetLocked ? "Lock & Submit the budget on the Budget tab" : undefined,
    },
    {
      key: "brief",
      label: "Brief attached",
      ok: briefOk,
      detail: !briefOk ? "Add the client brief content on the Brief & Creative tab" : undefined,
    },
    {
      key: "stage",
      label: creative ? "Deal at Client Approved or Contracted+" : "Deal at Contracted or later",
      ok: stageOk,
      detail: !stageOk ? "Move the deal forward in the pipeline first" : undefined,
    },
  ];

  return { items, ready: items.every((i) => i.ok) };
}

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
