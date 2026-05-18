"use client";

import { useMemo, useState } from "react";
import { Plus, Check, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import type { Task, Deadline, UnifiedItem, TaskCategory } from "./types";

interface Props {
  tasks: Task[];
  deadlines: Deadline[];
  onChange: () => void;
}

const DAY_MS = 86_400_000;

const TABS: { key: TaskCategory | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "brand", label: "Brand Partnerships" },
  { key: "editorial", label: "Editorial" },
  { key: "production", label: "Production" },
  { key: "admin", label: "Admin" },
  { key: "longterm", label: "Long Term" },
];

// Portal applied to a new task created from within a category tab.
const TAB_PORTAL: Record<string, string | null> = {
  all: null,
  brand: "commercial",
  editorial: "editorial",
  production: "production",
  admin: "finance",
  longterm: null,
};

function mapCategory(raw: string | null, hasDueDate: boolean): TaskCategory {
  if (!hasDueDate) return "longterm";
  const s = (raw || "").toLowerCase();
  if (/commercial|brand|partner|deal|sponsor/.test(s)) return "brand";
  if (/editorial|print|content|feature/.test(s)) return "editorial";
  if (/production|shoot|film|video/.test(s)) return "production";
  return "admin";
}

function toUnified(tasks: Task[], deadlines: Deadline[]): UnifiedItem[] {
  const items: UnifiedItem[] = [];
  for (const t of tasks) {
    items.push({
      id: t.id,
      kind: "task",
      title: t.title,
      dueDate: t.dueDate,
      priority: t.priority,
      done: t.status === "DONE",
      category: mapCategory(t.portal, !!t.dueDate),
      source: t.portal || "Task",
      link: t.link,
    });
  }
  for (const d of deadlines) {
    items.push({
      id: d.id,
      kind: "deadline",
      title: d.title,
      dueDate: d.dueDate,
      priority: d.priority,
      done: d.status === "COMPLETED" || d.status === "DONE",
      category: mapCategory(d.category || d.type, true),
      source: d.source,
      link: d.sourceUrl,
    });
  }
  return items;
}

function dueInfo(iso: string | null): { label: string; overdue: boolean } {
  if (!iso) return { label: "No date", overdue: false };
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const diff = Math.round((new Date(iso).getTime() - start.getTime()) / DAY_MS);
  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, overdue: true };
  if (diff === 0) return { label: "Today", overdue: false };
  if (diff === 1) return { label: "Tomorrow", overdue: false };
  if (diff < 14) return { label: `${diff}d`, overdue: false };
  return { label: `${Math.round(diff / 7)}w`, overdue: false };
}

const PRIORITY_DOT: Record<string, string> = {
  URGENT: "bg-red-500",
  HIGH: "bg-orange-400",
  MEDIUM: "bg-[#D4A853]",
  LOW: "bg-gray-300",
};

export function UnifiedTasks({ tasks, deadlines, onChange }: Props) {
  const [tab, setTab] = useState<TaskCategory | "all">("all");
  const [showDone, setShowDone] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState("");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const all = useMemo(() => toUnified(tasks, deadlines), [tasks, deadlines]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: 0 };
    for (const it of all) {
      if (it.done) continue;
      c.all = (c.all || 0) + 1;
      c[it.category] = (c[it.category] || 0) + 1;
    }
    return c;
  }, [all]);

  const visible = useMemo(
    () => all.filter((it) => tab === "all" || it.category === tab),
    [all, tab],
  );

  const open = useMemo(() => {
    return visible
      .filter((it) => !it.done)
      .sort((a, b) => {
        const ao = dueInfo(a.dueDate).overdue ? 0 : 1;
        const bo = dueInfo(b.dueDate).overdue ? 0 : 1;
        if (ao !== bo) return ao - bo;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
  }, [visible]);

  const done = useMemo(() => visible.filter((it) => it.done), [visible]);

  async function toggle(item: UnifiedItem) {
    setBusy(item.id);
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
      setBusy(null);
    }
  }

  async function addTask() {
    const title = newTitle.trim();
    if (!title) return;
    setAdding(true);
    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          portal: TAB_PORTAL[tab],
          dueDate: newDate || null,
        }),
      });
      setNewTitle("");
      setNewDate("");
      onChange();
    } finally {
      setAdding(false);
    }
  }

  return (
    <section className="rounded-xl border border-gray-100 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Tasks &amp; Deadlines</h2>
        <span className="text-xs text-gray-400">{counts.all || 0} open</span>
      </div>

      {/* Category tabs */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === t.key
                ? "bg-gray-900 text-white"
                : "bg-gray-50 text-gray-500 hover:bg-gray-100"
            }`}
          >
            {t.label}
            {counts[t.key] ? (
              <span
                className={`ml-1.5 ${tab === t.key ? "text-gray-300" : "text-gray-400"}`}
              >
                {counts[t.key]}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Inline add */}
      <div className="mb-4 flex gap-2">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTask()}
          placeholder="Add a task…"
          className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#D4A853]"
        />
        <input
          type="date"
          value={newDate}
          onChange={(e) => setNewDate(e.target.value)}
          className="rounded-xl border border-gray-200 px-2 py-2 text-sm text-gray-500 outline-none focus:border-[#D4A853]"
        />
        <button
          onClick={addTask}
          disabled={adding || !newTitle.trim()}
          className="flex items-center gap-1 rounded-xl bg-[#D4A853] px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add
        </button>
      </div>

      {/* Open items */}
      {open.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">Nothing open here. Nice.</p>
      ) : (
        <ul className="space-y-1.5">
          {open.map((it) => (
            <Row key={it.id} item={it} busy={busy === it.id} onToggle={() => toggle(it)} />
          ))}
        </ul>
      )}

      {/* Done section */}
      {done.length > 0 && (
        <div className="mt-4 border-t border-gray-100 pt-3">
          <button
            onClick={() => setShowDone((v) => !v)}
            className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-400"
          >
            {showDone ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            Done ({done.length})
          </button>
          {showDone && (
            <ul className="mt-2 space-y-1.5">
              {done.map((it) => (
                <Row key={it.id} item={it} busy={busy === it.id} onToggle={() => toggle(it)} />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function Row({
  item,
  busy,
  onToggle,
}: {
  item: UnifiedItem;
  busy: boolean;
  onToggle: () => void;
}) {
  const due = dueInfo(item.dueDate);
  return (
    <li
      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
        due.overdue && !item.done
          ? "border-red-100 bg-red-50/60"
          : "border-gray-100 bg-white hover:bg-gray-50"
      }`}
    >
      <button
        onClick={onToggle}
        disabled={busy}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
          item.done
            ? "border-[#D4A853] bg-[#D4A853] text-white"
            : "border-gray-300 hover:border-[#D4A853]"
        }`}
      >
        {busy ? (
          <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
        ) : item.done ? (
          <Check className="h-3.5 w-3.5" />
        ) : null}
      </button>

      <span
        className={`h-2 w-2 shrink-0 rounded-full ${
          PRIORITY_DOT[item.priority] || "bg-gray-300"
        }`}
      />

      <span
        className={`min-w-0 flex-1 truncate text-sm ${
          item.done ? "text-gray-400 line-through" : "text-gray-800"
        }`}
      >
        {item.title}
      </span>

      <span className="shrink-0 rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
        {item.source}
      </span>

      {!item.done && (
        <span
          className={`shrink-0 text-xs font-semibold ${
            due.overdue ? "text-red-600" : "text-gray-400"
          }`}
        >
          {due.label}
        </span>
      )}
    </li>
  );
}
