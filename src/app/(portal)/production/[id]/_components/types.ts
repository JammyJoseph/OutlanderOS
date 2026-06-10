export type ProductionStatus =
  | "DRAFT"
  | "BRIEFED"
  | "PRE_PRODUCTION"
  | "SHOOTING"
  | "POST_PRODUCTION"
  | "DELIVERED"
  | "ARCHIVED";

export type CallSheetStatus = "DRAFT" | "SAVED" | "PUBLISHED";

export type TeamStatus = "SUGGESTED" | "CONFIRMED" | "CONTRACTED";

export type TaskStatus = "LOCKED" | "READY" | "IN_PROGRESS" | "DONE";

export type DeliverableStatus = "AWAITING" | "IN_PROGRESS" | "DELIVERED" | "APPROVED";

export interface CallSheet {
  id: string;
  shootDate: string;
  callTime: string;
  notes: string | null;
  status: CallSheetStatus;
  location?: { address?: string } | null;
}

export interface CrewMember {
  id: string;
  role: string;
  contact: { id: string; name: string; email?: string | null; phone?: string | null };
}

export interface BudgetLineItem {
  id: string;
  productionId: string;
  category: string;
  description: string;
  budgeted: number;
  actual: number;
  notes: string | null;
  sortOrder: number;
}

export interface ProductionTask {
  id: string;
  productionId: string;
  title: string;
  description: string | null;
  owner: string | null;
  dueDate: string | null;
  status: TaskStatus;
  dependsOn: string | null;
  sortOrder: number;
}

export interface TeamMember {
  id: string;
  productionId: string;
  name: string;
  role: string;
  email: string | null;
  phone: string | null;
  rate: number | null;
  ratePer: string | null;
  status: TeamStatus;
  notes: string | null;
}

export interface CreativeAsset {
  id: string;
  productionId: string;
  type: string;
  title: string;
  url: string | null;
  description: string | null;
  sortOrder: number;
}

export interface ScheduleBlock {
  id: string;
  productionId: string;
  shootDay: number;
  time: string;
  activity: string;
  location: string | null;
  notes: string | null;
  sortOrder: number;
}

export interface ProductionDeliverable {
  id: string;
  productionId: string;
  type: string;
  title: string;
  status: DeliverableStatus;
  dueDate: string | null;
  url: string | null;
  notes: string | null;
}

export interface ProductionFull {
  id: string;
  title: string;
  type: string; // "EDITORIAL" | "COMMERCIAL"
  campaignBudgetId: string | null;
  status: ProductionStatus;
  brief: string | null;
  description: string | null;
  figmaUrl: string | null;
  clientName: string | null;
  campaignId: string | null;
  trelloCardId: string | null;
  budgetTotal: number | null;
  budgetActual: number | null;
  shootDates: string[];
  campaign: { id?: string; title: string; client: { name: string } } | null;
  callSheets: CallSheet[];
  crew: CrewMember[];
  budgetItems: BudgetLineItem[];
  productionTasks: ProductionTask[];
  teamMembers: TeamMember[];
  creativeAssets: CreativeAsset[];
  scheduleBlocks: ScheduleBlock[];
  prodDeliverables: ProductionDeliverable[];
}

export const PRODUCTION_STATUS_STYLES: Record<
  ProductionStatus,
  { bg: string; text: string; dot: string; label: string }
> = {
  DRAFT: { bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400", label: "Planning" },
  BRIEFED: { bg: "bg-blue-100", text: "text-blue-700", dot: "bg-blue-400", label: "Briefed" },
  PRE_PRODUCTION: {
    bg: "bg-purple-100",
    text: "text-purple-700",
    dot: "bg-purple-400",
    label: "Pre-Production",
  },
  SHOOTING: { bg: "bg-amber-100", text: "text-amber-700", dot: "bg-[#D4A853]", label: "Shooting" },
  POST_PRODUCTION: {
    bg: "bg-orange-100",
    text: "text-orange-700",
    dot: "bg-orange-400",
    label: "Wrap",
  },
  DELIVERED: {
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    dot: "bg-emerald-400",
    label: "Complete",
  },
  ARCHIVED: { bg: "bg-gray-100", text: "text-gray-400", dot: "bg-gray-300", label: "Archived" },
};

export const STATUS_OPTIONS: ProductionStatus[] = [
  "DRAFT",
  "PRE_PRODUCTION",
  "SHOOTING",
  "POST_PRODUCTION",
  "DELIVERED",
];

export const BUDGET_CATEGORIES: { key: string; label: string }[] = [
  { key: "production_company", label: "Production Company" },
  { key: "styling", label: "Styling" },
  { key: "glam_mua", label: "Glam / MUA" },
  { key: "talent", label: "Talent" },
  { key: "location", label: "Location" },
  { key: "catering", label: "Catering" },
  { key: "equipment", label: "Equipment" },
  { key: "travel", label: "Travel" },
  { key: "contingency", label: "Contingency" },
  { key: "internal", label: "Internal" },
  { key: "other", label: "Other" },
];

export const CREATIVE_TYPES: { key: string; label: string; color: string }[] = [
  { key: "brief", label: "Brief", color: "bg-blue-50 text-blue-700" },
  { key: "moodboard", label: "Moodboard", color: "bg-pink-50 text-pink-700" },
  { key: "reference", label: "Reference", color: "bg-purple-50 text-purple-700" },
  { key: "treatment", label: "Treatment", color: "bg-emerald-50 text-emerald-700" },
  { key: "figma", label: "Figma", color: "bg-amber-50 text-amber-700" },
  { key: "other", label: "Other", color: "bg-gray-100 text-gray-700" },
];

export const DELIVERABLE_TYPES: { key: string; label: string; color: string }[] = [
  { key: "photo", label: "Photo", color: "bg-blue-50 text-blue-700" },
  { key: "video", label: "Video", color: "bg-purple-50 text-purple-700" },
  { key: "reel", label: "Reel", color: "bg-pink-50 text-pink-700" },
  { key: "bts", label: "BTS", color: "bg-amber-50 text-amber-700" },
  { key: "other", label: "Other", color: "bg-gray-100 text-gray-700" },
];

export function gbp(n: number | null | undefined): string {
  const v = n ?? 0;
  return v.toLocaleString("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  });
}

export function getClientName(p: { clientName: string | null; campaign: { client: { name: string } } | null }): string {
  return p.clientName || p.campaign?.client?.name || "";
}
