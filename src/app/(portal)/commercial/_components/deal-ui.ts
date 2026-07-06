// Shared UI constants + types for the Commercial deal pipeline pages.

export const GOLD = "#9C7C2E";
export const GOLD_DARK = "#9C7C2E";

export type DealStage =
  // ── current pipeline ──
  | "NEW_BRIEF"
  | "PITCHING_FEEDBACK"
  | "APPROVAL"
  | "SIGN_OFF"
  | "IO_SIGNED_KICK_OFF"
  | "IN_PRODUCTION"
  | "LIVE"
  | "COMPLETED"
  | "PAID"
  // ── legacy — folded via normalizeStage ──
  | "LEAD"
  | "PITCHED"
  | "DEAL_SIGNED"
  | "CREATIVE_BRIEF"
  | "CREATIVE_REVIEW"
  | "CREATIVE_APPROVED"
  | "IO_SIGNED"
  | "CLEARED_FOR_PRODUCTION"
  | "NEGOTIATING"
  | "BRIEF_RECEIVED"
  | "CREATIVE_RESPONSE"
  | "CLIENT_REVIEW"
  | "CLIENT_APPROVED"
  | "CONTRACTED"
  | "BUDGET_SET";

// Canonical display order of the simplified pipeline.
export const STAGE_ORDER: DealStage[] = [
  "NEW_BRIEF",
  "PITCHING_FEEDBACK",
  "APPROVAL",
  "SIGN_OFF",
  "IO_SIGNED_KICK_OFF",
  "IN_PRODUCTION",
  "LIVE",
  "COMPLETED",
  "PAID",
];

// Fold legacy stage values onto the simplified pipeline.
export function normalizeStage(stage: string): DealStage {
  switch (stage) {
    case "NEW_BRIEF":
    case "PITCHING_FEEDBACK":
    case "APPROVAL":
    case "SIGN_OFF":
    case "IO_SIGNED_KICK_OFF":
    case "IN_PRODUCTION":
    case "LIVE":
    case "COMPLETED":
    case "PAID":
      return stage as DealStage;
    case "LEAD":
    case "CREATIVE_BRIEF":
    case "BRIEF_RECEIVED":
      return "NEW_BRIEF";
    case "PITCHED":
    case "NEGOTIATING":
    case "CREATIVE_REVIEW":
    case "CREATIVE_RESPONSE":
    case "CLIENT_REVIEW":
      return "PITCHING_FEEDBACK";
    case "DEAL_SIGNED":
    case "CONTRACTED":
    case "CREATIVE_APPROVED":
    case "CLIENT_APPROVED":
      return "SIGN_OFF";
    case "IO_SIGNED":
    case "BUDGET_SET":
      return "IO_SIGNED_KICK_OFF";
    case "CLEARED_FOR_PRODUCTION":
      return "IN_PRODUCTION";
    default:
      return "NEW_BRIEF";
  }
}

// Workflow types — determine the PROCESS a deal goes through.
export type WorkflowType = "CREATIVE_BRIEF" | "SUPPLIED_ASSETS";

export const WORKFLOW_STYLES: Record<WorkflowType, { label: string; bg: string; text: string }> = {
  CREATIVE_BRIEF: { label: "Creative", bg: "bg-purple-100", text: "text-purple-700" },
  SUPPLIED_ASSETS: { label: "Supplied", bg: "bg-gray-200", text: "text-gray-600" },
};

// Creative pipeline stages — only bespoke deals pass through the creative loop.
export const CREATIVE_STAGES: DealStage[] = [
  "NEW_BRIEF",
  "PITCHING_FEEDBACK",
];

// ── Per-job-type stage lists ────────────────────────────────────────────────
export const BESPOKE_STAGES: DealStage[] = [
  "NEW_BRIEF",
  "PITCHING_FEEDBACK",
  "SIGN_OFF",
  "IO_SIGNED_KICK_OFF",
  "IN_PRODUCTION",
  "COMPLETED",
  "PAID",
];

export const SUPPLIED_ASSETS_STAGES: DealStage[] = [
  "NEW_BRIEF",
  "APPROVAL",
  "LIVE",
  "COMPLETED",
  "PAID",
];

export const PRINT_AD_STAGES: DealStage[] = [
  "NEW_BRIEF",
  "LIVE",
  "COMPLETED",
  "PAID",
];

export function stagesForJobType(jobType: string | undefined): DealStage[] {
  switch (jobType) {
    case "SUPPLIED_ASSETS":
      return SUPPLIED_ASSETS_STAGES;
    case "PRINT_AD":
      return PRINT_AD_STAGES;
    default:
      return BESPOKE_STAGES;
  }
}

export function stagesForWorkflow(workflowType: string | undefined): DealStage[] {
  return workflowType === "SUPPLIED_ASSETS" ? SUPPLIED_ASSETS_STAGES : BESPOKE_STAGES;
}

// Valid stages for a deal — prefers jobType, falls back to workflowType.
export function stagesForDeal(deal: { jobType?: string | null; workflowType?: string | null }): DealStage[] {
  if (deal.jobType && ["CREATIVE_BRIEF", "SUPPLIED_ASSETS", "PRINT_AD"].includes(deal.jobType)) {
    return stagesForJobType(deal.jobType);
  }
  return stagesForWorkflow(deal.workflowType ?? "CREATIVE_BRIEF");
}

// Kanban column groups, in pipeline order. Creative columns get a purple tint;
// the approval column is shown for supplied/print deals only.
export const STAGE_GROUPS: {
  key: string;
  label: string;
  stages: DealStage[];
  accent: string; // header text colour
  dot: string;
  creative?: boolean;
  note?: string;
}[] = [
  {
    key: "pipeline",
    label: "Pipeline",
    stages: ["NEW_BRIEF", "PITCHING_FEEDBACK", "APPROVAL"],
    accent: "text-purple-600",
    dot: "bg-purple-400",
  },
  {
    key: "deal",
    label: "Deal",
    stages: ["SIGN_OFF", "IO_SIGNED_KICK_OFF"],
    accent: "text-[#9C7424]",
    dot: "bg-[#9C7C2E]",
  },
  {
    key: "active",
    label: "Active",
    stages: ["IN_PRODUCTION", "LIVE"],
    accent: "text-emerald-600",
    dot: "bg-emerald-400",
  },
  {
    key: "complete",
    label: "Complete",
    stages: ["COMPLETED", "PAID"],
    accent: "text-blue-600",
    dot: "bg-blue-400",
  },
];

export const STAGE_STYLES: Record<
  DealStage,
  { label: string; bg: string; text: string; dot: string; bar: string }
> = {
  // ── current simplified pipeline ──
  NEW_BRIEF: { label: "New Brief", bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400", bar: "bg-gray-400" },
  PITCHING_FEEDBACK: {
    label: "Pitching & Feedback",
    bg: "bg-purple-100",
    text: "text-purple-700",
    dot: "bg-purple-400",
    bar: "bg-purple-400",
  },
  APPROVAL: {
    label: "Approval",
    bg: "bg-sky-100",
    text: "text-sky-700",
    dot: "bg-sky-500",
    bar: "bg-sky-500",
  },
  SIGN_OFF: {
    label: "Sign Off",
    bg: "bg-amber-100",
    text: "text-amber-700",
    dot: "bg-amber-400",
    bar: "bg-amber-400",
  },
  IO_SIGNED_KICK_OFF: {
    label: "IO Signed & Kick Off",
    bg: "bg-yellow-100",
    text: "text-yellow-700",
    dot: "bg-[#9C7C2E]",
    bar: "bg-[#9C7C2E]",
  },
  IN_PRODUCTION: {
    label: "In Production",
    bg: "bg-red-100",
    text: "text-red-700",
    dot: "bg-red-500",
    bar: "bg-red-500",
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
  // ── legacy aliases (rendered only if a raw legacy value slips through) ──
  LEAD: { label: "New Brief", bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400", bar: "bg-gray-400" },
  PITCHED: { label: "Pitching & Feedback", bg: "bg-purple-100", text: "text-purple-700", dot: "bg-purple-400", bar: "bg-purple-400" },
  DEAL_SIGNED: { label: "Sign Off", bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-400", bar: "bg-amber-400" },
  CREATIVE_BRIEF: { label: "New Brief", bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400", bar: "bg-gray-400" },
  CREATIVE_REVIEW: { label: "Pitching & Feedback", bg: "bg-purple-100", text: "text-purple-700", dot: "bg-purple-400", bar: "bg-purple-400" },
  CREATIVE_APPROVED: { label: "Sign Off", bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-400", bar: "bg-amber-400" },
  IO_SIGNED: { label: "IO Signed & Kick Off", bg: "bg-yellow-100", text: "text-yellow-700", dot: "bg-[#9C7C2E]", bar: "bg-[#9C7C2E]" },
  CLEARED_FOR_PRODUCTION: { label: "In Production", bg: "bg-red-100", text: "text-red-700", dot: "bg-red-500", bar: "bg-red-500" },
  NEGOTIATING: { label: "Pitching & Feedback", bg: "bg-purple-100", text: "text-purple-700", dot: "bg-purple-400", bar: "bg-purple-400" },
  BRIEF_RECEIVED: { label: "New Brief", bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400", bar: "bg-gray-400" },
  CREATIVE_RESPONSE: { label: "Pitching & Feedback", bg: "bg-purple-100", text: "text-purple-700", dot: "bg-purple-400", bar: "bg-purple-400" },
  CLIENT_REVIEW: { label: "Pitching & Feedback", bg: "bg-purple-100", text: "text-purple-700", dot: "bg-purple-400", bar: "bg-purple-400" },
  CLIENT_APPROVED: { label: "Sign Off", bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-400", bar: "bg-amber-400" },
  CONTRACTED: { label: "Sign Off", bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-400", bar: "bg-amber-400" },
  BUDGET_SET: { label: "IO Signed & Kick Off", bg: "bg-yellow-100", text: "text-yellow-700", dot: "bg-[#9C7C2E]", bar: "bg-[#9C7C2E]" },
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
  "PRINT_ADVERTORIAL",
  "CONTENT_CREATION",
  "BESPOKE_CONTENT",
  "SUPPLIED_ASSETS",
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
  PRINT_ADVERTORIAL: { label: "Print Advertorial", bg: "bg-teal-50", text: "text-teal-700" },
  CONTENT_CREATION: { label: "Content Creation", bg: "bg-rose-50", text: "text-rose-700" },
  BESPOKE_CONTENT: { label: "Bespoke Content Production", bg: "bg-rose-50", text: "text-rose-700" },
  SUPPLIED_ASSETS: { label: "Supplied Assets", bg: "bg-gray-100", text: "text-gray-600" },
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
  jobType?: string | null;
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
  archived?: boolean;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  client: { id: string; name: string; industry?: string | null; brandColor?: string | null };
  assignedTo: { id: string; name: string; avatarUrl?: string | null; avatar?: string | null } | null;
  production: { id: string; status: string } | null;
}
