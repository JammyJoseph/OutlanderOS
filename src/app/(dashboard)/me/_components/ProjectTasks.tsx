"use client";

import { useMemo, useState } from "react";
import { Plus, X, Loader2 } from "lucide-react";
import {
  type Task,
  type Deadline,
  type UnifiedItem,
  type TaskCategory,
  type ItemSource,
  CATEGORY_LABELS,
} from "./types";
import { UnifiedTaskList, daysUntil } from "./UnifiedTaskList";

interface Props {
  tasks: Task[];
  deadlines: Deadline[];
  onChange: () => void;
}

type Tab = TaskCategory | "all" | "longterm";
type Urgency = "all" | "overdue" | "today" | "week";

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "brand", label: CATEGORY_LABELS.brand },
  { key: "editorial", label: CATEGORY_LABELS.editorial },
  { key: "production", label: CATEGORY_LABELS.production },
  { key: "admin", label: CATEGORY_LABELS.admin },
  { key: "longterm", label: "Long Term Planning" },
];

const URGENCIES: { key: Urgency; label: string }[] = [
  { key: "all", label: "All" },
  { key: "overdue", label: "Overdue" },
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
];

const SOURCES: { key: ItemSource | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "MANUAL", label: "Manual" },
  { key: "EMAIL", label: "Email" },
  { key: "TRELLO", label: "Trello" },
  { key: "PRODUCTION", label: "Production" },
  { key: "PRINT", label: "Print" },
];

// Category tab → portal stored on a task created from within that tab.
const CATEGORY_PORTAL: Record<TaskCategory, string> = {
  brand: "commercial",
  editorial: "editorial",
  production: "production",
  admin: "finance",
};

function categoryFromText(raw: string | null): TaskCategory {
  const s = (raw || "").toLowerCase();
  if (/commercial|brand|partner|deal|sponsor|trello|campaign/.test(s)) return "brand";
  if (/editorial|print|content|feature|writer/.test(s)) return "editorial";
  if (/production|shoot|film|video|call.?sheet/.test(s)) return "production";
  return "admin";
}

function deadlineSource(raw: string): ItemSource {
  const s = raw.toLowerCase();
  if (/email|gmail|inbox/.test(s)) return "EMAIL";
  if (/trello|campaign/.test(s)) return "TRELLO";
  if (/production|shoot/.test(s)) return "PRODUCTION";
  if (/print/.test(s)) return "PRINT";
  return "MANUAL";
}

function toUnified(tasks: Task[], deadlines: Deadline[]): UnifiedItem[] {
  const items: UnifiedItem[] = [];
  for (const t of tasks) {
    items.push({
      id: t.id,
      kind: "task",
      title: t.title,
      dueDate: t.dueDate,
      startDate: null,
      priority: t.priority,
      status: t.status,
      done: t.status === "DONE",
      category: categoryFromText(t.portal),
      source: "MANUAL",
      link: t.link,
      emailSnippet: null,
      emailFrom: null,
      createdAt: t.createdAt,
      type: null,
    });
  }
  for (const d of deadlines) {
    items.push({
      id: d.id,
      kind: "deadline",
      title: d.title,
      dueDate: d.dueDate,
      startDate: d.startDate,
      priority: d.priority,
      status: d.status,
      done: d.status === "COMPLETED" || d.status === "DONE",
      category: categoryFromText(d.category || d.type),
      source: deadlineSource(d.source),
      link: d.sourceUrl,
      emailSnippet: d.emailSnippet,
      emailFrom: d.emailFrom,
      createdAt: d.createdAt,
      type: d.type,
    });
  }
  return items;
}

function AddTaskForm({
  onClose,
  onChange,
}: {
  onClose: () => void;
  onChange: () => void;
}) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [category, setCategory] = useState<TaskCategory>("admin");
  const [priority, setPriority] = useState("MEDIUM");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          dueDate: dueDate || null,
          priority,
          portal: CATEGORY_PORTAL[category],
        }),
      });
      onChange();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
      <div className="mb-2 flex items-center gap-2">
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="What needs doing?"
          className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#D4A853]"
        />
        <button
          onClick={onClose}
          aria-label="Cancel"
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-600 outline-none focus:border-[#D4A853]"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as TaskCategory)}
          className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-600 outline-none focus:border-[#D4A853]"
        >
          <option value="brand">Brand Partnerships</option>
          <option value="editorial">Editorial</option>
          <option value="production">Production</option>
          <option value="admin">General Admin</option>
        </select>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-600 outline-none focus:border-[#D4A853]"
        >
          <option value="URGENT">Urgent</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
        <button
          onClick={submit}
          disabled={!title.trim() || saving}
          className="ml-auto flex items-center gap-1 rounded-lg bg-[#D4A853] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Add task
        </button>
      </div>
    </div>
  );
}

// Zone 2 — unified tasks + deadlines inside category buckets, with
// urgency and source filtering and an inline add-task form.
export function ProjectTasks({ tasks, deadlines, onChange }: Props) {
  const [tab, setTab] = useState<Tab>("all");
  const [urgency, setUrgency] = useState<Urgency>("all");
  const [source, setSource] = useState<ItemSource | "all">("all");
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const all = useMemo(() => toUnified(tasks, deadlines), [tasks, deadlines]);

  const filtered = useMemo(() => {
    return all.filter((it) => {
      if (tab === "longterm") {
        const d = daysUntil(it.dueDate);
        if (d === null || d < 30) return false;
      } else if (tab !== "all" && it.category !== tab) {
        return false;
      }

      if (source !== "all" && it.source !== source) return false;

      if (urgency !== "all") {
        if (it.done) return false;
        const d = daysUntil(it.dueDate);
        if (d === null) return false;
        if (urgency === "overdue" && d >= 0) return false;
        if (urgency === "today" && d !== 0) return false;
        if (urgency === "week" && (d < 0 || d > 7)) return false;
      }

      return true;
    });
  }, [all, tab, urgency, source]);

  const openCount = filtered.filter((it) => !it.done).length;

  async function toggle(item: UnifiedItem) {
    setBusyId(item.id);
    try {
      if (item.kind === "task") {
        await fetch(`/api/tasks/${item.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: item.done ? "TODO" : "DONE" }),
        });
      } else {
        await fetch(`/api/deadlines/${item.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: item.done ? "ACTIVE" : "COMPLETED" }),
        });
      }
      onChange();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Projects &amp; Tasks</h2>
        <button
          onClick={() => setAdding((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg bg-[#D4A853] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#C49843]"
        >
          <Plus className="h-3.5 w-3.5" /> Add task
        </button>
      </div>

      {/* Category tabs — understated text tabs */}
      <div className="mb-3 flex flex-wrap gap-1 border-b border-gray-100 pb-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-md px-2.5 py-1 text-sm transition-colors ${
              tab === t.key
                ? "bg-gray-900 font-medium text-white"
                : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Urgency + source filters */}
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        <div className="flex items-center gap-1">
          <span className="text-gray-400">Urgency</span>
          {URGENCIES.map((u) => (
            <button
              key={u.key}
              onClick={() => setUrgency(u.key)}
              className={`rounded px-1.5 py-0.5 transition-colors ${
                urgency === u.key
                  ? "bg-[#D4A853]/15 font-medium text-[#9a7322]"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              {u.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-gray-400">Source</span>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as ItemSource | "all")}
            className="rounded border border-gray-200 bg-white px-1.5 py-0.5 text-xs text-gray-600 outline-none focus:border-[#D4A853]"
          >
            {SOURCES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <span className="ml-auto text-gray-400">{openCount} open</span>
      </div>

      {adding && (
        <AddTaskForm onClose={() => setAdding(false)} onChange={onChange} />
      )}

      <UnifiedTaskList items={filtered} busyId={busyId} onToggle={toggle} />
    </section>
  );
}
