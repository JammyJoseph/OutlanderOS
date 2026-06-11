// Shared UI constants + types for the Commercial deal pipeline pages.

export const GOLD = "#D4A853";
export const GOLD_DARK = "#c49843";

export type DealStage =
  | "LEAD"
  | "PITCHED"
  | "NEGOTIATING" // legacy — folded into PITCHED in the UI
  | "BRIEF_RECEIVED"
  | "CREATIVE_RESPONSE"
  | "CLIENT_REVIEW"
  | "CLIENT_APPROVED"
  | "CONTRACTED"
  | "BUDGET_SET"
  | "CLEARED_FOR_PRODUCTION"
  | "LIVE"
  | "COMPLETED"
  | "PAID";

export const STAGE_ORDER: DealStage[] = [
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

// Legacy NEGOTIATING deals render in the PITCHED column.
export function normalizeStage(stage: string): DealStage {
  if (stage === "NEGOTIATING") return "PITCHED";
  return (STAGE_ORDER as string[]).includes(stage) ? (stage as DealStage) : "LEAD";
}

// Workflow types — determine the PROCESS a deal goes through.
export type WorkflowType = "CREATIVE_BRIEF" | "SUPPLIED_ASSETS";

export const WORKFLOW_STYLES: Record<WorkflowType, { label: string; bg: string; text: string }> = {
  CREATIVE_BRIEF: { label: "Creative", bg: "bg-purple-100", text: "text-purple-700" },
  SUPPLIED_ASSETS: { label: "Supplied", bg: "bg-gray-200", text: "text-gray-600" },
};

// Creative pipeline stages — only CREATIVE_BRIEF deals pass through these.
export const CREATIVE_STAGES: DealStage[] = [
  "BRIEF_RECEIVED",
  "CREATIVE_RESPONSE",
  "CLIENT_REVIEW",
  "CLIENT_APPROVED",
];

// Stages a SUPPLIED_ASSETS deal can be in (skips creative + production).
export const SUPPLIED_ASSETS_STAGES: DealStage[] = [
  "LEAD",
  "PITCHED",
  "CONTRACTED",
  "BUDGET_SET",
  "LIVE",
  "COMPLETED",
  "PAID",
];

export function stagesForWorkflow(workflowType: string | undefined): DealStage[] {
  return workflowType === "SUPPLIED_ASSETS" ? SUPPLIED_ASSETS_STAGES : STAGE_ORDER;
}

// Kanban column groups, in pipeline order. Creative columns get a purple tint.
export const STAGE_GROUPS: {
  key: string;
  label: string;
  stages: DealStage[];
  accent: string; // header text colour
  dot: string;
  creative?: boolean;
}[] = [
  { key: "prospecting", label: "Prospecting", stages: ["LEAD", "PITCHED"], accent: "text-gray-500", dot: "bg-gray-400" },
  {
    key: "creative",
    label: "Creative",
    stages: ["BRIEF_RECEIVED", "CREATIVE_RESPONSE", "CLIENT_REVIEW", "CLIENT_APPROVED"],
    accent: "text-purple-600",
    dot: "bg-purple-400",
    creative: true,
  },
  { key: "commercial", label: "Commercial", stages: ["CONTRACTED", "BUDGET_SET"], accent: "text-[#9C7424]", dot: "bg-[#D4A853]" },
  { key: "execution", label: "Execution", stages: ["CLEARED_FOR_PRODUCTION", "LIVE"], accent: "text-emerald-600", dot: "bg-emerald-400" },
  { key: "complete", label: "Complete", stages: ["COMPLETED", "PAID"], accent: "text-blue-600", dot: "bg-blue-400" },
];

export const STAGE_STYLES: Record<
  DealStage,
  { label: string; bg: string; text: string; dot: string; bar: string }
> = {
  LEAD: { label: "Lead", bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400", bar: "bg-gray-400" },
  PITCHED: { label: "Pitched", bg: "bg-sky-100", text: "text-sky-700", dot: "bg-sky-400", bar: "bg-sky-400" },
  NEGOTIATING: {
    label: "Negotiating",
    bg: "bg-amber-100",
    text: "text-amber-700",
    dot: "bg-[#D4A853]",
    bar: "bg-[#D4A853]",
  },
  BRIEF_RECEIVED: {
    label: "Brief Received",
    bg: "bg-purple-50",
    text: "text-purple-700",
    dot: "bg-purple-300",
    bar: "bg-purple-300",
  },
  CREATIVE_RESPONSE: {
    label: "Creative Response",
    bg: "bg-purple-100",
    text: "text-purple-700",
    dot: "bg-purple-400",
    bar: "bg-purple-400",
  },
  CLIENT_REVIEW: {
    label: "Client Review",
    bg: "bg-fuchsia-100",
    text: "text-fuchsia-700",
    dot: "bg-fuchsia-400",
    bar: "bg-fuchsia-400",
  },
  CLIENT_APPROVED: {
    label: "Client Approved",
    bg: "bg-violet-100",
    text: "text-violet-700",
    dot: "bg-violet-500",
    bar: "bg-violet-500",
  },
  CONTRACTED: {
    label: "Contracted",
    bg: "bg-amber-100",
    text: "text-amber-700",
    dot: "bg-[#D4A853]",
    bar: "bg-[#D4A853]",
  },
  BUDGET_SET: {
    label: "Budget Set",
    bg: "bg-yellow-100",
    text: "text-yellow-700",
    dot: "bg-yellow-500",
    bar: "bg-yellow-500",
  },
  CLEARED_FOR_PRODUCTION: {
    label: "Cleared for Production",
    bg: "bg-teal-100",
    text: "text-teal-700",
    dot: "bg-teal-400",
    bar: "bg-teal-400",
  },
  LIVE: {
    label: "Live",
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    dot: "bg-emerald-400",
    bar: "bg-emerald-400",
  },
  COMPLETED: { label: "Completed", bg: "bg-blue-100", text: "text-blue-700", dot: "bg-blue-400", bar: "bg-blue-400" },
  PAID: { label: "Paid", bg: "bg-green-100", text: "text-green-700", dot: "bg-green-500", bar: "bg-green-500" },
};

// Creative status — where the brief/response/approval loop is.
export const CREATIVE_STATUS_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  AWAITING_RESPONSE: { label: "Awaiting Response", bg: "bg-amber-100", text: "text-amber-700" },
  RESPONSE_SENT: { label: "Response Sent", bg: "bg-sky-100", text: "text-sky-700" },
  IN_REVIEW: { label: "In Review", bg: "bg-blue-100", text: "text-blue-700" },
  REVISIONS_REQUESTED: { label: "Revisions Requested", bg: "bg-orange-100", text: "text-orange-700" },
  APPROVED: { label: "Approved", bg: "bg-emerald-100", text: "text-emerald-700" },
};

export const CREATIVE_STATUS_ORDER = [
  "AWAITING_RESPONSE",
  "RESPONSE_SENT",
  "IN_REVIEW",
  "REVISIONS_REQUESTED",
  "APPROVED",
] as const;

// The full multi-select deal type catalogue (Campaign.dealTypes).
export const DEAL_TYPE_OPTIONS = [
  "PARTNERSHIP",
  "ADVERTORIAL",
  "EVENT",
  "DIGITAL_PARTNERSHIP",
  "EDITORIAL",
  "PRINT_AD",
  "CONTENT_CREATION",
  "SPONSORSHIP",
] as const;

// Deal types that involve production — they unlock the creative brief and
// the "Clear for Production" flow. Mirrors PRODUCTION_DEAL_TYPES in lib/deal-stages.
export const PRODUCTION_DEAL_TYPES = [
  "EVENT",
  "CONTENT_CREATION",
  "PARTNERSHIP",
  "ADVERTORIAL",
  "EDITORIAL",
] as const;

export const TYPE_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  PARTNERSHIP: { label: "Partnership", bg: "bg-purple-50", text: "text-purple-700" },
  ADVERTORIAL: { label: "Advertorial", bg: "bg-amber-50", text: "text-amber-700" },
  EVENT: { label: "Event", bg: "bg-pink-50", text: "text-pink-700" },
  DIGITAL_PARTNERSHIP: { label: "Digital Partnership", bg: "bg-cyan-50", text: "text-cyan-700" },
  EDITORIAL: { label: "Editorial", bg: "bg-blue-50", text: "text-blue-700" },
  PRINT_AD: { label: "Print Ad", bg: "bg-teal-50", text: "text-teal-700" },
  CONTENT_CREATION: { label: "Content Creation", bg: "bg-rose-50", text: "text-rose-700" },
  SPONSORSHIP: { label: "Sponsorship", bg: "bg-indigo-50", text: "text-indigo-700" },
  // Legacy campaign types
  SUPPLIED_ASSET: { label: "Supplied Asset", bg: "bg-gray-50", text: "text-gray-600" },
  BESPOKE_PRODUCTION: { label: "Bespoke Production", bg: "bg-gray-50", text: "text-gray-600" },
  WHITE_LABEL: { label: "White Label", bg: "bg-gray-50", text: "text-gray-600" },
  EDITORIAL_FEATURE: { label: "Editorial Feature", bg: "bg-gray-50", text: "text-gray-600" },
};

export function typeStyle(type: string) {
  return TYPE_STYLES[type] ?? { label: type, bg: "bg-gray-50", text: "text-gray-600" };
}

// Effective types for a deal — prefers the multi-select dealTypes array and
// falls back to the legacy single type for deals created before the change.
export function dealTypesOf(deal: { dealTypes?: string[] | null; type: string }): string[] {
  if (Array.isArray(deal.dealTypes) && deal.dealTypes.length > 0) return deal.dealTypes;
  return deal.type ? [deal.type] : [];
}

export function isProductionDeal(deal: { dealTypes?: string[] | null; type: string }): boolean {
  return dealTypesOf(deal).some((t) =>
    (PRODUCTION_DEAL_TYPES as readonly string[]).includes(t)
  );
}

export const BRIEF_STATUS_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  DRAFT: { label: "Brief: Draft", bg: "bg-gray-100", text: "text-gray-600" },
  READY: { label: "Brief: Ready", bg: "bg-amber-100", text: "text-amber-700" },
  SENT_TO_PRODUCTION: {
    label: "Brief: Sent to Production",
    bg: "bg-emerald-100",
    text: "text-emerald-700",
  },
};

export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `£${value.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
}

export interface Deal {
  id: string;
  title: string;
  type: string;
  dealTypes?: string[] | null;
  workflowType?: string;
  creativeStatus?: string | null;
  budgetLocked?: boolean;
  briefContent?: string | null;
  briefDueDate?: string | null;
  briefStatus?: string;
  stage: DealStage;
  stageUpdatedAt: string | null;
  status: string;
  value: number | null;
  currency: string;
  description: string | null;
  notes: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  client: { id: string; name: string; industry?: string | null; brandColor?: string | null };
  assignedTo: { id: string; name: string; avatarUrl?: string | null; avatar?: string | null } | null;
  production: { id: string; status: string } | null;
}
