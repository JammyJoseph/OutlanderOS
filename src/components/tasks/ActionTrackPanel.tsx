"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Trash2,
} from "lucide-react";

// ACTION / TRACK task panel.
// ACTION = things that need doing right now.
// TRACK = things you've actioned but are waiting on / monitoring.
// Used on the /me dashboard (all my tasks), Commercial deal detail
// (projectId) and Production project detail (productionId).

export interface PanelTask {
  id: string;
  title: string;
  dueDate: string | null;
  status: string;
  taskType: string; // ACTION | TRACK
  portal: string | null;
  projectId: string | null;
  productionId: string | null;
  project: { id: string; title: string } | null;
  production: { id: string; title: string } | null;
  completedAt: string | null;
  createdAt: string;
}

interface Props {
  // When set, the panel is scoped to one project and new tasks auto-link.
  projectId?: string;
  productionId?: string;
}

const DAY_MS = 86_400_000;

type DueTone = "overdue" | "soon" | "normal";

function dueTone(dueDate: string | null): DueTone {
  if (!dueDate) return "normal";
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  if (due < todayStart) return "overdue";
  // today or tomorrow → amber
  if (due < new Date(todayStart.getTime() + 2 * DAY_MS)) return "soon";
  return "normal";
}

function formatDue(dueDate: string): string {
  return new Date(dueDate).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

// Overdue first, then deadline (soonest first), then creation (newest first).
function sortTasks(tasks: PanelTask[]): PanelTask[] {
  return [...tasks].sort((a, b) => {
    const aOver = dueTone(a.dueDate) === "overdue" ? 0 : 1;
    const bOver = dueTone(b.dueDate) === "overdue" ? 0 : 1;
    if (aOver !== bOver) return aOver - bOver;
    const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    if (aDue !== bDue) return aDue - bDue;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

// Project context badge — Commercial gold, Production red, Print green.
function badgeFor(task: PanelTask): { label: string; bg: string; text: string } | null {
  if (task.production) return { label: task.production.title, bg: "#DC4B4B1A", text: "#a83232" };
  if (task.project) return { label: task.project.title, bg: "#D4A8531A", text: "#9a7322" };
  if (task.portal === "print") return { label: "Print", bg: "#22A06B1A", text: "#15803d" };
  return null;
}

function QuickAdd({
  placeholder,
  accent,
  onAdd,
}: {
  placeholder: string;
  accent: string;
  onAdd: (title: string, dueDate: string | null) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [showDate, setShowDate] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit() {
    const t = title.trim();
    if (!t || saving) return;
    setSaving(true);
    try {
      await onAdd(t, dueDate || null);
      setTitle("");
      setDueDate("");
      setShowDate(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        placeholder={placeholder}
        className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm outline-none transition-colors placeholder:text-gray-400"
        style={{ borderColor: undefined }}
        onFocus={(e) => (e.currentTarget.style.borderColor = accent)}
        onBlur={(e) => (e.currentTarget.style.borderColor = "")}
        disabled={saving}
      />
      {showDate ? (
        <input
          type="date"
          autoFocus
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-600 outline-none"
        />
      ) : (
        <button
          onClick={() => setShowDate(true)}
          aria-label="Add a deadline"
          title="Add a deadline"
          className="shrink-0 rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-gray-50 hover:text-gray-500"
        >
          <CalendarDays className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function TaskRow({
  task,
  fading,
  showBadge,
  onToggle,
  onMove,
  onDelete,
  onDeadline,
}: {
  task: PanelTask;
  fading: boolean;
  showBadge: boolean;
  onToggle: (task: PanelTask) => void;
  onMove: (task: PanelTask) => void;
  onDelete: (task: PanelTask) => void;
  onDeadline: (task: PanelTask, dueDate: string | null) => void;
}) {
  const [editingDate, setEditingDate] = useState(false);
  const isAction = task.taskType !== "TRACK";
  const done = task.status === "DONE";
  const tone = dueTone(task.dueDate);
  const badge = showBadge ? badgeFor(task) : null;

  return (
    <li
      className={`group flex items-center gap-3 px-4 py-2.5 transition-all duration-300 hover:bg-gray-50/70 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* Circular checkbox */}
      <button
        onClick={() => onToggle(task)}
        aria-label={done ? "Mark as to do" : "Mark as done"}
        className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
          done || fading
            ? "border-[#D4A853] bg-[#D4A853] text-white"
            : "border-gray-300 bg-white hover:border-[#D4A853]"
        }`}
      >
        {(done || fading) && <Check className="h-3 w-3" strokeWidth={3} />}
      </button>

      <span
        className={`min-w-0 flex-1 truncate text-sm ${
          done
            ? "text-gray-400 line-through"
            : isAction
              ? "font-semibold text-gray-900"
              : "text-gray-800"
        }`}
      >
        {task.title}
        {/* Deadline inline after the title */}
        {!done && (
          editingDate ? (
            <input
              type="date"
              autoFocus
              defaultValue={task.dueDate ? task.dueDate.split("T")[0] : ""}
              onBlur={(e) => {
                setEditingDate(false);
                const next = e.target.value || null;
                const cur = task.dueDate ? task.dueDate.split("T")[0] : null;
                if (next !== cur) onDeadline(task, next);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              className="ml-2 rounded border border-gray-200 px-1 py-0.5 text-xs font-normal text-gray-600 outline-none"
            />
          ) : task.dueDate ? (
            <button
              onClick={() => setEditingDate(true)}
              title="Change deadline"
              className={`ml-2 text-xs font-medium ${
                tone === "overdue"
                  ? "text-red-500"
                  : tone === "soon"
                    ? "text-amber-500"
                    : "text-gray-400"
              }`}
            >
              by {formatDue(task.dueDate)}
            </button>
          ) : (
            <button
              onClick={() => setEditingDate(true)}
              aria-label="Set deadline"
              title="Set deadline"
              className="ml-2 hidden text-gray-300 hover:text-gray-500 group-hover:inline-block"
            >
              <CalendarDays className="inline h-3.5 w-3.5" />
            </button>
          )
        )}
      </span>

      {badge && (
        <span
          className="max-w-[140px] shrink-0 truncate rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
          style={{ backgroundColor: badge.bg, color: badge.text }}
        >
          {badge.label}
        </span>
      )}

      {/* Hover actions — move between ACTION/TRACK, delete */}
      {!done && (
        <span className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={() => onMove(task)}
            title={isAction ? "Move to Track" : "Move to Action"}
            className={`flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${
              isAction
                ? "text-blue-600 hover:bg-blue-50"
                : "text-amber-600 hover:bg-amber-50"
            }`}
          >
            {isAction ? (
              <>
                <ArrowRight className="h-3 w-3" /> Track
              </>
            ) : (
              <>
                <ArrowLeft className="h-3 w-3" /> Action
              </>
            )}
          </button>
          <button
            onClick={() => onDelete(task)}
            aria-label="Delete task"
            title="Delete task"
            className="rounded-md p-1 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </span>
      )}
    </li>
  );
}

export function ActionTrackPanel({ projectId, productionId }: Props) {
  const [tasks, setTasks] = useState<PanelTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [fadingIds, setFadingIds] = useState<Set<string>>(new Set());
  const [showDone, setShowDone] = useState(false);
  const fadeTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (projectId) params.set("projectId", projectId);
    if (productionId) params.set("productionId", productionId);
    const s = params.toString();
    return s ? `?${s}` : "";
  }, [projectId, productionId]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks${query}`);
      const data = await res.json();
      setTasks(Array.isArray(data.tasks) ? data.tasks : []);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    load();
    const timers = fadeTimers.current;
    return () => timers.forEach((t) => clearTimeout(t));
  }, [load]);

  const open = tasks.filter((t) => t.status !== "DONE");
  const actions = sortTasks(open.filter((t) => t.taskType !== "TRACK"));
  const tracks = sortTasks(open.filter((t) => t.taskType === "TRACK"));
  const weekAgo = Date.now() - 7 * DAY_MS;
  const completed = tasks
    .filter((t) => {
      if (t.status !== "DONE") return false;
      const when = t.completedAt ?? t.createdAt;
      return new Date(when).getTime() >= weekAgo;
    })
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));

  async function patch(id: string, body: Record<string, unknown>) {
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async function addTask(taskType: "ACTION" | "TRACK", title: string, dueDate: string | null) {
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        dueDate,
        taskType,
        projectId: projectId || null,
        productionId: productionId || null,
      }),
    });
    const data = await res.json();
    if (data.task) setTasks((prev) => [data.task, ...prev]);
  }

  function toggle(task: PanelTask) {
    if (task.status === "DONE") {
      // Re-open from the completed list
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, status: "TODO", completedAt: null } : t
        )
      );
      patch(task.id, { status: "TODO" });
      return;
    }
    // Fade out, then move to completed
    setFadingIds((prev) => new Set(prev).add(task.id));
    patch(task.id, { status: "DONE" });
    const timer = setTimeout(() => {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? { ...t, status: "DONE", completedAt: new Date().toISOString() }
            : t
        )
      );
      setFadingIds((prev) => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
      fadeTimers.current.delete(task.id);
    }, 350);
    fadeTimers.current.set(task.id, timer);
  }

  function move(task: PanelTask) {
    const next = task.taskType === "TRACK" ? "ACTION" : "TRACK";
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, taskType: next } : t)));
    patch(task.id, { taskType: next });
  }

  function setDeadline(task: PanelTask, dueDate: string | null) {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id ? { ...t, dueDate: dueDate ? `${dueDate}T00:00:00.000Z` : null } : t
      )
    );
    patch(task.id, { dueDate });
  }

  async function remove(task: PanelTask) {
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
  }

  async function clearCompleted() {
    const ids = completed.map((t) => t.id);
    setTasks((prev) => prev.filter((t) => !ids.includes(t.id)));
    await Promise.all(ids.map((id) => fetch(`/api/tasks/${id}`, { method: "DELETE" })));
  }

  // Badges show project context — redundant inside a project's own task list.
  const showBadges = !projectId && !productionId;

  if (loading) {
    return (
      <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-9 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      </section>
    );
  }

  const renderRows = (list: PanelTask[]) =>
    list.map((t) => (
      <TaskRow
        key={t.id}
        task={t}
        fading={fadingIds.has(t.id)}
        showBadge={showBadges}
        onToggle={toggle}
        onMove={move}
        onDelete={remove}
        onDeadline={setDeadline}
      />
    ));

  return (
    <section className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
      {/* ACTION — amber/gold left border */}
      <div className="border-l-[3px] border-[#D4A853]">
        <div className="flex items-center gap-2 px-4 pb-1 pt-3">
          <h2 className="text-sm font-bold tracking-wide text-gray-900">ACTION</h2>
          <span className="rounded-full bg-[#D4A853]/10 px-2 py-0.5 text-[11px] font-bold text-[#9a7322]">
            {actions.length}
          </span>
        </div>
        <QuickAdd
          placeholder="Add an action… (Enter to save)"
          accent="#D4A853"
          onAdd={(title, due) => addTask("ACTION", title, due)}
        />
        {actions.length === 0 ? (
          <p className="px-4 pb-4 pt-1 text-sm text-gray-400">
            Nothing needs doing. Enjoy the quiet.
          </p>
        ) : (
          <ul className="divide-y divide-gray-50 pb-1">{renderRows(actions)}</ul>
        )}
      </div>

      <div className="h-px bg-gray-100" />

      {/* TRACK — blue left border */}
      <div className="border-l-[3px] border-[#3B82F6]">
        <div className="flex items-center gap-2 px-4 pb-1 pt-3">
          <h2 className="text-sm font-bold tracking-wide text-gray-900">TRACK</h2>
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">
            {tracks.length}
          </span>
        </div>
        <QuickAdd
          placeholder="Track something you're waiting on…"
          accent="#3B82F6"
          onAdd={(title, due) => addTask("TRACK", title, due)}
        />
        {tracks.length === 0 ? (
          <p className="px-4 pb-4 pt-1 text-sm text-gray-400">
            Nothing being tracked right now.
          </p>
        ) : (
          <ul className="divide-y divide-gray-50 pb-1">{renderRows(tracks)}</ul>
        )}
      </div>

      {/* Completed — last 7 days, collapsed by default */}
      {completed.length > 0 && (
        <div className="border-t border-gray-100">
          <div className="flex items-center justify-between pr-3">
            <button
              onClick={() => setShowDone((v) => !v)}
              className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-gray-400 hover:text-gray-600"
            >
              {showDone ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              Completed ({completed.length})
            </button>
            {showDone && (
              <button
                onClick={clearCompleted}
                className="rounded-md px-2 py-1 text-[11px] font-semibold text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
              >
                Clear completed
              </button>
            )}
          </div>
          {showDone && <ul className="divide-y divide-gray-50 pb-1">{renderRows(completed)}</ul>}
        </div>
      )}
    </section>
  );
}
