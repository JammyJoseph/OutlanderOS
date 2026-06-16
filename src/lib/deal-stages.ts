// Shared constants + helpers for the Commercial deal pipeline.

// The DealStage enum holds BOTH the current (simplified) stages and the legacy
// ones still present in the database. normalizeStage() maps the legacy values
// onto the current set so the UI only ever deals with the new pipeline.
export const DEAL_STAGES = [
  // ── current pipeline ──
  "LEAD",
  "PITCHED",
  "DEAL_SIGNED",
  "CREATIVE_BRIEF",
  "CREATIVE_REVIEW",
  "CREATIVE_APPROVED",
  "APPROVAL",
  "IO_SIGNED",
  "CLEARED_FOR_PRODUCTION",
  "LIVE",
  "COMPLETED",
  "PAID",
  // ── legacy (kept for backwards compat — folded via normalizeStage) ──
  "NEGOTIATING",
  "BRIEF_RECEIVED",
  "CREATIVE_RESPONSE",
  "CLIENT_REVIEW",
  "CLIENT_APPROVED",
  "CONTRACTED",
  "BUDGET_SET",
] as const;

export type DealStageValue = (typeof DEAL_STAGES)[number];

// Canonical display order of the simplified pipeline. Supplied/print deals use a
// subset of these — see stagesForJobType.
export const PIPELINE_STAGES: DealStageValue[] = [
  "LEAD",
  "PITCHED",
  "DEAL_SIGNED",
  "CREATIVE_BRIEF",
  "CREATIVE_REVIEW",
  "CREATIVE_APPROVED",
  "APPROVAL",
  "IO_SIGNED",
  "CLEARED_FOR_PRODUCTION",
  "LIVE",
  "COMPLETED",
  "PAID",
];

// Map any legacy stage value onto the simplified pipeline.
export function normalizeStage(stage: string): DealStageValue {
  switch (stage) {
    case "NEGOTIATING":
      return "PITCHED";
    case "BRIEF_RECEIVED":
      return "CREATIVE_BRIEF";
    case "CREATIVE_RESPONSE":
    case "CLIENT_REVIEW":
      return "CREATIVE_REVIEW";
    case "CLIENT_APPROVED":
      return "CREATIVE_APPROVED";
    case "CONTRACTED":
      return "DEAL_SIGNED";
    case "BUDGET_SET":
      return "IO_SIGNED";
    default:
      return isDealStage(stage) ? (stage as DealStageValue) : "LEAD";
  }
}

// Creative workflow stages — only bespoke (CREATIVE_BRIEF) deals pass through these.
export const CREATIVE_STAGES: DealStageValue[] = [
  "CREATIVE_BRIEF",
  "CREATIVE_REVIEW",
  "CREATIVE_APPROVED",
];

// ── Per-workflow stage lists ────────────────────────────────────────────────
// Bespoke / Creative Brief: full creative + production path.
export const BESPOKE_STAGES: DealStageValue[] = [
  "LEAD",
  "PITCHED",
  "DEAL_SIGNED",
  "CREATIVE_BRIEF",
  "CREATIVE_REVIEW",
  "CREATIVE_APPROVED",
  "IO_SIGNED",
  "CLEARED_FOR_PRODUCTION",
  "LIVE",
  "COMPLETED",
  "PAID",
];

// Supplied assets: client provides content — single approval, no production.
export const SUPPLIED_ASSETS_STAGES: DealStageValue[] = [
  "LEAD",
  "PITCHED",
  "DEAL_SIGNED",
  "APPROVAL",
  "LIVE",
  "COMPLETED",
  "PAID",
];

// Print ad: simplest path — sign the deal, go live.
export const PRINT_AD_STAGES: DealStageValue[] = [
  "LEAD",
  "PITCHED",
  "DEAL_SIGNED",
  "LIVE",
  "COMPLETED",
  "PAID",
];

// Stages counted as "won" / revenue booked — from deal sign-off onward.
export const WON_STAGES: DealStageValue[] = [
  "DEAL_SIGNED",
  "CREATIVE_BRIEF",
  "CREATIVE_REVIEW",
  "CREATIVE_APPROVED",
  "APPROVAL",
  "IO_SIGNED",
  "CLEARED_FOR_PRODUCTION",
  "LIVE",
  "COMPLETED",
  "PAID",
  // legacy raw values
  "CONTRACTED",
  "BUDGET_SET",
];

// Stages counted in active pipeline value (everything not yet completed/paid).
export const ACTIVE_STAGES: DealStageValue[] = [
  "LEAD",
  "PITCHED",
  "DEAL_SIGNED",
  "CREATIVE_BRIEF",
  "CREATIVE_REVIEW",
  "CREATIVE_APPROVED",
  "APPROVAL",
  "IO_SIGNED",
  "CLEARED_FOR_PRODUCTION",
  "LIVE",
  // legacy raw values
  "NEGOTIATING",
  "BRIEF_RECEIVED",
  "CREATIVE_RESPONSE",
  "CLIENT_REVIEW",
  "CLIENT_APPROVED",
  "CONTRACTED",
  "BUDGET_SET",
];

// ── Workflow type — determines the PROCESS a deal goes through ──────────────
export const WORKFLOW_TYPES = ["CREATIVE_BRIEF", "SUPPLIED_ASSETS"] as const;
export type WorkflowTypeValue = (typeof WORKFLOW_TYPES)[number];

export function isWorkflowType(value: string): value is WorkflowTypeValue {
  return (WORKFLOW_TYPES as readonly string[]).includes(value);
}

export function stagesForWorkflow(workflowType: string): DealStageValue[] {
  return workflowType === "SUPPLIED_ASSETS" ? SUPPLIED_ASSETS_STAGES : BESPOKE_STAGES;
}

// The stage list a deal can move through, keyed on its jobType (preferred) with
// a fallback to the workflowType for older deals that predate jobType.
export function stagesForJobType(jobType: string): DealStageValue[] {
  switch (jobType) {
    case "SUPPLIED_ASSETS":
      return SUPPLIED_ASSETS_STAGES;
    case "PRINT_AD":
      return PRINT_AD_STAGES;
    case "CREATIVE_BRIEF":
      return BESPOKE_STAGES;
    default:
      return BESPOKE_STAGES;
  }
}

// Resolve the valid stage list for a deal — prefers jobType, falls back to
// workflowType (print/supplied share the SUPPLIED_ASSETS workflow but differ).
export function stagesForDeal(deal: { jobType?: string | null; workflowType?: string | null }): DealStageValue[] {
  if (deal.jobType && isJobType(deal.jobType)) return stagesForJobType(deal.jobType);
  return stagesForWorkflow(deal.workflowType ?? "CREATIVE_BRIEF");
}

// True when `stage` is a legal stage for this deal's workflow/job type.
export function isStageValidForDeal(
  stage: string,
  deal: { jobType?: string | null; workflowType?: string | null }
): boolean {
  return (stagesForDeal(deal) as string[]).includes(normalizeStage(stage));
}

// ── Job type — the user-facing classifier chosen when a deal is created ─────
// It drives the auto-tags (dealTypes), the available extensions, and the
// underlying workflowType (which still drives the pipeline process).
export const JOB_TYPES = ["CREATIVE_BRIEF", "SUPPLIED_ASSETS", "PRINT_AD"] as const;
export type JobTypeValue = (typeof JOB_TYPES)[number];

export function isJobType(value: string): value is JobTypeValue {
  return (JOB_TYPES as readonly string[]).includes(value);
}

export interface JobTypeConfig {
  label: string;
  description: string;
  // dealTypes applied automatically when this job type is chosen.
  autoTags: DealTypeValue[];
  // Optional extra dealTypes the user can tick on at creation.
  extensions: DealTypeValue[];
  workflowType: WorkflowTypeValue;
}

export const JOB_TYPE_CONFIG: Record<JobTypeValue, JobTypeConfig> = {
  CREATIVE_BRIEF: {
    label: "Creative Brief",
    description: "Bespoke content, needs a creative response.",
    autoTags: ["BESPOKE_CONTENT"],
    extensions: ["EVENT", "ADVERTORIAL"],
    workflowType: "CREATIVE_BRIEF",
  },
  SUPPLIED_ASSETS: {
    label: "Supplied Assets",
    description: "Client provides the content.",
    autoTags: ["SUPPLIED_ASSETS"],
    extensions: ["EVENT", "PRINT_ADVERTORIAL"],
    workflowType: "SUPPLIED_ASSETS",
  },
  PRINT_AD: {
    label: "Print Ad",
    description: "Print advertising.",
    autoTags: ["PRINT_AD"],
    extensions: [],
    workflowType: "SUPPLIED_ASSETS",
  },
};

export function workflowForJobType(jobType: string): WorkflowTypeValue {
  return isJobType(jobType) ? JOB_TYPE_CONFIG[jobType].workflowType : "CREATIVE_BRIEF";
}

// The dealTypes a freshly-created deal should carry: the job type's auto-tags
// plus any selected extensions (deduped, validated).
export function dealTypesForJob(jobType: string, extensions: string[]): DealTypeValue[] {
  const cfg = isJobType(jobType) ? JOB_TYPE_CONFIG[jobType] : JOB_TYPE_CONFIG.CREATIVE_BRIEF;
  const allowed = new Set<string>(cfg.extensions);
  const picked = (extensions ?? []).filter((e) => allowed.has(e) && isDealType(e)) as DealTypeValue[];
  return Array.from(new Set<DealTypeValue>([...cfg.autoTags, ...picked]));
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
  // Set when the brief is "sent to the creative team" — drives the production
  // portal's "Creative in Progress" visibility.
  sentToCreativeAt: string | null;
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
    sentToCreativeAt:
      typeof v.sentToCreativeAt === "string" && v.sentToCreativeAt ? v.sentToCreativeAt : null,
  };
}

export type CreativeRevision = {
  treatment: string;
  figmaUrl: string | null; // Figma deck link for this version
  moodBoardLinks: string[];
  sentDate: string | null;
  submittedBy: string | null; // who submitted this version
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
      figmaUrl: typeof x.figmaUrl === "string" && x.figmaUrl ? x.figmaUrl : null,
      moodBoardLinks: Array.isArray(x.moodBoardLinks)
        ? x.moodBoardLinks.filter((l): l is string => typeof l === "string" && l.trim().length > 0)
        : [],
      sentDate: typeof x.sentDate === "string" && x.sentDate ? x.sentDate : null,
      submittedBy: typeof x.submittedBy === "string" && x.submittedBy ? x.submittedBy : null,
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
  const stage = normalizeStage(deal.stage);
  const stageIdx = PIPELINE_STAGES.indexOf(stage);
  // Bespoke: creative must be approved (CREATIVE_APPROVED or later).
  // Supplied/print: the deal just needs to be signed (DEAL_SIGNED or later).
  const gateIdx = PIPELINE_STAGES.indexOf(creative ? "CREATIVE_APPROVED" : "DEAL_SIGNED");
  const stageOk = stageIdx >= gateIdx;

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
      label: "Media plan locked",
      ok: deal.budgetLocked,
      detail: !deal.budgetLocked ? "Lock the media plan on the Media Plan tab" : undefined,
    },
    {
      key: "brief",
      label: "Brief attached",
      ok: briefOk,
      detail: !briefOk ? "Add the client brief content on the Brief & Creative tab" : undefined,
    },
    {
      key: "stage",
      label: creative ? "Creative approved (deal at Creative Approved+)" : "Deal signed (Deal Signed or later)",
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
  "PRINT_ADVERTORIAL",
  "CONTENT_CREATION",
  "BESPOKE_CONTENT",
  "SUPPLIED_ASSETS",
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
  "BESPOKE_CONTENT",
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
    case "PRINT_ADVERTORIAL":
      return "PRINT_AD";
    case "DIGITAL_PARTNERSHIP":
    case "SPONSORSHIP":
      return "PARTNERSHIP";
    case "CONTENT_CREATION":
    case "BESPOKE_CONTENT":
      return "BESPOKE_PRODUCTION";
    case "SUPPLIED_ASSETS":
      return "SUPPLIED_ASSET";
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
