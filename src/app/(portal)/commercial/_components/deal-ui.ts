// Shared UI constants + types for the Commercial deal pipeline pages.

export const GOLD = "#D4A853";
export const GOLD_DARK = "#c49843";

export type DealStage =
  | "LEAD"
  | "PITCHED"
  | "NEGOTIATING"
  | "CONTRACTED"
  | "LIVE"
  | "COMPLETED"
  | "PAID";

export const STAGE_ORDER: DealStage[] = [
  "LEAD",
  "PITCHED",
  "NEGOTIATING",
  "CONTRACTED",
  "LIVE",
  "COMPLETED",
  "PAID",
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
  CONTRACTED: {
    label: "Contracted",
    bg: "bg-violet-100",
    text: "text-violet-700",
    dot: "bg-violet-400",
    bar: "bg-violet-400",
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

export const DEAL_TYPE_OPTIONS = ["PARTNERSHIP", "ADVERTORIAL", "EVENT", "EDITORIAL"] as const;

export const TYPE_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  PARTNERSHIP: { label: "Partnership", bg: "bg-purple-50", text: "text-purple-700" },
  ADVERTORIAL: { label: "Advertorial", bg: "bg-amber-50", text: "text-amber-700" },
  EVENT: { label: "Event", bg: "bg-pink-50", text: "text-pink-700" },
  EDITORIAL: { label: "Editorial", bg: "bg-blue-50", text: "text-blue-700" },
  // Legacy campaign types
  SUPPLIED_ASSET: { label: "Supplied Asset", bg: "bg-gray-50", text: "text-gray-600" },
  BESPOKE_PRODUCTION: { label: "Bespoke Production", bg: "bg-gray-50", text: "text-gray-600" },
  WHITE_LABEL: { label: "White Label", bg: "bg-gray-50", text: "text-gray-600" },
  EDITORIAL_FEATURE: { label: "Editorial Feature", bg: "bg-gray-50", text: "text-gray-600" },
  PRINT_AD: { label: "Print Ad", bg: "bg-gray-50", text: "text-gray-600" },
};

export function typeStyle(type: string) {
  return TYPE_STYLES[type] ?? { label: type, bg: "bg-gray-50", text: "text-gray-600" };
}

export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `£${value.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
}

export interface Deal {
  id: string;
  title: string;
  type: string;
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
