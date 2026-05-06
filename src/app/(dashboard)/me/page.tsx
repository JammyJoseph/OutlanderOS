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
  Mail,
  RefreshCw,
  Loader2,
  Edit2,
  Trash2,
  AlarmClock,
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

interface Deadline {
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
  emailFrom: string | null;
  emailSnippet: string | null;
  completedAt: string | null;
  snoozedUntil: string | null;
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

interface CulturalEvent {
  id: string;
  title: string;
  date: string;
  category: string;
  location: string | null;
  importance: number;
}

const CULTURAL_CATEGORY_STYLES: Record<string, { bg: string; text: string }> = {
  fashion: { bg: "bg-amber-100", text: "text-amber-800" },
  art: { bg: "bg-purple-100", text: "text-purple-800" },
  film: { bg: "bg-blue-100", text: "text-blue-800" },
  music: { bg: "bg-pink-100", text: "text-pink-800" },
  design: { bg: "bg-teal-100", text: "text-teal-800" },
  food: { bg: "bg-green-100", text: "text-green-800" },
  awards: { bg: "bg-yellow-100", text: "text-yellow-800" },
  culture: { bg: "bg-orange-100", text: "text-orange-800" },
  sport: { bg: "bg-gray-100", text: "text-gray-800" },
  brand: { bg: "bg-indigo-100", text: "text-indigo-800" },
};

function culturalRelativeDate(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff > 0 && diff < 7) return `In ${diff} days`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
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

const SOURCE_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  email: { bg: "bg-blue-50", text: "text-blue-700", label: "Email" },
  manual: { bg: "bg-gray-100", text: "text-gray-700", label: "Manual" },
  trello: { bg: "bg-green-50", text: "text-green-700", label: "Trello" },
  production: { bg: "bg-amber-50", text: "text-amber-700", label: "Production" },
  print: { bg: "bg-purple-50", text: "text-purple-700", label: "Print" },
  task: { bg: "bg-slate-100", text: "text-slate-700", label: "Task" },
};

const TYPE_LABEL: Record<string, string> = {
  follow_up: "Follow-up",
  deliverable: "Deliverable",
  meeting: "Meeting",
  review: "Review",
  payment: "Payment",
  other: "Other",
};

const PRIORITY_DOT: Record<string, string> = {
  URGENT: "bg-red-500",
  HIGH: "bg-amber-500",
  MEDIUM: "bg-gray-400",
  LOW: "bg-gray-300",
};

const DAY_MS = 86_400_000;

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

function startOfWeek(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  out.setDate(out.getDate() - ((out.getDay() + 6) % 7));
  return out;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatCountdown(due: string): {
  label: string;
  tone: "overdue" | "today" | "soon" | "later";
} {
  const dueDate = new Date(due);
  const now = new Date();
  const diffMs = dueDate.getTime() - now.getTime();
  const dueDay = startOfDay(dueDate).getTime();
  const today = startOfDay(now).getTime();
  const dayDiff = Math.round((dueDay - today) / DAY_MS);

  if (dayDiff < 0) {
    const abs = Math.abs(dayDiff);
    return { label: `${abs} day${abs === 1 ? "" : "s"} overdue`, tone: "overdue" };
  }
  if (dayDiff === 0) {
    if (diffMs < 0) return { label: "Overdue today", tone: "overdue" };
    return { label: "Due today", tone: "today" };
  }
  if (dayDiff <= 7) {
    return {
      label: `Due in ${dayDiff} day${dayDiff === 1 ? "" : "s"}`,
      tone: "soon",
    };
  }
  return {
    label: `Due ${dueDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
    tone: "later",
  };
}

function bucketFor(d: Deadline): "overdue" | "today" | "week" | "upcoming" | "done" {
  if (d.status === "COMPLETED") return "done";
  const dueDate = new Date(d.dueDate);
  const now = new Date();
  const dayDiff = Math.round(
    (startOfDay(dueDate).getTime() - startOfDay(now).getTime()) / DAY_MS
  );
  if (dayDiff < 0) return "overdue";
  if (dayDiff === 0) return "today";
  if (dayDiff <= 7) return "week";
  return "upcoming";
}

interface NewDeadlineForm {
  title: string;
  dueDate: string;
  type: string;
  priority: string;
  description: string;
}

const EMPTY_DEADLINE_FORM: NewDeadlineForm = {
  title: "",
  dueDate: "",
  type: "follow_up",
  priority: "MEDIUM",
  description: "",
};

// ===== Component =====
export default function MeDashboard() {
  const [me, setMe] = useState<Me | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [pipeline, setPipeline] = useState<PipelineSnapshot | null>(null);
  const [productions, setProductions] = useState<Production[]>([]);
  const [printIssues, setPrintIssues] = useState<PrintIssue[]>([]);
  const [culturalEvents, setCulturalEvents] = useState<CulturalEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const [taskFilter, setTaskFilter] = useState<"all" | "today" | "week" | "overdue">("all");
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("MEDIUM");
  const [newTaskDue, setNewTaskDue] = useState("");
  const [savingTask, setSavingTask] = useState(false);

  const [scanningEmail, setScanningEmail] = useState(false);
  const [syncingPortals, setSyncingPortals] = useState(false);
  const [showAddDeadline, setShowAddDeadline] = useState(false);
  const [editingDeadlineId, setEditingDeadlineId] = useState<string | null>(null);
  const [deadlineForm, setDeadlineForm] = useState<NewDeadlineForm>(EMPTY_DEADLINE_FORM);
  const [snoozeOpenId, setSnoozeOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  async function loadDeadlines() {
    try {
      const res = await fetch("/api/deadlines");
      const data = await res.json();
      if (Array.isArray(data)) setDeadlines(data);
    } catch {
      // silent
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [
          meRes,
          tasksRes,
          deadlinesRes,
          trelloRes,
          prodRes,
          printRes,
          culturalRes,
        ] = await Promise.all([
          fetch("/api/me").then((r) => r.json()).catch(() => ({ user: null })),
          fetch("/api/tasks").then((r) => r.json()).catch(() => ({ tasks: [] })),
          fetch("/api/deadlines").then((r) => r.json()).catch(() => []),
          fetch("/api/trello").then((r) => r.json()).catch(() => null),
          fetch("/api/productions").then((r) => r.json()).catch(() => ({ productions: [] })),
          fetch("/api/print-issues").then((r) => r.json()).catch(() => ({ issues: [] })),
          fetch("/api/cultural-calendar?upcoming=true&limit=5").then((r) => r.json()).catch(() => []),
        ]);
        if (cancelled) return;
        setMe(meRes?.user ?? null);
        setTasks(Array.isArray(tasksRes?.tasks) ? tasksRes.tasks : []);
        setDeadlines(Array.isArray(deadlinesRes) ? deadlinesRes : []);
        setPipeline(trelloRes && Array.isArray(trelloRes.stages) ? trelloRes : null);
        setProductions(Array.isArray(prodRes?.productions) ? prodRes.productions : []);
        setPrintIssues(Array.isArray(printRes?.issues) ? printRes.issues : []);
        setCulturalEvents(Array.isArray(culturalRes) ? culturalRes : []);
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
    () =>
      tasks.filter(
        (t) =>
          t.dueDate &&
          isSameDay(new Date(t.dueDate), today) &&
          t.status !== "DONE"
      ).length,
    [tasks, today]
  );
  const deadlinesThisWeek = useMemo(
    () =>
      tasks.filter(
        (t) => t.dueDate && isThisWeek(new Date(t.dueDate)) && t.status !== "DONE"
      ).length,
    [tasks]
  );

  const deadlineBuckets = useMemo(() => {
    const overdue: Deadline[] = [];
    const today: Deadline[] = [];
    const week: Deadline[] = [];
    const upcoming: Deadline[] = [];
    const done: Deadline[] = [];
    for (const d of deadlines) {
      const b = bucketFor(d);
      if (b === "overdue") overdue.push(d);
      else if (b === "today") today.push(d);
      else if (b === "week") week.push(d);
      else if (b === "upcoming") upcoming.push(d);
      else done.push(d);
    }
    const sortByDue = (a: Deadline, b: Deadline) =>
      new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    overdue.sort(sortByDue);
    today.sort(sortByDue);
    week.sort(sortByDue);
    upcoming.sort(sortByDue);
    return { overdue, today, week, upcoming, done };
  }, [deadlines]);

  const deadlinesCompletedThisWeek = useMemo(() => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    return deadlines.filter(
      (d) =>
        d.status === "COMPLETED" &&
        d.completedAt &&
        new Date(d.completedAt) >= oneWeekAgo
    ).length;
  }, [deadlines]);

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
    for (const dl of deadlines) {
      if (dl.status === "COMPLETED") continue;
      const d = new Date(dl.dueDate);
      const idx = days.findIndex((day) => isSameDay(day.date, d));
      if (idx >= 0) days[idx].events.push({ label: dl.title, type: "deadline", href: dl.sourceUrl || undefined });
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
  }, [tasks, deadlines, productions, printIssues, myDeals, today]);

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

  // Deadline mutations
  async function createDeadline() {
    if (!deadlineForm.title.trim() || !deadlineForm.dueDate) {
      showToast("Title and due date required");
      return;
    }
    const res = await fetch("/api/deadlines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: deadlineForm.title,
        dueDate: new Date(deadlineForm.dueDate).toISOString(),
        type: deadlineForm.type,
        priority: deadlineForm.priority,
        description: deadlineForm.description || undefined,
      }),
    });
    if (res.ok) {
      setDeadlineForm(EMPTY_DEADLINE_FORM);
      setShowAddDeadline(false);
      loadDeadlines();
    } else {
      showToast("Failed to create deadline");
    }
  }

  async function updateDeadline(id: string, patch: Record<string, unknown>) {
    const res = await fetch(`/api/deadlines/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) loadDeadlines();
    else showToast("Failed to update");
  }

  async function saveDeadlineEdit(id: string) {
    if (!deadlineForm.title.trim() || !deadlineForm.dueDate) return;
    await updateDeadline(id, {
      title: deadlineForm.title,
      dueDate: new Date(deadlineForm.dueDate).toISOString(),
      type: deadlineForm.type,
      priority: deadlineForm.priority,
      description: deadlineForm.description || null,
    });
    setEditingDeadlineId(null);
    setDeadlineForm(EMPTY_DEADLINE_FORM);
  }

  async function deleteDeadline(id: string) {
    if (!confirm("Delete this deadline?")) return;
    await fetch(`/api/deadlines/${id}`, { method: "DELETE" });
    loadDeadlines();
  }

  function snoozeDeadline(id: string, days: number) {
    const until = new Date();
    until.setDate(until.getDate() + days);
    updateDeadline(id, { status: "SNOOZED", snoozedUntil: until.toISOString() });
    setSnoozeOpenId(null);
  }

  async function scanEmail() {
    setScanningEmail(true);
    showToast("Scanning email…");
    try {
      const res = await fetch("/api/deadlines/scan-email", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        showToast(
          `Scanned ${data.scanned} emails — ${data.created} new deadline${data.created === 1 ? "" : "s"} found`
        );
        loadDeadlines();
      } else {
        showToast(data.error || "Email scan failed");
      }
    } catch {
      showToast("Email scan failed");
    } finally {
      setScanningEmail(false);
    }
  }

  async function syncPortals() {
    setSyncingPortals(true);
    showToast("Syncing portals…");
    try {
      const res = await fetch("/api/deadlines/sync-portals", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        showToast(`Synced — ${data.created} new, ${data.updated} updated`);
        loadDeadlines();
      } else {
        showToast(data.error || "Portal sync failed");
      }
    } catch {
      showToast("Portal sync failed");
    } finally {
      setSyncingPortals(false);
    }
  }

  function startEditDeadline(d: Deadline) {
    setEditingDeadlineId(d.id);
    const localDate = new Date(d.dueDate);
    const yyyy = localDate.getFullYear();
    const mm = String(localDate.getMonth() + 1).padStart(2, "0");
    const dd = String(localDate.getDate()).padStart(2, "0");
    setDeadlineForm({
      title: d.title,
      dueDate: `${yyyy}-${mm}-${dd}`,
      type: d.type,
      priority: d.priority,
      description: d.description ?? "",
    });
    setShowAddDeadline(false);
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
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-gray-900 px-4 py-3 text-sm text-white shadow-xl">
          {toast}
        </div>
      )}

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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <BriefingStat label="Overdue" value={deadlineBuckets.overdue.length} icon={<AlertCircle className="h-4 w-4" />} tone="red" />
          <BriefingStat label="Due today" value={deadlineBuckets.today.length} icon={<AlarmClock className="h-4 w-4" />} tone="amber" />
          <BriefingStat label="Tasks today" value={tasksDueToday} icon={<Check className="h-4 w-4" />} tone="amber" />
          <BriefingStat label="This week" value={deadlinesThisWeek} icon={<CalendarIcon className="h-4 w-4" />} tone="blue" />
        </div>
        <p className="text-xs text-gray-500">
          {deadlineBuckets.overdue.length === 0 && deadlineBuckets.today.length === 0 && tasksDueToday === 0
            ? "Nothing on fire. A good day to get ahead."
            : `${deadlineBuckets.overdue.length > 0 ? `${deadlineBuckets.overdue.length} overdue` : ""}${deadlineBuckets.overdue.length > 0 && deadlineBuckets.today.length > 0 ? ", " : ""}${deadlineBuckets.today.length > 0 ? `${deadlineBuckets.today.length} due today` : ""}${tasksDueToday > 0 ? ` · ${tasksDueToday} task${tasksDueToday === 1 ? "" : "s"} today` : ""}.`}
        </p>
      </div>

      {/* Deadline Tracker — most prominent section */}
      <section className="card-apple p-6 mb-6">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <AlarmClock className="h-4 w-4 text-[#D4A853]" />
              <h2 className="text-base font-bold text-gray-900">Deadline Tracker</h2>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Auto-scans email, syncs portals, and tracks every commitment.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={scanEmail}
              disabled={scanningEmail}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {scanningEmail ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
              Scan Email
            </button>
            <button
              onClick={syncPortals}
              disabled={syncingPortals}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {syncingPortals ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Sync Portals
            </button>
            <button
              onClick={() => {
                setShowAddDeadline(!showAddDeadline);
                setEditingDeadlineId(null);
                setDeadlineForm(EMPTY_DEADLINE_FORM);
              }}
              className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <DeadlineStatCard count={deadlineBuckets.overdue.length} label="Overdue" tone="red" />
          <DeadlineStatCard count={deadlineBuckets.today.length} label="Due today" tone="amber" />
          <DeadlineStatCard count={deadlineBuckets.week.length} label="This week" tone="gray" />
          <DeadlineStatCard count={deadlinesCompletedThisWeek} label="Completed (7d)" tone="green" />
        </div>

        {(showAddDeadline || editingDeadlineId) && (
          <DeadlineFormCard
            form={deadlineForm}
            setForm={setDeadlineForm}
            onSave={() => (editingDeadlineId ? saveDeadlineEdit(editingDeadlineId) : createDeadline())}
            onCancel={() => {
              setShowAddDeadline(false);
              setEditingDeadlineId(null);
              setDeadlineForm(EMPTY_DEADLINE_FORM);
            }}
            isEditing={!!editingDeadlineId}
          />
        )}

        <div className="space-y-5 mt-4">
          {deadlines.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 py-10 text-center">
              <p className="text-sm text-gray-500">
                No deadlines yet. Scan your inbox or add one manually.
              </p>
              <button
                onClick={() => setShowAddDeadline(true)}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-gray-900 hover:underline"
              >
                <Plus className="h-3 w-3" />
                Add your first deadline
              </button>
            </div>
          ) : (
            <>
              <DeadlineGroup
                title="Overdue"
                tone="red"
                items={deadlineBuckets.overdue}
                onComplete={(id) => updateDeadline(id, { status: "COMPLETED" })}
                onDelete={deleteDeadline}
                onEdit={startEditDeadline}
                onSnooze={snoozeDeadline}
                snoozeOpenId={snoozeOpenId}
                setSnoozeOpenId={setSnoozeOpenId}
              />
              <DeadlineGroup
                title="Today"
                tone="amber"
                items={deadlineBuckets.today}
                onComplete={(id) => updateDeadline(id, { status: "COMPLETED" })}
                onDelete={deleteDeadline}
                onEdit={startEditDeadline}
                onSnooze={snoozeDeadline}
                snoozeOpenId={snoozeOpenId}
                setSnoozeOpenId={setSnoozeOpenId}
              />
              <DeadlineGroup
                title="This Week"
                tone="white"
                items={deadlineBuckets.week}
                onComplete={(id) => updateDeadline(id, { status: "COMPLETED" })}
                onDelete={deleteDeadline}
                onEdit={startEditDeadline}
                onSnooze={snoozeDeadline}
                snoozeOpenId={snoozeOpenId}
                setSnoozeOpenId={setSnoozeOpenId}
              />
              <DeadlineGroup
                title="Upcoming"
                tone="muted"
                items={deadlineBuckets.upcoming}
                onComplete={(id) => updateDeadline(id, { status: "COMPLETED" })}
                onDelete={deleteDeadline}
                onEdit={startEditDeadline}
                onSnooze={snoozeDeadline}
                snoozeOpenId={snoozeOpenId}
                setSnoozeOpenId={setSnoozeOpenId}
              />
              {deadlineBuckets.done.length > 0 && (
                <DeadlineGroup
                  title={`Recently completed (${deadlineBuckets.done.length})`}
                  tone="muted"
                  items={deadlineBuckets.done.slice(0, 6)}
                  onComplete={(id) => updateDeadline(id, { status: "ACTIVE" })}
                  onDelete={deleteDeadline}
                  onEdit={startEditDeadline}
                  onSnooze={snoozeDeadline}
                  snoozeOpenId={snoozeOpenId}
                  setSnoozeOpenId={setSnoozeOpenId}
                  completedView
                />
              )}
            </>
          )}
        </div>
      </section>

      {/* My Tasks (full width — notifications section removed in favour of Deadline Tracker) */}
      <div className="mb-6">
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
      </div>

      {/* Calendar week view */}
      <div className="mb-6">
        <SectionCard title="My Week">
          <WeekView days={weekEvents} today={today} />
        </SectionCard>
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

      {/* Cultural Pulse */}
      <div className="mb-6">
        <SectionCard
          title="Cultural Pulse"
          subtitle="Next 5 cultural moments to know about"
          action={
            <Link href="/think-tank/calendar" className="text-xs text-[#D4A853] font-semibold hover:underline">
              See all →
            </Link>
          }
        >
          {culturalEvents.length === 0 ? (
            <EmptyState
              icon={<Sparkles className="h-5 w-5 text-gray-300" />}
              title="No upcoming cultural events"
              hint="Once seeded, fashion weeks, art fairs, and festivals will surface here."
            />
          ) : (
            <ul className="divide-y divide-gray-100">
              {culturalEvents.map((ev) => {
                const s = CULTURAL_CATEGORY_STYLES[ev.category] ?? CULTURAL_CATEGORY_STYLES.culture;
                return (
                  <li key={ev.id}>
                    <Link
                      href="/think-tank/calendar"
                      className="flex items-center gap-3 py-2.5 px-1 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize ${s.bg} ${s.text}`}>
                        {ev.category}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-900 truncate">{ev.title}</div>
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-gray-500">
                          <span className="font-medium text-gray-600">{culturalRelativeDate(ev.date)}</span>
                          {ev.location && <span className="truncate">· {ev.location}</span>}
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
  tone: "amber" | "blue" | "rose" | "red";
}) {
  const toneClass =
    tone === "amber"
      ? "bg-amber-50 text-amber-700"
      : tone === "blue"
      ? "bg-blue-50 text-blue-700"
      : tone === "red"
      ? "bg-red-50 text-red-700"
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

function DeadlineStatCard({
  count,
  label,
  tone,
}: {
  count: number;
  label: string;
  tone: "red" | "amber" | "gray" | "green";
}) {
  const styles = {
    red: "bg-red-50 text-red-700 ring-red-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    gray: "bg-gray-50 text-gray-700 ring-gray-100",
    green: "bg-green-50 text-green-700 ring-green-100",
  }[tone];
  return (
    <div className={`rounded-xl px-4 py-3 ring-1 ${styles}`}>
      <p className="text-2xl font-bold leading-tight">{count}</p>
      <p className="text-[10px] font-medium uppercase tracking-wider opacity-80 mt-0.5">{label}</p>
    </div>
  );
}

function DeadlineFormCard({
  form,
  setForm,
  onSave,
  onCancel,
  isEditing,
}: {
  form: NewDeadlineForm;
  setForm: (f: NewDeadlineForm) => void;
  onSave: () => void;
  onCancel: () => void;
  isEditing: boolean;
}) {
  return (
    <div className="rounded-xl bg-gray-50 p-4 ring-1 ring-gray-100">
      <p className="text-xs font-semibold text-gray-700 mb-3">
        {isEditing ? "Edit deadline" : "New deadline"}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-[10px] font-medium uppercase tracking-wider text-gray-500 mb-1">Title</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="What needs tracking?"
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-[10px] font-medium uppercase tracking-wider text-gray-500 mb-1">Due date</label>
          <input
            type="date"
            value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-[10px] font-medium uppercase tracking-wider text-gray-500 mb-1">Type</label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
          >
            <option value="follow_up">Follow-up</option>
            <option value="deliverable">Deliverable</option>
            <option value="meeting">Meeting</option>
            <option value="review">Review</option>
            <option value="payment">Payment</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-medium uppercase tracking-wider text-gray-500 mb-1">Priority</label>
          <select
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value })}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-[10px] font-medium uppercase tracking-wider text-gray-500 mb-1">Description (optional)</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gray-400 focus:outline-none resize-none"
          />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800"
        >
          {isEditing ? "Save changes" : "Add deadline"}
        </button>
      </div>
    </div>
  );
}

function DeadlineGroup({
  title,
  tone,
  items,
  onComplete,
  onDelete,
  onEdit,
  onSnooze,
  snoozeOpenId,
  setSnoozeOpenId,
  completedView = false,
}: {
  title: string;
  tone: "red" | "amber" | "white" | "muted";
  items: Deadline[];
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (d: Deadline) => void;
  onSnooze: (id: string, days: number) => void;
  snoozeOpenId: string | null;
  setSnoozeOpenId: (id: string | null) => void;
  completedView?: boolean;
}) {
  if (items.length === 0) return null;

  const headerTone = {
    red: "text-red-700",
    amber: "text-amber-700",
    white: "text-gray-800",
    muted: "text-gray-500",
  }[tone];

  return (
    <div>
      <h3 className={`text-xs font-semibold uppercase tracking-widest mb-2 ${headerTone}`}>
        {title}
        <span className="ml-2 text-gray-400">{items.length}</span>
      </h3>
      <ul className="space-y-2">
        {items.map((d) => (
          <DeadlineRow
            key={d.id}
            deadline={d}
            tone={tone}
            onComplete={onComplete}
            onDelete={onDelete}
            onEdit={onEdit}
            onSnooze={onSnooze}
            snoozeOpen={snoozeOpenId === d.id}
            setSnoozeOpen={(open) => setSnoozeOpenId(open ? d.id : null)}
            completedView={completedView}
          />
        ))}
      </ul>
    </div>
  );
}

function DeadlineRow({
  deadline,
  tone,
  onComplete,
  onDelete,
  onEdit,
  onSnooze,
  snoozeOpen,
  setSnoozeOpen,
  completedView,
}: {
  deadline: Deadline;
  tone: "red" | "amber" | "white" | "muted";
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (d: Deadline) => void;
  onSnooze: (id: string, days: number) => void;
  snoozeOpen: boolean;
  setSnoozeOpen: (open: boolean) => void;
  completedView: boolean;
}) {
  const cd = formatCountdown(deadline.dueDate);
  const sourceBadge = SOURCE_BADGE[deadline.source] ?? SOURCE_BADGE.manual;
  const typeLabel = TYPE_LABEL[deadline.type] ?? deadline.type;
  const priorityDot = PRIORITY_DOT[deadline.priority] ?? PRIORITY_DOT.MEDIUM;

  const rowBg = completedView
    ? "bg-gray-50/50"
    : tone === "red"
    ? "bg-red-50/40"
    : tone === "amber"
    ? "bg-amber-50/40"
    : tone === "muted"
    ? "bg-gray-50/40"
    : "bg-white";

  const countdownClass =
    cd.tone === "overdue"
      ? "text-red-600 font-bold"
      : cd.tone === "today"
      ? "text-amber-700 font-semibold"
      : cd.tone === "soon"
      ? "text-gray-700 font-medium"
      : "text-gray-500";

  return (
    <li className={`rounded-xl ${rowBg} ring-1 ring-gray-100 px-4 py-3 transition-shadow hover:shadow-sm`}>
      <div className="flex items-start gap-3">
        <button
          onClick={() => onComplete(deadline.id)}
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
            completedView
              ? "border-green-500 bg-green-500 text-white hover:bg-green-600"
              : "border-gray-300 bg-white hover:border-gray-900 hover:bg-gray-900 hover:text-white text-transparent"
          }`}
          title={completedView ? "Mark active" : "Complete"}
        >
          <Check className="h-3 w-3" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap">
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${priorityDot}`} />
            <p
              className={`text-sm font-medium leading-snug ${
                completedView ? "text-gray-500 line-through" : "text-gray-900"
              }`}
            >
              {deadline.title}
            </p>
          </div>

          {deadline.description && !completedView && (
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">{deadline.description}</p>
          )}

          {deadline.emailSnippet && !completedView && (
            <blockquote className="mt-1.5 border-l-2 border-blue-200 pl-2 text-[11px] italic text-gray-500">
              &ldquo;{deadline.emailSnippet}&rdquo;
              {deadline.emailFrom && (
                <span className="ml-1 not-italic text-gray-400">
                  — {deadline.emailFrom.replace(/<[^>]+>/, "").trim()}
                </span>
              )}
            </blockquote>
          )}

          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span className={`text-[11px] uppercase tracking-wide ${countdownClass}`}>
              {cd.label}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${sourceBadge.bg} ${sourceBadge.text}`}>
              {sourceBadge.label}
            </span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
              {typeLabel}
            </span>
            {deadline.sourceUrl && (
              <a
                href={deadline.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-blue-600 hover:underline"
              >
                Open source
              </a>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0 relative">
          {!completedView && (
            <>
              <div className="relative">
                <button
                  onClick={() => setSnoozeOpen(!snoozeOpen)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  title="Snooze"
                >
                  <Clock className="h-3.5 w-3.5" />
                </button>
                {snoozeOpen && (
                  <div className="absolute right-0 top-8 z-10 w-32 rounded-lg border border-gray-200 bg-white py-1 shadow-md">
                    <button
                      onClick={() => onSnooze(deadline.id, 1)}
                      className="block w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50"
                    >
                      +1 day
                    </button>
                    <button
                      onClick={() => onSnooze(deadline.id, 3)}
                      className="block w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50"
                    >
                      +3 days
                    </button>
                    <button
                      onClick={() => onSnooze(deadline.id, 7)}
                      className="block w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50"
                    >
                      +1 week
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={() => onEdit(deadline)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                title="Edit"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          <button
            onClick={() => onDelete(deadline.id)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </li>
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
                    : e.type === "deadline"
                    ? "bg-red-100 text-red-800"
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
