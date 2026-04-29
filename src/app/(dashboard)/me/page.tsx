"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Bell,
  Calendar as CalendarIcon,
  Briefcase,
  Film,
  Newspaper,
  ArrowRight,
  Check,
  AlertCircle,
  Sparkles,
  Clock,
} from "lucide-react";

// ===== Types =====
interface Me {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: string;
  priority: string;
  portal: string | null;
  link: string | null;
  assignedToId: string;
  assignedTo?: { id: string; name: string; email: string };
  createdAt: string;
}

interface Notification {
  id: string;
  type: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

interface TrelloMember {
  id: string;
  fullName: string;
  username: string;
}
interface PipelineCard {
  id: string;
  name: string;
  client: string;
  dueDate: string | null;
  members: TrelloMember[];
  url: string;
  labels: { id: string; name: string; color: string | null }[];
}
interface PipelineStage {
  id: string;
  name: string;
  cards: PipelineCard[];
}
interface PipelineSnapshot {
  stages: PipelineStage[];
  boardUrl: string;
}

interface Production {
  id: string;
  title: string;
  clientName: string | null;
  status: string;
  shootDates: string[];
  leadId: string | null;
}

interface PrintIssue {
  id: string;
  title: string;
  year: number;
  status: string;
  printDate: string | null;
}

// ===== Helpers =====
const PRIORITY_STYLES: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-600",
  MEDIUM: "bg-blue-50 text-blue-700",
  HIGH: "bg-amber-50 text-amber-700",
  URGENT: "bg-red-50 text-red-700",
};

const PORTAL_STYLES: Record<string, string> = {
  commercial: "bg-emerald-50 text-emerald-700",
  production: "bg-purple-50 text-purple-700",
  print: "bg-blue-50 text-blue-700",
  editorial: "bg-pink-50 text-pink-700",
  finance: "bg-indigo-50 text-indigo-700",
};

const STATUS_BADGES: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  BRIEFED: "bg-blue-50 text-blue-700",
  PRE_PRODUCTION: "bg-amber-50 text-amber-700",
  SHOOTING: "bg-red-50 text-red-700",
  POST_PRODUCTION: "bg-purple-50 text-purple-700",
  DELIVERED: "bg-emerald-50 text-emerald-700",
  ARCHIVED: "bg-gray-100 text-gray-500",
  planning: "bg-gray-100 text-gray-600",
  design: "bg-blue-50 text-blue-700",
  proofing: "bg-amber-50 text-amber-700",
  print: "bg-purple-50 text-purple-700",
  distributed: "bg-emerald-50 text-emerald-700",
};

// Map OS users to Trello full names so we can match deal members.
const TRELLO_NAME_TO_EMAIL: Record<string, string> = {
  joe: "silver@outlandermag.com",
  "joe silver": "silver@outlandermag.com",
  silver: "silver@outlandermag.com",
  quinn: "q@outlandermag.com",
  "quinn titsworth": "q@outlandermag.com",
  shreeya: "shreeya@outlandermag.com",
  "shreeya patel": "shreeya@outlandermag.com",
  callum: "callum@outlandermag.com",
  patricia: "patricia@outlandermag.com",
};

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isThisWeek(d: Date): boolean {
  const today = new Date();
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // Mon
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return d >= start && d < end;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function startOfWeek(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  out.setDate(out.getDate() - ((out.getDay() + 6) % 7));
  return out;
}

// ===== Component =====
export default function MeDashboard() {
  const [me, setMe] = useState<Me | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pipeline, setPipeline] = useState<PipelineSnapshot | null>(null);
  const [productions, setProductions] = useState<Production[]>([]);
  const [printIssues, setPrintIssues] = useState<PrintIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [taskFilter, setTaskFilter] = useState<"all" | "today" | "week" | "overdue">("all");
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("MEDIUM");
  const [newTaskDue, setNewTaskDue] = useState("");
  const [savingTask, setSavingTask] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [meRes, tasksRes, notifRes, trelloRes, prodRes, printRes] = await Promise.all([
          fetch("/api/me").then((r) => r.json()).catch(() => ({ user: null })),
          fetch("/api/tasks").then((r) => r.json()).catch(() => ({ tasks: [] })),
          fetch("/api/notifications").then((r) => r.json()).catch(() => ({ notifications: [] })),
          fetch("/api/trello").then((r) => r.json()).catch(() => null),
          fetch("/api/productions").then((r) => r.json()).catch(() => ({ productions: [] })),
          fetch("/api/print-issues").then((r) => r.json()).catch(() => ({ issues: [] })),
        ]);
        if (cancelled) return;
        setMe(meRes?.user ?? null);
        setTasks(Array.isArray(tasksRes?.tasks) ? tasksRes.tasks : []);
        setNotifications(
          Array.isArray(notifRes?.notifications) ? notifRes.notifications : []
        );
        setPipeline(trelloRes && Array.isArray(trelloRes.stages) ? trelloRes : null);
        setProductions(Array.isArray(prodRes?.productions) ? prodRes.productions : []);
        setPrintIssues(Array.isArray(printRes?.issues) ? printRes.issues : []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const today = new Date();

  // ===== Derived state =====
  const filteredTasks = useMemo(() => {
    if (!Array.isArray(tasks)) return [];
    return tasks.filter((t) => {
      if (taskFilter === "all") return true;
      if (!t.dueDate) return false;
      const d = new Date(t.dueDate);
      if (taskFilter === "today") return isSameDay(d, today);
      if (taskFilter === "week") return isThisWeek(d);
      if (taskFilter === "overdue") return d < today && t.status !== "DONE";
      return true;
    });
  }, [tasks, taskFilter, today]);

  const tasksDueToday = useMemo(
    () => tasks.filter((t) => t.dueDate && isSameDay(new Date(t.dueDate), today) && t.status !== "DONE").length,
    [tasks, today]
  );
  const deadlinesThisWeek = useMemo(
    () =>
      tasks.filter((t) => t.dueDate && isThisWeek(new Date(t.dueDate)) && t.status !== "DONE").length,
    [tasks]
  );
  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  // My deals (Trello cards where my name is in members)
  const myDeals = useMemo(() => {
    if (!pipeline || !me) return [] as { card: PipelineCard; stage: PipelineStage }[];
    const myEmail = me.email.toLowerCase();
    const out: { card: PipelineCard; stage: PipelineStage }[] = [];
    for (const stage of pipeline.stages ?? []) {
      for (const card of stage.cards ?? []) {
        const match = (card.members ?? []).some((m) => {
          const full = (m.fullName ?? "").toLowerCase().trim();
          const user = (m.username ?? "").toLowerCase().trim();
          if (TRELLO_NAME_TO_EMAIL[full] === myEmail) return true;
          if (TRELLO_NAME_TO_EMAIL[user] === myEmail) return true;
          // Substring fallback: first name of OS user
          const firstName = (me.name ?? "").split(/\s+/)[0]?.toLowerCase();
          if (firstName && (full.includes(firstName) || user.includes(firstName))) return true;
          return false;
        });
        if (match) out.push({ card, stage });
      }
    }
    return out;
  }, [pipeline, me]);

  // My productions (assigned as lead, fall back to all)
  const myProductions = useMemo(() => {
    if (!me) return [];
    const mine = productions.filter((p) => p.leadId === me.id);
    return mine.length > 0 ? mine : productions.slice(0, 5);
  }, [productions, me]);

  // My print features (filter by user's first name in title — page-level data isn't loaded here)
  const myPrintIssues = useMemo(() => {
    if (!me) return [];
    return printIssues.slice(0, 5);
  }, [printIssues, me]);

  // Calendar week events
  const weekEvents = useMemo(() => {
    const start = startOfWeek(today);
    const days: { date: Date; events: { label: string; type: string; href?: string }[] }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push({ date: d, events: [] });
    }
    for (const t of tasks) {
      if (!t.dueDate) continue;
      const d = new Date(t.dueDate);
      const idx = days.findIndex((day) => isSameDay(day.date, d));
      if (idx >= 0) days[idx].events.push({ label: t.title, type: "task", href: t.link || undefined });
    }
    for (const p of productions) {
      for (const sd of p.shootDates ?? []) {
        const d = new Date(sd);
        const idx = days.findIndex((day) => isSameDay(day.date, d));
        if (idx >= 0)
          days[idx].events.push({ label: p.title, type: "shoot", href: `/production/${p.id}` });
      }
    }
    for (const issue of printIssues) {
      if (!issue.printDate) continue;
      const d = new Date(issue.printDate);
      const idx = days.findIndex((day) => isSameDay(day.date, d));
      if (idx >= 0)
        days[idx].events.push({ label: `Print: ${issue.title}`, type: "print", href: `/print/${issue.id}` });
    }
    for (const { card } of myDeals) {
      if (!card.dueDate) continue;
      const d = new Date(card.dueDate);
      const idx = days.findIndex((day) => isSameDay(day.date, d));
      if (idx >= 0) days[idx].events.push({ label: card.name, type: "deal", href: card.url });
    }
    return days;
  }, [tasks, productions, printIssues, myDeals, today]);

  // ===== Mutations =====
  async function toggleTaskDone(t: Task) {
    const next = t.status === "DONE" ? "TODO" : "DONE";
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: next } : x)));
    await fetch(`/api/tasks/${t.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
  }

  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    setSavingTask(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTaskTitle.trim(),
          priority: newTaskPriority,
          dueDate: newTaskDue || null,
        }),
      });
      const data = await res.json();
      if (data.task) {
        setTasks((prev) => [data.task, ...prev]);
        setNewTaskTitle("");
        setNewTaskDue("");
        setNewTaskPriority("MEDIUM");
        setShowNewTask(false);
      }
    } finally {
      setSavingTask(false);
    }
  }

  async function markNotificationRead(n: Notification) {
    if (n.read) return;
    setNotifications((prev) =>
      prev.map((x) => (x.id === n.id ? { ...x, read: true } : x))
    );
    await fetch(`/api/notifications/${n.id}`, { method: "PUT" });
  }

  async function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await fetch("/api/notifications/mark-all-read", { method: "POST" });
  }

  // ===== Render =====
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        Loading your dashboard…
      </div>
    );
  }

  const firstName = me?.name?.split(/\s+/)[0] ?? "";

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {greeting()}{firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="mt-1 text-sm text-gray-500">{formatDate(today)}</p>
      </div>

      {/* Quick actions */}
      <div className="mb-6 flex flex-wrap gap-2">
        <button
          onClick={() => setShowNewTask(true)}
          className="flex items-center gap-1.5 rounded-xl bg-[#D4A853] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#C49843] transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> New Task
        </button>
        <Link
          href="/commercial"
          className="flex items-center gap-1.5 rounded-xl bg-white border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-sm transition-colors"
        >
          <Briefcase className="h-3.5 w-3.5" /> New Deal
        </Link>
        <Link
          href="/production"
          className="flex items-center gap-1.5 rounded-xl bg-white border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-sm transition-colors"
        >
          <Film className="h-3.5 w-3.5" /> New Production
        </Link>
        <Link
          href="/ask-os"
          className="flex items-center gap-1.5 rounded-xl bg-white border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-sm transition-colors"
        >
          <Sparkles className="h-3.5 w-3.5" /> Ask OS
        </Link>
      </div>

      {/* Today's briefing */}
      <div className="card-apple p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-[#D4A853]" />
          <h2 className="text-sm font-semibold text-gray-900">Today&apos;s briefing</h2>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <BriefingStat label="Tasks due today" value={tasksDueToday} icon={<Check className="h-4 w-4" />} tone="amber" />
          <BriefingStat label="Deadlines this week" value={deadlinesThisWeek} icon={<CalendarIcon className="h-4 w-4" />} tone="blue" />
          <BriefingStat label="Unread notifications" value={unreadCount} icon={<Bell className="h-4 w-4" />} tone="rose" />
        </div>
        <p className="text-xs text-gray-500">
          {tasksDueToday === 0 && deadlinesThisWeek === 0
            ? "Nothing on fire. A good day to get ahead."
            : `${tasksDueToday > 0 ? `${tasksDueToday} task${tasksDueToday === 1 ? "" : "s"} due today` : "No tasks today"}${deadlinesThisWeek > 0 ? `, ${deadlinesThisWeek} deadline${deadlinesThisWeek === 1 ? "" : "s"} this week` : ""}.`}
        </p>
      </div>

      {/* Two-column layout: tasks + side rails */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Tasks (2 cols) */}
        <div className="lg:col-span-2">
          <SectionCard
            title="My Tasks"
            action={
              <button
                onClick={() => setShowNewTask((v) => !v)}
                className="text-xs text-[#D4A853] font-semibold hover:underline"
              >
                {showNewTask ? "Cancel" : "+ Add task"}
              </button>
            }
          >
            {/* Filter tabs */}
            <div className="flex items-center gap-1 mb-3">
              {(["all", "today", "week", "overdue"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setTaskFilter(f)}
                  className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${
                    taskFilter === f
                      ? "bg-amber-50 text-amber-700"
                      : "text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  {f === "all" ? "All" : f === "today" ? "Today" : f === "week" ? "This week" : "Overdue"}
                </button>
              ))}
            </div>

            {/* Inline new-task form */}
            {showNewTask && (
              <form onSubmit={createTask} className="mb-3 rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-2">
                <input
                  autoFocus
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="What needs doing?"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#D4A853]"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value)}
                    className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs bg-white"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                  <input
                    type="date"
                    value={newTaskDue}
                    onChange={(e) => setNewTaskDue(e.target.value)}
                    className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs bg-white"
                  />
                  <button
                    type="submit"
                    disabled={savingTask || !newTaskTitle.trim()}
                    className="ml-auto rounded-lg bg-[#D4A853] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 hover:bg-[#C49843]"
                  >
                    {savingTask ? "Saving…" : "Add task"}
                  </button>
                </div>
              </form>
            )}

            {/* Task list */}
            {filteredTasks.length === 0 ? (
              <EmptyState
                icon={<Check className="h-5 w-5 text-gray-300" />}
                title={tasks.length === 0 ? "No tasks yet" : "Nothing in this view"}
                hint={tasks.length === 0 ? "Add your first task to get started." : "Try a different filter."}
              />
            ) : (
              <ul className="space-y-1">
                {filteredTasks.map((t) => {
                  const isDone = t.status === "DONE";
                  const due = t.dueDate ? new Date(t.dueDate) : null;
                  const overdue = due && due < today && !isDone;
                  return (
                    <li
                      key={t.id}
                      className="group flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-gray-50 transition-colors"
                    >
                      <button
                        onClick={() => toggleTaskDone(t)}
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                          isDone
                            ? "bg-[#D4A853] border-[#D4A853] text-white"
                            : "border-gray-300 hover:border-[#D4A853]"
                        }`}
                        aria-label="Toggle done"
                      >
                        {isDone && <Check className="h-3 w-3" />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className={`text-sm ${isDone ? "line-through text-gray-400" : "text-gray-900"}`}>
                          {t.title}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                          {t.priority && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${PRIORITY_STYLES[t.priority] ?? "bg-gray-100 text-gray-600"}`}>
                              {t.priority.toLowerCase()}
                            </span>
                          )}
                          {t.portal && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${PORTAL_STYLES[t.portal] ?? "bg-gray-100 text-gray-600"}`}>
                              {t.portal}
                            </span>
                          )}
                          {due && (
                            <span className={`flex items-center gap-1 text-[10px] ${overdue ? "text-red-600 font-medium" : "text-gray-500"}`}>
                              <Clock className="h-2.5 w-2.5" />
                              {due.toLocaleDateString("en-GB", { month: "short", day: "numeric" })}
                              {overdue && " · overdue"}
                            </span>
                          )}
                        </div>
                      </div>
                      {t.link && (
                        <Link href={t.link} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-700 transition-opacity">
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>

          {/* Calendar week view */}
          <div className="mt-6">
            <SectionCard title="My Week">
              <WeekView days={weekEvents} today={today} />
            </SectionCard>
          </div>
        </div>

        {/* Side rail (1 col) */}
        <div className="space-y-6">
          {/* Notifications */}
          <SectionCard
            title="Notifications"
            action={
              unreadCount > 0 ? (
                <button onClick={markAllRead} className="text-xs text-[#D4A853] font-semibold hover:underline">
                  Mark all read
                </button>
              ) : null
            }
          >
            {notifications.length === 0 ? (
              <EmptyState
                icon={<Bell className="h-5 w-5 text-gray-300" />}
                title="All quiet"
                hint="No notifications yet."
              />
            ) : (
              <ul className="space-y-1 max-h-80 overflow-y-auto">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <button
                      onClick={() => markNotificationRead(n)}
                      className={`w-full text-left flex items-start gap-2 rounded-lg px-2 py-2 transition-colors ${
                        n.read ? "opacity-60 hover:bg-gray-50" : "bg-amber-50/40 hover:bg-amber-50"
                      }`}
                    >
                      <NotificationIcon type={n.type} />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-gray-800 leading-snug">{n.message}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">{timeAgo(n.createdAt)}</div>
                      </div>
                      {!n.read && <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#D4A853]" />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>

      {/* My Deals */}
      <div className="mb-6">
        <SectionCard
          title="My Deals"
          subtitle="From the Commercial pipeline"
          action={
            <Link href="/commercial" className="text-xs text-[#D4A853] font-semibold hover:underline">
              View pipeline →
            </Link>
          }
        >
          {myDeals.length === 0 ? (
            <EmptyState
              icon={<Briefcase className="h-5 w-5 text-gray-300" />}
              title="No deals assigned to you"
              hint="Trello cards where you're a member will show up here."
            />
          ) : (
            <ul className="divide-y divide-gray-100">
              {myDeals.slice(0, 8).map(({ card, stage }) => (
                <li key={card.id}>
                  <a
                    href={card.url}
                    target="_blank"
                    rel="noopener"
                    className="flex items-center gap-3 py-2.5 px-1 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-gray-900 truncate">{card.name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700">
                          {stage.name}
                        </span>
                        <span className="text-[11px] text-gray-500 truncate">{card.client}</span>
                        {card.dueDate && (
                          <span className="text-[11px] text-gray-400">
                            · {new Date(card.dueDate).toLocaleDateString("en-GB", { month: "short", day: "numeric" })}
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-gray-400" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* My Productions */}
      <div className="mb-6">
        <SectionCard
          title="My Productions"
          action={
            <Link href="/production" className="text-xs text-[#D4A853] font-semibold hover:underline">
              View all →
            </Link>
          }
        >
          {myProductions.length === 0 ? (
            <EmptyState
              icon={<Film className="h-5 w-5 text-gray-300" />}
              title="No productions yet"
              hint="Productions you lead will appear here."
            />
          ) : (
            <ul className="divide-y divide-gray-100">
              {myProductions.map((p) => {
                const next = (p.shootDates ?? [])
                  .map((s) => new Date(s))
                  .filter((d) => d >= today)
                  .sort((a, b) => a.getTime() - b.getTime())[0];
                return (
                  <li key={p.id}>
                    <Link
                      href={`/production/${p.id}`}
                      className="flex items-center gap-3 py-2.5 px-1 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-900 truncate">{p.title}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_BADGES[p.status] ?? "bg-gray-100 text-gray-600"}`}>
                            {p.status.replace("_", " ").toLowerCase()}
                          </span>
                          {p.clientName && (
                            <span className="text-[11px] text-gray-500 truncate">{p.clientName}</span>
                          )}
                          {next && (
                            <span className="text-[11px] text-gray-400">
                              · shoot {next.toLocaleDateString("en-GB", { month: "short", day: "numeric" })}
                            </span>
                          )}
                        </div>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-gray-400" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* My Print */}
      <div className="mb-12">
        <SectionCard
          title="My Print Features"
          action={
            <Link href="/print" className="text-xs text-[#D4A853] font-semibold hover:underline">
              View issues →
            </Link>
          }
        >
          {myPrintIssues.length === 0 ? (
            <EmptyState
              icon={<Newspaper className="h-5 w-5 text-gray-300" />}
              title="No print features"
              hint="Issues you're attached to will show up here."
            />
          ) : (
            <ul className="divide-y divide-gray-100">
              {myPrintIssues.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/print/${p.id}`}
                    className="flex items-center gap-3 py-2.5 px-1 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-gray-900 truncate">{p.title}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_BADGES[p.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {p.status}
                        </span>
                        <span className="text-[11px] text-gray-500">{p.year}</span>
                        {p.printDate && (
                          <span className="text-[11px] text-gray-400">
                            · print {new Date(p.printDate).toLocaleDateString("en-GB", { month: "short", day: "numeric" })}
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-gray-400" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

// ===== Subcomponents =====

function SectionCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="card-apple p-5">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          {subtitle && <p className="text-[11px] text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function BriefingStat({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: "amber" | "blue" | "rose";
}) {
  const toneClass =
    tone === "amber"
      ? "bg-amber-50 text-amber-700"
      : tone === "blue"
      ? "bg-blue-50 text-blue-700"
      : "bg-rose-50 text-rose-700";
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/40 p-3">
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${toneClass}`}>{icon}</div>
      <div>
        <div className="text-xl font-bold text-gray-900 leading-none">{value}</div>
        <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">{label}</div>
      </div>
    </div>
  );
}

function EmptyState({ icon, title, hint }: { icon: React.ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="mb-2">{icon}</div>
      <div className="text-sm font-medium text-gray-700">{title}</div>
      {hint && <div className="text-xs text-gray-400 mt-1">{hint}</div>}
    </div>
  );
}

function NotificationIcon({ type }: { type: string }) {
  const map: Record<string, { icon: React.ReactNode; bg: string }> = {
    task_assigned: { icon: <Check className="h-3 w-3" />, bg: "bg-amber-100 text-amber-700" },
    deal_moved: { icon: <Briefcase className="h-3 w-3" />, bg: "bg-emerald-100 text-emerald-700" },
    deadline_approaching: { icon: <AlertCircle className="h-3 w-3" />, bg: "bg-red-100 text-red-700" },
    callsheet_published: { icon: <Film className="h-3 w-3" />, bg: "bg-purple-100 text-purple-700" },
    payment_received: { icon: <Sparkles className="h-3 w-3" />, bg: "bg-blue-100 text-blue-700" },
  };
  const v = map[type] ?? { icon: <Bell className="h-3 w-3" />, bg: "bg-gray-100 text-gray-600" };
  return <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${v.bg}`}>{v.icon}</div>;
}

function WeekView({
  days,
  today,
}: {
  days: { date: Date; events: { label: string; type: string; href?: string }[] }[];
  today: Date;
}) {
  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((d, i) => {
        const isToday = isSameDay(d.date, today);
        return (
          <div
            key={i}
            className={`rounded-lg border p-2 min-h-[100px] ${
              isToday ? "border-amber-300 bg-amber-50/30" : "border-gray-100 bg-white"
            }`}
          >
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                {dayLabels[i]}
              </span>
              <span className={`text-xs font-bold ${isToday ? "text-[#D4A853]" : "text-gray-700"}`}>
                {d.date.getDate()}
              </span>
            </div>
            <div className="space-y-1">
              {d.events.slice(0, 3).map((e, j) => {
                const tone =
                  e.type === "task"
                    ? "bg-amber-100 text-amber-800"
                    : e.type === "shoot"
                    ? "bg-purple-100 text-purple-800"
                    : e.type === "print"
                    ? "bg-blue-100 text-blue-800"
                    : "bg-emerald-100 text-emerald-800";
                const content = (
                  <div className={`text-[10px] px-1.5 py-0.5 rounded truncate ${tone}`}>
                    {e.label}
                  </div>
                );
                return e.href ? (
                  <Link key={j} href={e.href} className="block">
                    {content}
                  </Link>
                ) : (
                  <div key={j}>{content}</div>
                );
              })}
              {d.events.length > 3 && (
                <div className="text-[10px] text-gray-400">+{d.events.length - 3} more</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

