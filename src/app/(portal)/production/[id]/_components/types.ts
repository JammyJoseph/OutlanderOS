import { money } from "@/lib/money";
import {
  parseFlexibleDate,
  parseFlexibleDateRange,
  extractDatePhrase,
  eachDayInRange,
  type FlexibleDateRange,
} from "@/lib/flexible-date";

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
  shootTitle?: string | null;
  notes: string | null;
  status: CallSheetStatus;
  location?: { address?: string } | null;
  shotlist?: { status?: string }[] | null;
  shareToken?: string | null;
}

// Display title for a call sheet: dedicated column first, then the legacy
// notes JSON, then a date-based fallback.
export function callSheetTitle(
  cs: Pick<CallSheet, "shootTitle" | "notes">,
  fallback: string
): string {
  if (cs.shootTitle) return cs.shootTitle;
  if (cs.notes) {
    try {
      const parsed = JSON.parse(cs.notes);
      if (parsed?.shootTitle) return parsed.shootTitle;
    } catch {}
  }
  return fallback;
}

export interface CrewMember {
  id: string;
  role: string;
  contact: { id: string; name: string; email?: string | null; phone?: string | null };
}

export type InvoiceStatus =
  | "NOT_INVOICED"
  | "INVOICE_RECEIVED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "PAID";

export interface BudgetLineItem {
  id: string;
  productionId: string;
  category: string;
  section: string | null;
  role: string | null;
  quantity: number | null;
  rate: number | null;
  vatPercent: number | null;
  description: string;
  budgeted: number;
  actual: number;
  notes: string | null;
  invoiceStatus?: InvoiceStatus | null;
  invoiceUrl?: string | null;
  poNumber?: string | null;
  invoicedAmount?: number | null;
  sortOrder: number;
}

// Semantic palette: monochrome = nothing to do yet, amber = invoice in flight
// (received / being reviewed), green = cleared (approved / paid). `dot` is the
// swatch shown in the status dropdown menu.
export const INVOICE_STATUSES: { key: InvoiceStatus; label: string; bg: string; text: string; dot: string }[] = [
  { key: "NOT_INVOICED", label: "Not invoiced", bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-500 dark:text-gray-400", dot: "bg-gray-400" },
  { key: "INVOICE_RECEIVED", label: "Received", bg: "bg-amber-50 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-300", dot: "bg-amber-400" },
  { key: "UNDER_REVIEW", label: "Under review", bg: "bg-amber-100 dark:bg-amber-900/40", text: "text-amber-800 dark:text-amber-200", dot: "bg-amber-500" },
  { key: "APPROVED", label: "Approved", bg: "bg-emerald-50 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-400" },
  { key: "PAID", label: "Paid", bg: "bg-emerald-100 dark:bg-emerald-900/40", text: "text-emerald-800 dark:text-emerald-200", dot: "bg-emerald-500" },
];

export function invoiceStatusMeta(s: InvoiceStatus | null | undefined) {
  return INVOICE_STATUSES.find((x) => x.key === s) ?? INVOICE_STATUSES[0];
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
  dietaryRequirements?: string | null;
  contactId?: string | null;
}

export type ApprovalStatus = "PENDING" | "APPROVED" | "DENIED";

export interface CreativeAsset {
  id: string;
  productionId: string;
  type: string;
  title: string;
  url: string | null;
  description: string | null;
  sortOrder: number;
  // Image approval workflow (Phase 5).
  approvalStatus?: ApprovalStatus | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  // Google Drive integration (Phase 6).
  driveFileId?: string | null;
  driveThumbnail?: string | null;
  uploadedByName?: string | null;
  mimeType?: string | null;
  createdAt?: string | null;
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
  // Delivery format spec (Phase 4B).
  resolution?: string | null;
  aspectRatio?: string | null;
  fileFormat?: string | null;
  colourSpace?: string | null;
  // Shot numbers (from call-sheet shot lists) this deliverable is produced from.
  linkedShots?: string[];
}

// Delivery-format option lists (Phase 4B).
export const RESOLUTION_OPTIONS = ["4K", "1080p", "720p", "Full-res", "custom"];
export const ASPECT_RATIO_OPTIONS = ["16:9", "4:5", "1:1", "9:16", "custom"];
export const FILE_FORMAT_OPTIONS = ["MOV", "MP4", "JPEG", "TIFF", "PSD", "PNG", "ProRes", "custom"];
export const COLOUR_SPACE_OPTIONS = ["sRGB", "AdobeRGB", "P3", "Rec709"];

export interface DeliveryFormat {
  resolution: string;
  aspectRatio: string;
  fileFormat: string;
  colourSpace: string;
}

// Sensible format defaults per deliverable type/title keyword (Phase 4B).
export function defaultFormatFor(type: string, title = ""): DeliveryFormat {
  const t = `${type} ${title}`.toLowerCase();
  if (/hero|still.*hero|hero.*still/.test(t) || (/(photo|still)/.test(t) && /hero/.test(t))) {
    return { resolution: "Full-res", aspectRatio: "16:9", fileFormat: "TIFF", colourSpace: "AdobeRGB" };
  }
  if (/reel|social.*video|9:16|story|stories|tiktok/.test(t)) {
    return { resolution: "1080p", aspectRatio: "9:16", fileFormat: "MP4", colourSpace: "sRGB" };
  }
  if (/video|film|edit|motion|bts/.test(t)) {
    return { resolution: "1080p", aspectRatio: "4:5", fileFormat: "MP4", colourSpace: "sRGB" };
  }
  if (/web|jpeg|jpg|social|image|photo|still/.test(t)) {
    return { resolution: "1080p", aspectRatio: "4:5", fileFormat: "JPEG", colourSpace: "sRGB" };
  }
  return { resolution: "", aspectRatio: "", fileFormat: "", colourSpace: "" };
}

// ── Campaign Timeline ──
export type MilestonePhase = "PRE_PRODUCTION" | "PRODUCTION" | "POST_PRODUCTION";
export type MilestoneStatus = "PENDING" | "DONE" | "OVERDUE";

export interface ProductionMilestone {
  id: string;
  productionId: string;
  phase: MilestonePhase;
  date: string;
  title: string;
  description: string | null;
  done: boolean;
  sortOrder: number;
  // Renders as a diamond/flag (key event) rather than a task circle.
  isMilestone?: boolean;
  // Set on rows seeded from a standard production template.
  templateKey?: string | null;
  // Parent milestone id when this row is a sub-task.
  parentId?: string | null;
  // User id of the assigned team member (optional).
  assignedTo?: string | null;
}

export const MILESTONE_PHASES: { key: MilestonePhase; label: string }[] = [
  { key: "PRE_PRODUCTION", label: "Pre-Production" },
  { key: "PRODUCTION", label: "Production" },
  { key: "POST_PRODUCTION", label: "Post-Production" },
];

export const MILESTONE_PHASE_STYLES: Record<
  MilestonePhase,
  { label: string; dot: string; chip: string; bar: string }
> = {
  PRE_PRODUCTION: {
    label: "Pre-Production",
    dot: "bg-blue-400",
    chip: "bg-blue-50 text-blue-700",
    bar: "bg-blue-400",
  },
  PRODUCTION: {
    label: "Production",
    dot: "bg-[#9C7C2E]",
    chip: "bg-amber-50 text-amber-700",
    bar: "bg-[#9C7C2E]",
  },
  POST_PRODUCTION: {
    label: "Post-Production",
    dot: "bg-indigo-400",
    chip: "bg-indigo-50 text-indigo-700",
    bar: "bg-indigo-400",
  },
};

// Derive a milestone's status from its date + done flag (compared date-only,
// ignoring time-of-day). DONE wins; otherwise a past date is OVERDUE.
export function milestoneStatus(m: {
  date: string;
  done: boolean;
}): MilestoneStatus {
  if (m.done) return "DONE";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(m.date);
  d.setHours(0, 0, 0, 0);
  return d.getTime() < today.getTime() ? "OVERDUE" : "PENDING";
}

// Parse a "WED 1 JUL" / "15/07/2026" / "next Friday" style date into an ISO
// datetime. Delegates to the shared flexible parser — see lib/flexible-date.
export function parseMilestoneDate(raw: string, referenceDate?: Date): string | null {
  const d = parseFlexibleDate(raw, referenceDate);
  return d ? d.toISOString() : null;
}

const PHASE_ALIASES: { re: RegExp; phase: MilestonePhase }[] = [
  { re: /^\s*pre[\s-]*production/i, phase: "PRE_PRODUCTION" },
  { re: /^\s*post[\s-]*production/i, phase: "POST_PRODUCTION" },
  { re: /^\s*production/i, phase: "PRODUCTION" },
];

export interface ParsedMilestone {
  phase: MilestonePhase;
  date: string; // ISO
  title: string;
  description: string;
}

// Parse a pasted timeline. One milestone per line, fields separated by an
// em-dash or a spaced en-dash/hyphen (unspaced "20-22" survives as a range):
//   PRE-PRODUCTION — WED 1 JUL — PUMA FEEDBACK ON V1 DECK — Description
// The date can sit in any field ("Shoot day - 20th July") or be embedded in
// running text ("Pre-pro meeting on the 3rd of August"). Ranges ("July 20-22")
// produce one entry per day. Phase and description are optional; a phase line
// carries down. Lines with no recognisable date are skipped.
export function parseMilestones(raw: string, referenceDate?: Date): ParsedMilestone[] {
  const text = (raw || "").replace(/\r\n/g, "\n");
  if (!text.trim()) return [];
  const ref = referenceDate ?? new Date();
  const out: ParsedMilestone[] = [];
  let phase: MilestonePhase = "PRE_PRODUCTION";

  const push = (
    date: Date | null,
    range: FlexibleDateRange | null,
    title: string,
    description: string
  ) => {
    if (range) {
      const days = eachDayInRange(range);
      days.forEach((d, i) =>
        out.push({
          phase,
          date: d.toISOString(),
          title: days.length > 1 ? `${title} (Day ${i + 1})` : title,
          description,
        })
      );
    } else if (date) {
      out.push({ phase, date: date.toISOString(), title, description });
    }
  };

  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    // Split on em-dash, or spaced en-dash/hyphen. Unspaced en-dashes and
    // hyphens are kept so "July 20-22" / "20–22 July" stay intact as ranges.
    const parts = line
      .split(/\s*—\s*|\s+[–-]\s+/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 0) continue;

    // Does the first part name a phase? Only when it holds no parseable date,
    // so "PRODUCTION — TUE 7 JUL — SHOOT DAY" reads phase then date.
    let idx = 0;
    const first = parts[0];
    const aliased = PHASE_ALIASES.find((a) => a.re.test(first));
    if (aliased && !parseFlexibleDate(first, ref)) {
      phase = aliased.phase;
      idx = 1;
    }
    const rest = parts.slice(idx);
    if (rest.length === 0) continue; // phase-only line

    // Find the field that reads as a date or a range — it can be anywhere.
    let dateIdx = -1;
    let range: FlexibleDateRange | null = null;
    let single: Date | null = null;
    for (let i = 0; i < rest.length; i++) {
      range = parseFlexibleDateRange(rest[i], ref);
      if (range) {
        dateIdx = i;
        break;
      }
      single = parseFlexibleDate(rest[i], ref);
      if (single) {
        dateIdx = i;
        break;
      }
    }

    if (dateIdx >= 0) {
      const others = rest.filter((_, i) => i !== dateIdx);
      // The date field often carries a label too ("Shoot day on 20th July" as
      // one field) — recover it as the title when no other field provides one.
      const inField = extractDatePhrase(rest[dateIdx]);
      const title = others[0] || inField?.remainder || "Milestone";
      const description = others.slice(1).join(" — ");
      push(single, range, title, description);
      continue;
    }

    // No standalone date field — look for a date phrase inside the whole line
    // ("Pre-production meeting on the 3rd of August").
    const flat = rest.join(" — ");
    const embedded = extractDatePhrase(flat);
    if (!embedded) continue;
    const r = parseFlexibleDateRange(embedded.phrase, ref);
    const d = r ? null : parseFlexibleDate(embedded.phrase, ref);
    push(d, r, embedded.remainder || "Milestone", "");
  }
  return out;
}

// Commercial-side deliverable (contracted + additional/scope-creep) surfaced
// read-only in the Production deliverables view.
export interface CampaignDeliverable {
  id: string;
  title: string | null;
  type: string;
  quantity: number;
  description: string | null;
  dueDate: string | null;
  status: string; // PENDING | IN_PROGRESS | DELIVERED
  isAdditional: boolean;
  overageCost: number | null;
}

export type ProductionBudgetStatus = "BUDGETING" | "LOCKED" | "IN_PROGRESS" | "FINAL";

export interface CateringQuote {
  contactId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  status: "contacted" | "quoted" | "confirmed" | "declined";
  notes: string | null;
  quoteAmount?: number | null;
  contactedAt: string | null;
}

export interface ProductionBriefData {
  clientName?: string | null;
  budget?: number | null;
  deliverables?: { title: string; type: string; quantity?: number }[];
  timeline?: string | null;
  creativeDirection?: string | null;
  targetAudience?: string | null;
  generatedAt?: string | null;
  dealId?: string | null;
}

export interface ProductionFull {
  id: string;
  title: string;
  type: string; // "EDITORIAL" | "COMMERCIAL"
  billingType?: string; // "EDITORIAL" | "PAID"
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
  budgetMarkupPercent: number | null;
  budgetVatPercent: number | null;
  editorialRateDiscount?: number | null;
  cateringQuotes?: CateringQuote[];
  briefData?: ProductionBriefData | null;
  productionBudgetStatus: ProductionBudgetStatus | null;
  productionLockedAt: string | null;
  archived?: boolean;
  archivedAt?: string | null;
  shootDates: string[];
  campaign: {
    id?: string;
    title: string;
    client: { name: string };
    value?: number | null;
    marginPercent?: number | null;
    marginAmount?: number | null;
    budgetLocked?: boolean;
    creativeStatus?: string | null;
    creativeResponse?: { figmaUrl?: string | null; treatment?: string | null } | null;
    clientBrief?: { content?: string | null } | null;
    briefContent?: string | null;
    deliverables?: CampaignDeliverable[];
  } | null;
  callSheets: CallSheet[];
  crew: CrewMember[];
  budgetItems: BudgetLineItem[];
  productionTasks: ProductionTask[];
  teamMembers: TeamMember[];
  creativeAssets: CreativeAsset[];
  scheduleBlocks: ScheduleBlock[];
  prodDeliverables: ProductionDeliverable[];
  milestones: ProductionMilestone[];
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
  SHOOTING: { bg: "bg-amber-100", text: "text-amber-700", dot: "bg-[#9C7C2E]", label: "Shooting" },
  POST_PRODUCTION: {
    bg: "bg-orange-100",
    text: "text-orange-700",
    dot: "bg-orange-400",
    label: "Post-Production",
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

// ── Industry-standard production budget sections ──
// Each section groups line items; `template` lists the common roles seeded
// when a budget is first set up; `costCategory` maps to the Finance CostEntry
// category so production actuals land in the right Finance bucket. Sections
// render monochrome — no per-section accent colour (Paper Standard).
export interface BudgetSectionDef {
  key: string;
  label: string;
  costCategory: string;
  template: string[]; // default role/item names seeded by the template
}

export const BUDGET_SECTIONS: BudgetSectionDef[] = [
  {
    key: "PRE_PRODUCTION",
    label: "Pre-Production",
    costCategory: "production",
    template: [
      "Producer",
      "Production Manager",
      "Production Assistant",
      "Director",
      "Script Supervisor",
      "Recce",
      "Insurance",
      "Contingency",
    ],
  },
  {
    key: "CAST_TALENT",
    label: "Cast / Talent",
    costCategory: "talent",
    template: ["Lead Talent", "Supporting Talent", "Extras / Background"],
  },
  {
    key: "CREW",
    label: "Crew",
    costCategory: "production",
    template: [
      "1st Assistant Director",
      "2nd Assistant Director",
      "3rd Assistant Director",
      "Floor Runner",
      "Production Runner",
      "Director of Photography",
      "Camera Operator",
      "Focus Puller (1st AC)",
      "Clapper Loader",
      "DIT",
      "Video Operator",
      "Gaffer",
      "Lighting Technician",
      "Key Grip",
      "Grip",
      "Rigger",
      "Sound Mixer",
      "Boom Operator",
      "Sound Maintenance",
      "Sound Assistant",
      "SFX Supervisor",
      "SFX Technician",
    ],
  },
  {
    key: "STYLING_GLAM",
    label: "Styling / Glam",
    costCategory: "production",
    template: [
      "Stylist",
      "Costume Designer",
      "Wardrobe Buyer",
      "Wardrobe",
      "Chief Make Up Artist",
      "Make Up",
      "Chief Hair Designer",
      "Hairdresser",
    ],
  },
  {
    key: "LOCATIONS",
    label: "Locations",
    costCategory: "location",
    template: ["Location Manager", "Location Fee", "Green Room / Base"],
  },
  {
    key: "EQUIPMENT",
    label: "Equipment",
    costCategory: "equipment",
    template: ["Lighting Kit", "Camera Kit", "Grip Kit"],
  },
  {
    key: "TRANSPORT",
    label: "Transport",
    costCategory: "travel",
    template: ["Driver", "Production Van", "Taxi / Mileage"],
  },
  {
    key: "CATERING",
    label: "Catering",
    costCategory: "catering",
    template: ["Crew Catering"],
  },
  {
    key: "ART_DEPARTMENT",
    label: "Art Department",
    costCategory: "production",
    template: [
      "Art Director",
      "Asst. Art Director",
      "Set Designer",
      "Digi Tech / DIT",
      "Props Buyer",
      "Master Props",
      "Props",
      "Props Assistant",
      "Construction Manager",
      "Carpenter",
      "Scenic Artist",
      "Home Economist",
    ],
  },
  {
    key: "POST_PRODUCTION",
    label: "Post-Production",
    costCategory: "production",
    template: ["Editor", "Colourist", "Retouching"],
  },
];

// Map a legacy `category` value (pre-sections data + deal-imported splits) onto
// the new section keys so existing line items still land in a sensible section.
export const LEGACY_CATEGORY_TO_SECTION: Record<string, string> = {
  production_company: "CREW",
  styling: "STYLING_GLAM",
  glam_mua: "STYLING_GLAM",
  talent: "CAST_TALENT",
  location: "LOCATIONS",
  catering: "CATERING",
  equipment: "EQUIPMENT",
  travel: "TRANSPORT",
  contingency: "PRE_PRODUCTION",
  internal: "PRE_PRODUCTION",
  other: "ART_DEPARTMENT",
};

// The section a line item belongs to: explicit `section`, else mapped from the
// legacy category, else a catch-all.
export function sectionOf(item: { section: string | null; category: string }): string {
  if (item.section) return item.section;
  return LEGACY_CATEGORY_TO_SECTION[item.category] ?? "ART_DEPARTMENT";
}

// Total for a line: quantity × rate when both are set, otherwise the manual
// budgeted figure. Rounded to 2dp — see `money`.
export function lineTotal(item: {
  quantity: number | null;
  rate: number | null;
  budgeted: number;
}): number {
  if (item.quantity != null && item.rate != null) return money(item.quantity * item.rate);
  return money(item.budgeted || 0);
}

// Default per-line VAT rate when none is set on the item.
export const DEFAULT_LINE_VAT = 20;

// Effective VAT rate for a line — its own value, else the 20% default.
export function lineVatPercent(item: { vatPercent: number | null }): number {
  return item.vatPercent != null ? item.vatPercent : DEFAULT_LINE_VAT;
}

// VAT amount on a line: (qty × unit cost) × VAT%.
export function lineVatAmount(item: {
  quantity: number | null;
  rate: number | null;
  vatPercent: number | null;
  budgeted: number;
}): number {
  return money(lineTotal(item) * (lineVatPercent(item) / 100));
}

// Line total including VAT: (qty × unit cost) + VAT amount.
export function lineTotalIncVat(item: {
  quantity: number | null;
  rate: number | null;
  vatPercent: number | null;
  budgeted: number;
}): number {
  return money(lineTotal(item) + lineVatAmount(item));
}

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

// Penny-precise variant for the budget table — headline figures stay whole-£.
export function gbp2(n: number | null | undefined): string {
  const v = n ?? 0;
  return v.toLocaleString("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function getClientName(p: { clientName: string | null; campaign: { client: { name: string } } | null }): string {
  return p.clientName || p.campaign?.client?.name || "";
}
