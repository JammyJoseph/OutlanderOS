"use client";

import { useState } from "react";
import {
  Plus,
  LayoutGrid,
  List,
  Sparkles,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Priority = "URGENT" | "HIGH" | "MEDIUM" | "LOW";
type Status = "TODO" | "IN_PROGRESS" | "DONE";

type Task = {
  id: number;
  title: string;
  description: string;
  priority: Priority;
  status: Status;
  assignee: string;
  assigneeInitials: string;
  assigneeColor: string;
  due: string;
  project: string;
  subtasksDone: number;
  subtasksTotal: number;
  overdue: boolean;
};

const allTasks: Task[] = [
  // Joe
  {
    id: 1,
    title: "Review Q1 campaign margins",
    description: "Analyse P&L across all Q1 brand campaigns and flag any underperforming partnerships.",
    priority: "HIGH",
    status: "TODO",
    assignee: "Joe",
    assigneeInitials: "JS",
    assigneeColor: "bg-[#D4A853]",
    due: "Apr 4",
    project: "Finance",
    subtasksDone: 1,
    subtasksTotal: 4,
    overdue: false,
  },
  {
    id: 2,
    title: "Follow up Nike Q2 renewal",
    description: "Chase Tom Bradley at Nike UK for signed IO. Partnership worth £45k.",
    priority: "URGENT",
    status: "IN_PROGRESS",
    assignee: "Joe",
    assigneeInitials: "JS",
    assigneeColor: "bg-[#D4A853]",
    due: "Apr 3",
    project: "Q2 Campaigns",
    subtasksDone: 0,
    subtasksTotal: 2,
    overdue: true,
  },
  {
    id: 3,
    title: "Prepare April payroll",
    description: "Calculate payroll for all 5 team members including PAYE and pension contributions.",
    priority: "URGENT",
    status: "TODO",
    assignee: "Joe",
    assigneeInitials: "JS",
    assigneeColor: "bg-[#D4A853]",
    due: "Apr 25",
    project: "Operations",
    subtasksDone: 0,
    subtasksTotal: 3,
    overdue: false,
  },
  // Shreeya
  {
    id: 4,
    title: "Send IO to New Balance",
    description: "Draft and send the insertion order for the New Balance Q2 campaign. Value: £18,000.",
    priority: "HIGH",
    status: "TODO",
    assignee: "Shreeya",
    assigneeInitials: "SP",
    assigneeColor: "bg-emerald-500",
    due: "Apr 5",
    project: "Q2 Campaigns",
    subtasksDone: 2,
    subtasksTotal: 3,
    overdue: false,
  },
  {
    id: 5,
    title: "Follow up Adidas Q2 pitch",
    description: "Send deck and pricing for Q2 Adidas renewal. Last touched March 20th.",
    priority: "HIGH",
    status: "IN_PROGRESS",
    assignee: "Shreeya",
    assigneeInitials: "SP",
    assigneeColor: "bg-emerald-500",
    due: "Apr 7",
    project: "Q2 Campaigns",
    subtasksDone: 1,
    subtasksTotal: 2,
    overdue: false,
  },
  {
    id: 6,
    title: "Update CRM with new leads",
    description: "Log 12 new brand leads from LFW into HubSpot with contact info and deal stage.",
    priority: "MEDIUM",
    status: "DONE",
    assignee: "Shreeya",
    assigneeInitials: "SP",
    assigneeColor: "bg-emerald-500",
    due: "Mar 31",
    project: "Operations",
    subtasksDone: 3,
    subtasksTotal: 3,
    overdue: false,
  },
  // Callum
  {
    id: 7,
    title: "Post BAPE campaign content",
    description: "Schedule and post all 6 BAPE campaign assets across Instagram grid and stories.",
    priority: "URGENT",
    status: "IN_PROGRESS",
    assignee: "Callum",
    assigneeInitials: "CR",
    assigneeColor: "bg-purple-500",
    due: "Apr 2",
    project: "Q2 Campaigns",
    subtasksDone: 4,
    subtasksTotal: 6,
    overdue: true,
  },
  {
    id: 8,
    title: "Create stories for Palace shoot BTS",
    description: "Edit and post behind-the-scenes content from the Palace x Adidas shoot.",
    priority: "MEDIUM",
    status: "TODO",
    assignee: "Callum",
    assigneeInitials: "CR",
    assigneeColor: "bg-purple-500",
    due: "Apr 6",
    project: "Issue 02",
    subtasksDone: 0,
    subtasksTotal: 4,
    overdue: false,
  },
  {
    id: 9,
    title: "Review analytics for March content",
    description: "Pull Instagram and web analytics for March. Prepare monthly report for Quinn.",
    priority: "MEDIUM",
    status: "DONE",
    assignee: "Callum",
    assigneeInitials: "CR",
    assigneeColor: "bg-purple-500",
    due: "Apr 1",
    project: "Operations",
    subtasksDone: 5,
    subtasksTotal: 5,
    overdue: false,
  },
  // Patricia
  {
    id: 10,
    title: "Book studio for Nike shoot",
    description: "Source and confirm studio for Nike Q2 shoot. Budget: £1,800/day. Date: May 12.",
    priority: "HIGH",
    status: "TODO",
    assignee: "Patricia",
    assigneeInitials: "PC",
    assigneeColor: "bg-pink-500",
    due: "Apr 8",
    project: "Q2 Campaigns",
    subtasksDone: 1,
    subtasksTotal: 3,
    overdue: false,
  },
  {
    id: 11,
    title: "Confirm crew for Carhartt production",
    description: "Lock in photographer, stylist, hair & makeup for Carhartt shoot on 18 April.",
    priority: "URGENT",
    status: "IN_PROGRESS",
    assignee: "Patricia",
    assigneeInitials: "PC",
    assigneeColor: "bg-pink-500",
    due: "Apr 4",
    project: "Q2 Campaigns",
    subtasksDone: 2,
    subtasksTotal: 5,
    overdue: false,
  },
  {
    id: 12,
    title: "Send call sheets for May shoots",
    description: "Prepare and distribute call sheets for all confirmed May production days.",
    priority: "MEDIUM",
    status: "TODO",
    assignee: "Patricia",
    assigneeInitials: "PC",
    assigneeColor: "bg-pink-500",
    due: "Apr 15",
    project: "Issue 02",
    subtasksDone: 0,
    subtasksTotal: 3,
    overdue: false,
  },
  // Quinn
  {
    id: 13,
    title: "Approve Q2 budget",
    description: "Review and sign off on Q2 budget across all departments before April 7th.",
    priority: "URGENT",
    status: "TODO",
    assignee: "Quinn",
    assigneeInitials: "QT",
    assigneeColor: "bg-blue-500",
    due: "Apr 7",
    project: "Finance",
    subtasksDone: 0,
    subtasksTotal: 2,
    overdue: false,
  },
  {
    id: 14,
    title: "Review partnership proposals",
    description: "Review 4 new brand partnership proposals from Shreeya and provide feedback.",
    priority: "HIGH",
    status: "IN_PROGRESS",
    assignee: "Quinn",
    assigneeInitials: "QT",
    assigneeColor: "bg-blue-500",
    due: "Apr 5",
    project: "Q2 Campaigns",
    subtasksDone: 2,
    subtasksTotal: 4,
    overdue: false,
  },
  {
    id: 15,
    title: "Sign off on Issue 02 content",
    description: "Final sign-off on all editorial content for Issue 02 before send-to-print.",
    priority: "HIGH",
    status: "DONE",
    assignee: "Quinn",
    assigneeInitials: "QT",
    assigneeColor: "bg-blue-500",
    due: "Mar 31",
    project: "Issue 02",
    subtasksDone: 8,
    subtasksTotal: 8,
    overdue: false,
  },
];

const suggestedTasks = [
  {
    id: "s1",
    title: "Follow up with New Balance on invoice #OL-NB-2026-012",
    reason: "Invoice 30 days overdue — £4,200 outstanding",
    icon: "💰",
    priority: "URGENT" as Priority,
  },
  {
    id: "s2",
    title: "Prepare VAT return before 7 April 2026",
    reason: "HMRC reminder received 6 days ago — deadline approaching",
    icon: "📋",
    priority: "URGENT" as Priority,
  },
  {
    id: "s3",
    title: "Confirm crew for Hackney Wick shoot (4–5 April)",
    reason: "Studio booked — crew not yet confirmed in system",
    icon: "📸",
    priority: "HIGH" as Priority,
  },
  {
    id: "s4",
    title: "Respond to Nike UK partnership inquiry",
    reason: "Brand email from Tom Bradley unanswered for 72 hours",
    icon: "✉️",
    priority: "HIGH" as Priority,
  },
];

const TEAM = ["Joe", "Quinn", "Shreeya", "Callum", "Patricia"];
const PROJECTS = ["Q2 Campaigns", "Issue 02", "Finance", "Operations"];

const priorityStyles: Record<Priority, string> = {
  URGENT: "bg-red-500/20 text-red-400",
  HIGH: "bg-amber-500/20 text-amber-400",
  MEDIUM: "bg-blue-500/20 text-blue-400",
  LOW: "bg-neutral-500/20 text-neutral-400",
};

const STATUS_GROUPS: Status[] = ["TODO", "IN_PROGRESS", "DONE"];
const STATUS_LABELS: Record<Status, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  DONE: "Done",
};
const STATUS_COLORS: Record<Status, string> = {
  TODO: "border-t-neutral-600",
  IN_PROGRESS: "border-t-blue-500",
  DONE: "border-t-emerald-500",
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>(allTasks);
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [assigneeFilter, setAssigneeFilter] = useState<"all" | string>("all");
  const [taskScope, setTaskScope] = useState<"my" | "all">("all");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);

  // New task form state
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "MEDIUM" as Priority,
    due: "",
    assignee: "Joe",
    project: "Operations",
  });

  const filtered = tasks.filter((t) => {
    if (taskScope === "my" && t.assignee !== "Joe") return false;
    if (assigneeFilter !== "all" && t.assignee !== assigneeFilter) return false;
    return true;
  });

  const toggleDone = (id: number) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, status: t.status === "DONE" ? "TODO" : "DONE" }
          : t
      )
    );
  };

  const addTask = () => {
    if (!newTask.title.trim()) return;
    const task: Task = {
      id: Date.now(),
      title: newTask.title,
      description: newTask.description,
      priority: newTask.priority,
      status: "TODO",
      assignee: newTask.assignee,
      assigneeInitials: newTask.assignee.slice(0, 2).toUpperCase(),
      assigneeColor: "bg-neutral-600",
      due: newTask.due || "TBD",
      project: newTask.project,
      subtasksDone: 0,
      subtasksTotal: 0,
      overdue: false,
    };
    setTasks((prev) => [task, ...prev]);
    setNewTask({ title: "", description: "", priority: "MEDIUM", due: "", assignee: "Joe", project: "Operations" });
    setIsAddOpen(false);
  };

  const overdueCount = tasks.filter((t) => t.overdue && t.status !== "DONE").length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-neutral-100">Tasks</h1>
          {overdueCount > 0 && (
            <Badge className="gap-1 bg-red-500/20 text-red-400">
              <AlertTriangle className="h-3 w-3" />
              {overdueCount} overdue
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* My Tasks / All Tasks */}
          <div className="flex overflow-hidden rounded-md border border-neutral-800">
            {(["my", "all"] as const).map((scope) => (
              <button
                key={scope}
                onClick={() => setTaskScope(scope)}
                className={cn(
                  "px-3 py-1.5 text-xs transition-colors",
                  taskScope === scope
                    ? "bg-neutral-800 text-white"
                    : "text-neutral-500 hover:text-neutral-300"
                )}
              >
                {scope === "my" ? "My Tasks" : "All Tasks"}
              </button>
            ))}
          </div>

          {/* Assignee filter */}
          <div className="flex overflow-hidden rounded-md border border-neutral-800">
            {["all", ...TEAM].map((f) => (
              <button
                key={f}
                onClick={() => setAssigneeFilter(f)}
                className={cn(
                  "px-2.5 py-1.5 text-xs transition-colors",
                  assigneeFilter === f
                    ? "bg-neutral-800 text-white"
                    : "text-neutral-500 hover:text-neutral-300"
                )}
              >
                {f === "all" ? "All" : f}
              </button>
            ))}
          </div>

          {/* View toggle */}
          <div className="flex overflow-hidden rounded-md border border-neutral-800">
            <button
              onClick={() => setViewMode("kanban")}
              className={cn(
                "p-1.5 transition-colors",
                viewMode === "kanban" ? "bg-neutral-800 text-white" : "text-neutral-500 hover:text-neutral-300"
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "p-1.5 transition-colors",
                viewMode === "list" ? "bg-neutral-800 text-white" : "text-neutral-500 hover:text-neutral-300"
              )}
            >
              <List className="h-4 w-4" />
            </button>
          </div>

          <Button
            onClick={() => setIsAddOpen(true)}
            size="sm"
            className="bg-[#D4A853] text-black hover:bg-[#c49a47]"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Task
          </Button>
        </div>
      </div>

      {/* AI Suggested Tasks */}
      {showSuggestions && (
        <div className="rounded-lg border border-[#D4A853]/20 bg-[#D4A853]/5 p-3">
          <div className="mb-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-[#D4A853]" />
              <span className="text-xs font-medium text-[#D4A853]">Suggested Tasks</span>
              <span className="text-xs text-neutral-500">— AI-generated based on emails & deadlines</span>
            </div>
            <button
              onClick={() => setShowSuggestions(false)}
              className="text-xs text-neutral-600 hover:text-neutral-400"
            >
              Dismiss
            </button>
          </div>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {suggestedTasks.map((s) => (
              <div
                key={s.id}
                className="flex items-start gap-2.5 rounded-md border border-neutral-800 bg-neutral-900 p-2.5"
              >
                <span className="shrink-0 text-sm">{s.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-neutral-200">{s.title}</p>
                  <p className="mt-0.5 text-[10px] text-neutral-500">{s.reason}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Badge className={cn("text-[10px]", priorityStyles[s.priority])}>
                    {s.priority.toLowerCase()}
                  </Badge>
                  <button className="text-neutral-600 hover:text-neutral-400">
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Kanban View */}
      {viewMode === "kanban" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {STATUS_GROUPS.map((group) => {
            const groupTasks = filtered.filter((t) => t.status === group);
            return (
              <div key={group} className="space-y-2">
                <div
                  className={cn(
                    "rounded-t-md border-t-2 pb-1 pt-2",
                    STATUS_COLORS[group]
                  )}
                >
                  <div className="flex items-center gap-2 px-1">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                      {STATUS_LABELS[group]}
                    </h2>
                    <Badge className="bg-neutral-800 text-[10px] text-neutral-400">
                      {groupTasks.length}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-2">
                  {groupTasks.map((task) => (
                    <TaskCard key={task.id} task={task} onToggle={toggleDone} />
                  ))}
                  {groupTasks.length === 0 && (
                    <div className="rounded-md border border-dashed border-neutral-800 p-4 text-center text-xs text-neutral-700">
                      No tasks
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List View */}
      {viewMode === "list" && (
        <div className="space-y-1">
          {STATUS_GROUPS.map((group) => {
            const groupTasks = filtered.filter((t) => t.status === group);
            if (groupTasks.length === 0) return null;
            return (
              <div key={group} className="space-y-0.5">
                <div className="flex items-center gap-2 py-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                    {STATUS_LABELS[group]}
                  </span>
                  <span className="text-[10px] text-neutral-700">({groupTasks.length})</span>
                </div>
                {groupTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2.5 hover:border-neutral-700"
                  >
                    <button
                      onClick={() => toggleDone(task.id)}
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                        task.status === "DONE"
                          ? "border-[#D4A853] bg-[#D4A853]"
                          : "border-neutral-600 hover:border-neutral-400"
                      )}
                    >
                      {task.status === "DONE" && (
                        <svg viewBox="0 0 12 12" className="h-3 w-3 text-black">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                    <p className={cn("flex-1 text-sm", task.status === "DONE" ? "text-neutral-600 line-through" : "text-neutral-200")}>
                      {task.title}
                    </p>
                    <Badge className={cn("text-[10px]", priorityStyles[task.priority])}>
                      {task.priority.toLowerCase()}
                    </Badge>
                    <span className="text-xs text-neutral-500">{task.project}</span>
                    <div
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold text-white",
                        task.assigneeColor
                      )}
                    >
                      {task.assigneeInitials}
                    </div>
                    <span
                      className={cn(
                        "font-mono text-xs",
                        task.overdue && task.status !== "DONE" ? "text-red-400" : "text-neutral-500"
                      )}
                    >
                      {task.overdue && task.status !== "DONE" ? "⚠ " : ""}{task.due}
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Task Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-lg border-neutral-800 bg-neutral-900">
          <DialogHeader>
            <DialogTitle className="text-neutral-100">Create Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="mb-1 block text-xs text-neutral-400">Title</label>
              <Input
                placeholder="Task title..."
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                className="border-neutral-700 bg-neutral-800 text-sm text-neutral-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral-400">Description</label>
              <textarea
                placeholder="Add details..."
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                className="w-full resize-none rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-neutral-400">Priority</label>
                <select
                  value={newTask.priority}
                  onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as Priority })}
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-200 focus:outline-none"
                >
                  <option value="URGENT">Urgent</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-neutral-400">Due Date</label>
                <Input
                  type="date"
                  value={newTask.due}
                  onChange={(e) => setNewTask({ ...newTask, due: e.target.value })}
                  className="border-neutral-700 bg-neutral-800 text-sm text-neutral-200"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-neutral-400">Assignee</label>
                <select
                  value={newTask.assignee}
                  onChange={(e) => setNewTask({ ...newTask, assignee: e.target.value })}
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-200 focus:outline-none"
                >
                  {TEAM.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-neutral-400">Project</label>
                <select
                  value={newTask.project}
                  onChange={(e) => setNewTask({ ...newTask, project: e.target.value })}
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-200 focus:outline-none"
                >
                  {PROJECTS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setIsAddOpen(false)}
              className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-400 hover:text-neutral-200"
            >
              Cancel
            </button>
            <Button
              onClick={addTask}
              className="bg-[#D4A853] text-black hover:bg-[#c49a47]"
              size="sm"
            >
              Create Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TaskCard({ task, onToggle }: { task: Task; onToggle: (id: number) => void }) {
  const isDone = task.status === "DONE";
  return (
    <Card className="cursor-pointer border-neutral-800 bg-neutral-900 transition-colors hover:border-neutral-700">
      <CardContent className="space-y-2.5 p-3">
        {/* Title row */}
        <div className="flex items-start gap-2">
          <button
            onClick={() => onToggle(task.id)}
            className={cn(
              "mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-colors",
              isDone
                ? "border-[#D4A853] bg-[#D4A853]"
                : "border-neutral-600 hover:border-neutral-400"
            )}
          >
            {isDone && (
              <svg viewBox="0 0 12 12" className="h-full w-full text-black">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
          <p className={cn(
            "text-xs font-medium leading-snug",
            isDone ? "text-neutral-600 line-through" : "text-neutral-200"
          )}>
            {task.title}
          </p>
        </div>

        {/* Description */}
        {task.description && !isDone && (
          <p className="text-[10px] leading-relaxed text-neutral-600 line-clamp-2">
            {task.description}
          </p>
        )}

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge className={cn("text-[10px]", priorityStyles[task.priority])}>
            {task.priority.toLowerCase()}
          </Badge>
          {task.project && (
            <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-500">
              {task.project}
            </span>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white",
                task.assigneeColor
              )}
            >
              {task.assigneeInitials}
            </div>
            {task.subtasksTotal > 0 && (
              <span className="text-[10px] text-neutral-600">
                {task.subtasksDone}/{task.subtasksTotal} subtasks
              </span>
            )}
          </div>
          <span
            className={cn(
              "font-mono text-[10px]",
              task.overdue && !isDone ? "font-semibold text-red-400" : "text-neutral-600"
            )}
          >
            {task.overdue && !isDone ? "⚠ " : ""}{task.due}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
