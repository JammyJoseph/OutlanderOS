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

export interface Deadline {
  id: string;
  title: string;
  description: string | null;
  dueDate: string;
  startDate: string | null;
  source: string;
  sourceRef: string | null;
  sourceUrl: string | null;
  type: string;
  status: string;
  priority: string;
  category: string | null;
  assignedTo: string | null;
  emailFrom: string | null;
  emailSnippet: string | null;
  completedAt: string | null;
  createdAt: string;
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

export interface Shoot {
  id: string;
  title: string;
  date: string;
}

export interface Counts {
  overdue: number;
  today: number;
  week: number;
  inProgress: number;
}

export interface Holiday {
  allowance: number;
  used: number;
  remaining: number;
}

export interface TrelloDeal {
  id: string;
  title: string;
  client: string;
  status: string;
  value: number | null;
}

export interface DashboardData {
  user: DashUser;
  tasks: Task[];
  deadlines: Deadline[];
  culturalEvents: CulturalEvent[];
  shoots: Shoot[];
  counts: Counts;
  holiday: Holiday;
  trelloDeals: TrelloDeal[];
}

export interface Suggestion {
  title: string;
  detail: string;
}

// Normalised source for filtering — tasks and deadlines mapped onto one set.
export type ItemSource = "MANUAL" | "EMAIL" | "TRELLO" | "PRODUCTION" | "PRINT";

export const SOURCE_LABELS: Record<ItemSource, string> = {
  MANUAL: "Manual",
  EMAIL: "Email",
  TRELLO: "Trello",
  PRODUCTION: "Production",
  PRINT: "Print",
};

// Unified item — a task or deadline normalised onto one shape.
export interface UnifiedItem {
  id: string;
  kind: "task" | "deadline";
  title: string;
  dueDate: string | null;
  startDate: string | null;
  priority: string;
  status: string;
  done: boolean;
  category: TaskCategory;
  source: ItemSource;
  link: string | null;
  emailSnippet: string | null;
  emailFrom: string | null;
  createdAt: string | null;
  type: string | null;
}

export type TaskCategory = "brand" | "editorial" | "production" | "admin";

export const CATEGORY_LABELS: Record<TaskCategory, string> = {
  brand: "Brand Partnerships",
  editorial: "Editorial",
  production: "Production",
  admin: "General Admin",
};
