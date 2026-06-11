"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, ChevronRight, Loader2, Plus } from "lucide-react";
import {
  PORTAL_COLORS,
  TASK_TABS,
  TASK_TAB_LABELS,
  taskTabFor,
  type Task,
  type TaskTab,
} from "./types";

interface Props {
  tasks: Task[];
  onChange: () => void;
}

const DAY_MS = 86_400_000;

function dueTone(dueDate: string | null): "overdue" | "today" | "normal" {
  if (!dueDate) return "normal";
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  if (due < todayStart) return "overdue";
  if (due < new Date(todayStart.getTime() + DAY_MS)) return "today";
  return "normal";
}

function formatDue(dueDate: string): string {
  return new Date(dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function TaskRow({ task, onToggle }: { task: Task; onToggle: (t: Task) => void }) {
  const done = task.status === "DONE";
  const tone = dueTone(task.dueDate);
  const tab = taskTabFor(task.portal);
  const colors = PORTAL_COLORS[task.portal ?? "personal"] ?? PORTAL_COLORS.personal;

  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <button
        onClick={() => onToggle(task)}
        aria-label={done ? "Mark as to do" : "Mark as done"}
        className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border transition-colors ${
          done
            ? "border-[#D4A853] bg-[#D4A853] text-white"
            : "border-gray-300 bg-white hover:border-[#D4A853]"
        }`}
      >
        {done && <Check className="h-3 w-3" strokeWidth={3} />}
      </button>
      <span
        className={`min-w-0 flex-1 truncate text-sm ${
          done ? "text-gray-400 line-through" : "text-gray-800"
        }`}
      >
        {task.title}
      </span>
      {tab !== "general" && (
        <span
          className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
          style={{ backgroundColor: colors.bg, color: colors.text }}
        >
          {TASK_TAB_LABELS[tab]}
        </span>
      )}
      {task.dueDate && !done && (
        <span
          className={`shrink-0 text-xs font-medium ${
            tone === "overdue"
              ? "text-red-500"
              : tone === "today"
                ? "text-amber-500"
                : "text-gray-400"
          }`}
        >
          {tone === "today" ? "Today" : formatDue(task.dueDate)}
        </span>
      )}
    </li>
  );
}

// My Tasks — tabbed by portal category, inline add form, completed collapsed.
export function TaskPanel({ tasks, onChange }: Props) {
  const [tab, setTab] = useState<TaskTab>("all");
  const [showDone, setShowDone] = useState(false);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [category, setCategory] = useState<string>("general");
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    if (tab === "all") return tasks;
    return tasks.filter((t) => taskTabFor(t.portal) === tab);
  }, [tasks, tab]);

  const open = filtered.filter((t) => t.status !== "DONE");
  const done = filtered.filter((t) => t.status === "DONE");

  const toggle = async (task: Task) => {
    await fetch(`/api/tasks/${task.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: task.status === "DONE" ? "TODO" : "DONE" }),
    });
    onChange();
  };

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          dueDate: dueDate || null,
          portal: category === "general" ? null : category,
        }),
      });
      setTitle("");
      setDueDate("");
      setAdding(false);
      onChange();
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-gray-100 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <h2 className="text-sm font-bold text-gray-900">My Tasks</h2>
        <button
          onClick={() => setAdding((v) => !v)}
          className="flex items-center gap-1 rounded-lg bg-[#D4A853]/10 px-2.5 py-1.5 text-xs font-semibold text-[#9a7322] transition-colors hover:bg-[#D4A853]/20"
        >
          <Plus className="h-3.5 w-3.5" /> Add task
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-100 px-3 pt-2">
        {TASK_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-t-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              tab === t
                ? "border-b-2 border-[#D4A853] text-gray-900"
                : "text-gray-400 hover:text-gray-700"
            }`}
          >
            {TASK_TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Inline add form */}
      {adding && (
        <form
          onSubmit={addTask}
          className="flex flex-wrap items-center gap-2 border-b border-gray-100 bg-gray-50/60 px-4 py-3"
        >
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs doing?"
            className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-[#D4A853]"
          />
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-600 outline-none focus:border-[#D4A853]"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-600 outline-none focus:border-[#D4A853]"
          >
            <option value="general">General</option>
            <option value="commercial">Commercial</option>
            <option value="production">Production</option>
            <option value="print">Print</option>
            <option value="followup">Follow-up</option>
          </select>
          <button
            type="submit"
            disabled={!title.trim() || saving}
            className="flex items-center gap-1.5 rounded-lg bg-[#D4A853] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Add
          </button>
        </form>
      )}

      {/* Open tasks */}
      {open.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-gray-400">
          {tab === "all"
            ? "No open tasks. Enjoy the quiet."
            : tab === "followup"
              ? "No follow-ups. Add one to track things like “chase Brand X about the contract”."
              : "No open tasks in this category."}
        </p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {open.map((t) => (
            <TaskRow key={t.id} task={t} onToggle={toggle} />
          ))}
        </ul>
      )}

      {/* Completed, collapsed */}
      {done.length > 0 && (
        <div className="border-t border-gray-100">
          <button
            onClick={() => setShowDone((v) => !v)}
            className="flex w-full items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-gray-400 hover:text-gray-600"
          >
            {showDone ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            Completed ({done.length})
          </button>
          {showDone && (
            <ul className="divide-y divide-gray-50">
              {done.map((t) => (
                <TaskRow key={t.id} task={t} onToggle={toggle} />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
