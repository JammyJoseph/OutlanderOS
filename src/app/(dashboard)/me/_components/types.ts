// Shared types for the /me dashboard.

export interface DashUser {
  id: string;
  name: string;
  email: string;
  role: string;
  holidayAllowance?: number;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: string;
  priority: string;
  portal: string | null;
  link: string | null;
  assignedToId: string;
  createdAt: string;
}

export interface Shoot {
  id: string;
  title: string;
  date: string;
}

export interface CulturalEvent {
  id: string;
  title: string;
  date: string;
  endDate: string | null;
  category: string;
  location: string | null;
  importance: number;
}

export interface UpcomingItem {
  id: string;
  title: string;
  date: string;
  portal: "commercial" | "production" | "print" | "personal";
  kind: "shoot" | "deal" | "print" | "task";
  href: string;
  context?: string; // cross-portal hint, e.g. the deal a shoot belongs to
}

export interface Holiday {
  allowance: number;
  used: number;
  remaining: number;
  nextHoliday: { startDate: string; endDate: string } | null;
}

export interface QuickLinkCounts {
  deals: number;
  productions: number;
  financeProjects: number;
  printIssues: number;
}

export interface DashboardData {
  user: DashUser;
  tasks: Task[];
  upcoming: UpcomingItem[];
  shoots: Shoot[];
  culturalEvents: CulturalEvent[];
  holiday: Holiday;
  counts: QuickLinkCounts;
}

export interface PulseData {
  pipelineValue: number;
  activeDealCount: number;
  xeroConnected: boolean;
  outstandingReceivables: number;
  receivableCount: number;
  bankBalance: number;
  bankAccountName: string;
  payroll: { date: string; daysUntil: number };
}

export interface TrendSignal {
  id: string;
  title: string;
  source: string;
  sourceUrl: string | null;
  category: string;
  summary: string | null;
  createdAt: string;
}

// Task tab categories map onto the Task.portal field.
export const TASK_TABS = ["all", "commercial", "production", "print", "general"] as const;
export type TaskTab = (typeof TASK_TABS)[number];

export const TASK_TAB_LABELS: Record<TaskTab, string> = {
  all: "All",
  commercial: "Commercial",
  production: "Production",
  print: "Print",
  general: "General",
};

export function taskTabFor(portal: string | null): Exclude<TaskTab, "all"> {
  if (portal === "commercial" || portal === "production" || portal === "print") return portal;
  return "general";
}

// Portal accent colours — Commercial gold, Production red, Finance blue, Print green.
export const PORTAL_COLORS: Record<string, { accent: string; bg: string; text: string }> = {
  commercial: { accent: "#D4A853", bg: "#D4A8531A", text: "#9a7322" },
  production: { accent: "#DC4B4B", bg: "#DC4B4B1A", text: "#a83232" },
  finance: { accent: "#3B82F6", bg: "#3B82F61A", text: "#1d4ed8" },
  print: { accent: "#22A06B", bg: "#22A06B1A", text: "#15803d" },
  personal: { accent: "#6B7280", bg: "#6B72801A", text: "#4b5563" },
};

export function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

export function formatGBP(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}
