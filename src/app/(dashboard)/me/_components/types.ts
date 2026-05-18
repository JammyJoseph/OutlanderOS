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
}

export interface DashboardData {
  user: DashUser;
  tasks: Task[];
  deadlines: Deadline[];
  culturalEvents: CulturalEvent[];
  shoots: Shoot[];
  counts: Counts;
}

export interface Suggestion {
  title: string;
  detail: string;
}

// Unified item — a task or deadline normalised onto one shape.
export interface UnifiedItem {
  id: string;
  kind: "task" | "deadline";
  title: string;
  dueDate: string | null;
  priority: string;
  done: boolean;
  category: TaskCategory;
  source: string;
  link: string | null;
}

export type TaskCategory = "brand" | "editorial" | "production" | "admin" | "longterm";
