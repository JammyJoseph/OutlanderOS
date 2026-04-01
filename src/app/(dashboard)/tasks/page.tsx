"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  LayoutGrid,
  List,
  Loader2,
  Zap,
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
import type { BillingAlert } from "@/lib/billing-engine";

type Priority = "URGENT" | "HIGH" | "MEDIUM" | "LOW";
type Status = "TODO" | "IN_PROGRESS" | "DONE";
type TaskSource = "manual" | "auto";

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
  source: TaskSource;
};

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

const ASSIGNEE_COLORS: Record<string, string> = {
  Joe: "bg-[#D4A853]",
  Quinn: "bg-blue-500",
  Shreeya: "bg-emerald-500",
  Callum: "bg-purple-500",
  Patricia: "bg-pink-500",
};

interface DashboardData {
  connected: { billing: boolean; primary: boolean };
  billingAlerts?: BillingAlert[];
  billingTracker?: {
    allDeals?: Array<{ client: string; ioNumber: string; campaign: string }>;
    deals?: Array<{ client: string; ioNumber: string; campaign: string }>;
    invoiceSummary?: {
      signed: number;
      unsigned: number;
      invoicesSent: number;
      invoicesNotSent: number;
    };
  };
}

function senderName(from: string) {
  const match = from.match(/^"?([^"<]+)"?\s*</);
  return match ? match[1].trim() : from.replace(/<[^>]+>/, "").trim();
}

function generateAutoTasks(data: DashboardData): Task[] {
  const tasks: Task[] = [];
  let id = -1; // negative IDs for auto tasks

  const bt = data.billingTracker;
  const alerts = data.billingAlerts || [];

  // From billing tracker: unsigned deals
  if (bt) {
    const allDeals = bt.allDeals?.length ? bt.allDeals : bt.deals ?? [];
    const invoiceSummary = bt.invoiceSummary;

    // Unsigned deals → follow up task
    allDeals.forEach(deal => {
      tasks.push({
        id: id--,
        title: `Follow up with ${deal.client} on IO signing`,
        description: `IO ${deal.ioNumber || "?"} — ${deal.campaign || "campaign"} is unsigned.`,
        priority: "HIGH",
        status: "TODO",
        assignee: "Joe",
        assigneeInitials: "JO",
        assigneeColor: ASSIGNEE_COLORS["Joe"],
        due: "TBD",
        project: "Finance",
        source: "auto",
      });
    });
  }

  // From billing alerts: overdue → chase tasks
  alerts
    .filter(a => a.type === "payment_overdue")
    .forEach(a => {
      tasks.push({
        id: id--,
        title: `Chase ${a.client !== "Unknown" ? a.client : senderName(a.from)} for overdue payment`,
        description: a.subject,
        priority: "URGENT",
        status: "TODO",
        assignee: "Joe",
        assigneeInitials: "JO",
        assigneeColor: ASSIGNEE_COLORS["Joe"],
        due: "ASAP",
        project: "Finance",
        source: "auto",
      });
    });

  // Unread urgent billing emails
  alerts
    .filter(a => (a.priority === "urgent" || a.priority === "high") && a.type !== "payment_overdue")
    .slice(0, 3)
    .forEach(a => {
      tasks.push({
        id: id--,
        title: `Review ${a.type === "invoice_received" ? "invoice" : "billing email"} from ${senderName(a.from)}`,
        description: a.subject,
        priority: a.priority === "urgent" ? "URGENT" : "HIGH",
        status: "TODO",
        assignee: "Joe",
        assigneeInitials: "JO",
        assigneeColor: ASSIGNEE_COLORS["Joe"],
        due: "TBD",
        project: "Finance",
        source: "auto",
      });
    });

  return tasks;
}

export default function TasksPage() {
  const [manualTasks, setManualTasks] = useState<Task[]>([]);
  const [autoTasks, setAutoTasks] = useState<Task[]>([]);
  const [loadingAuto, setLoadingAuto] = useState(true);
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [showAuto, setShowAuto] = useState(true);

  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "MEDIUM" as Priority,
    due: "",
    assignee: "Joe",
    project: "Operations",
  });

  useEffect(() => {
    async function loadAutoTasks() {
      try {
        const res = await fetch("/api/dashboard");
        if (!res.ok) return;
        const data: DashboardData = await res.json();
        setAutoTasks(generateAutoTasks(data));
      } catch {
        // silent — auto tasks just won't show
      } finally {
        setLoadingAuto(false);
      }
    }
    loadAutoTasks();
  }, []);

  const allTasks = [
    ...(showAuto ? autoTasks : []),
    ...manualTasks,
  ];

  const toggleDone = (id: number) => {
    if (id < 0) {
      setAutoTasks(prev =>
        prev.map(t => t.id === id ? { ...t, status: t.status === "DONE" ? "TODO" : "DONE" } : t)
      );
    } else {
      setManualTasks(prev =>
        prev.map(t => t.id === id ? { ...t, status: t.status === "DONE" ? "TODO" : "DONE" } : t)
      );
    }
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
      assigneeColor: ASSIGNEE_COLORS[newTask.assignee] ?? "bg-neutral-600",
      due: newTask.due || "TBD",
      project: newTask.project,
      source: "manual",
    };
    setManualTasks(prev => [task, ...prev]);
    setNewTask({ title: "", description: "", priority: "MEDIUM", due: "", assignee: "Joe", project: "Operations" });
    setIsAddOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-neutral-100">Tasks</h1>
          {!loadingAuto && autoTasks.length > 0 && (
            <button
              onClick={() => setShowAuto(!showAuto)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors",
                showAuto
                  ? "border-[#D4A853]/40 bg-[#D4A853]/10 text-[#D4A853]"
                  : "border-neutral-700 text-neutral-500 hover:text-neutral-300"
              )}
            >
              <Zap className="h-3 w-3" />
              {autoTasks.length} auto-generated
            </button>
          )}
          {loadingAuto && <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-600" />}
        </div>
        <div className="flex items-center gap-2">
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

      {/* Kanban View */}
      {viewMode === "kanban" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {STATUS_GROUPS.map(group => {
            const groupTasks = allTasks.filter(t => t.status === group);
            return (
              <div key={group} className="space-y-2">
                <div className={cn("rounded-t-md border-t-2 pb-1 pt-2", STATUS_COLORS[group])}>
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
                  {groupTasks.map(task => (
                    <TaskCard key={task.id} task={task} onToggle={toggleDone} />
                  ))}
                  {groupTasks.length === 0 && (
                    <div className="rounded-md border border-dashed border-neutral-800 p-6 text-center">
                      <p className="text-xs text-neutral-700">
                        {group === "TODO" ? "Add your first task" : "No tasks here"}
                      </p>
                      {group === "TODO" && (
                        <button
                          onClick={() => setIsAddOpen(true)}
                          className="mt-2 text-xs text-[#D4A853] hover:underline"
                        >
                          + Add task
                        </button>
                      )}
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
          {allTasks.length === 0 ? (
            <div className="rounded-lg border border-dashed border-neutral-800 py-12 text-center">
              <p className="text-sm text-neutral-600">No tasks yet</p>
              <button onClick={() => setIsAddOpen(true)} className="mt-2 text-xs text-[#D4A853] hover:underline">
                Add your first task
              </button>
            </div>
          ) : (
            STATUS_GROUPS.map(group => {
              const groupTasks = allTasks.filter(t => t.status === group);
              if (groupTasks.length === 0) return null;
              return (
                <div key={group} className="space-y-0.5">
                  <div className="flex items-center gap-2 py-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                      {STATUS_LABELS[group]}
                    </span>
                    <span className="text-[10px] text-neutral-700">({groupTasks.length})</span>
                  </div>
                  {groupTasks.map(task => (
                    <div
                      key={task.id}
                      className={cn(
                        "flex items-center gap-3 rounded-md border bg-neutral-900 px-3 py-2.5 hover:border-neutral-700",
                        task.source === "auto" ? "border-[#D4A853]/20" : "border-neutral-800"
                      )}
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
                      {task.source === "auto" && <Zap className="h-3 w-3 shrink-0 text-[#D4A853]/60" />}
                      <p className={cn("flex-1 text-sm", task.status === "DONE" ? "text-neutral-600 line-through" : "text-neutral-200")}>
                        {task.title}
                      </p>
                      <Badge className={cn("text-[10px]", priorityStyles[task.priority])}>
                        {task.priority.toLowerCase()}
                      </Badge>
                      <span className="text-xs text-neutral-500">{task.project}</span>
                      <div className={cn("flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold text-white", task.assigneeColor)}>
                        {task.assigneeInitials}
                      </div>
                      <span className="font-mono text-xs text-neutral-500">{task.due}</span>
                    </div>
                  ))}
                </div>
              );
            })
          )}
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
                onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                className="border-neutral-700 bg-neutral-800 text-sm text-neutral-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral-400">Description</label>
              <textarea
                placeholder="Add details..."
                value={newTask.description}
                onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                className="w-full resize-none rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-neutral-400">Priority</label>
                <select
                  value={newTask.priority}
                  onChange={e => setNewTask({ ...newTask, priority: e.target.value as Priority })}
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
                  onChange={e => setNewTask({ ...newTask, due: e.target.value })}
                  className="border-neutral-700 bg-neutral-800 text-sm text-neutral-200"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-neutral-400">Assignee</label>
                <select
                  value={newTask.assignee}
                  onChange={e => setNewTask({ ...newTask, assignee: e.target.value })}
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-200 focus:outline-none"
                >
                  {TEAM.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-neutral-400">Project</label>
                <select
                  value={newTask.project}
                  onChange={e => setNewTask({ ...newTask, project: e.target.value })}
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-200 focus:outline-none"
                >
                  {PROJECTS.map(p => <option key={p} value={p}>{p}</option>)}
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
            <Button onClick={addTask} className="bg-[#D4A853] text-black hover:bg-[#c49a47]" size="sm">
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
    <Card className={cn(
      "cursor-pointer border-neutral-800 bg-neutral-900 transition-colors hover:border-neutral-700",
      task.source === "auto" && "border-[#D4A853]/20"
    )}>
      <CardContent className="space-y-2.5 p-3">
        <div className="flex items-start gap-2">
          <button
            onClick={() => onToggle(task.id)}
            className={cn(
              "mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-colors",
              isDone ? "border-[#D4A853] bg-[#D4A853]" : "border-neutral-600 hover:border-neutral-400"
            )}
          >
            {isDone && (
              <svg viewBox="0 0 12 12" className="h-full w-full text-black">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
          {task.source === "auto" && <Zap className="mt-0.5 h-3 w-3 shrink-0 text-[#D4A853]/60" />}
          <p className={cn("text-xs font-medium leading-snug", isDone ? "text-neutral-600 line-through" : "text-neutral-200")}>
            {task.title}
          </p>
        </div>

        {task.description && !isDone && (
          <p className="text-[10px] leading-relaxed text-neutral-600 line-clamp-2">{task.description}</p>
        )}

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

        <div className="flex items-center justify-between">
          <div className={cn("flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white", task.assigneeColor)}>
            {task.assigneeInitials}
          </div>
          <span className="font-mono text-[10px] text-neutral-600">{task.due}</span>
        </div>
      </CardContent>
    </Card>
  );
}
