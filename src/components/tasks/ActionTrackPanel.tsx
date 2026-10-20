"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  RotateCcw,
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

// Completion stamp for the DONE section — includes the year so old items read clearly.
function formatDone(when: string): string {
  return new Date(when).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
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

// Where a task comes from: a workspace dot and the deal or production name.
function contextFor(task: PanelTask): { dot: string; label: string } | null {
  if (task.production) return { dot: "#A93B2E", label: `${task.production.title} · Production` };
  if (task.project) return { dot: "#9C7C2E", label: `${task.project.title} · Commercial` };
  if (task.portal === "print") return { dot: "#2E5E44", label: "Print" };
  if (task.portal === "finance") return { dot: "#2F4B8F", label: "Finance" };
  if (task.portal === "followup") return { dot: "#6B4E8E", label: "Follow-up" };
  return null;
}

// "Today", "Wed", "Overdue · Mon" — the tag on the right of a row.
function dueTag(dueDate: string): { text: string; tone: "bad" | "plain" } {
  const tone = dueTone(dueDate);
  const d = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((new Date(d).setHours(0, 0, 0, 0) - today.getTime()) / DAY_MS);
  const weekday = d.toLocaleDateString("en-GB", { weekday: "short" });
  if (tone === "overdue") return { text: `Overdue · ${days > -7 ? weekday : formatDue(dueDate)}`, tone: "bad" };
  if (days === 0) return { text: "Today", tone: "plain" };
  if (days === 1) return { text: "Tomorrow", tone: "plain" };
  if (days < 7) return { text: weekday, tone: "plain" };
  return { text: formatDue(dueDate), tone: "plain" };
}

const ICON_BTN =
  "flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-foreground";

function QuickAdd({
  placeholder,
  label,
  onAdd,
}: {
  placeholder: string;
  label: string;
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
    <div className="flex items-center gap-2 py-2">
      <div className="relative min-w-0 flex-1">
        <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden>
          <path d="M12 5v14M5 12h14" />
        </svg>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          aria-label={label}
          placeholder={placeholder}
          className="h-11 w-full rounded-lg border-0 bg-background pl-10 pr-3 text-[15px] text-foreground outline-none placeholder:text-muted-foreground focus-visible:shadow-[0_0_0_3px_var(--focus)]"
          disabled={saving}
        />
      </div>
      {showDate ? (
        <input
          type="date"
          autoFocus
          aria-label="Deadline"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          className="h-11 rounded-lg border-0 bg-background px-3 text-sm text-ink-2 outline-none focus-visible:shadow-[0_0_0_3px_var(--focus)]"
        />
      ) : (
        <button type="button" onClick={() => setShowDate(true)} aria-label="Add a deadline" title="Add a deadline" className={ICON_BTN}>
          <CalendarDays className="size-[18px]" strokeWidth={1.75} />
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
  const ctx = showBadge ? contextFor(task) : null;
  const tag = task.dueDate ? dueTag(task.dueDate) : null;

  return (
    <li className={`group flex items-center gap-4 py-3.5 transition-opacity duration-300 ${fading ? "opacity-0" : "opacity-100"}`}>
      <button
        type="button"
        onClick={() => onToggle(task)}
        aria-label={done ? `Mark "${task.title}" as to do` : `Mark "${task.title}" as done`}
        className={`flex size-6 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground ${
          done || fading ? "border-foreground bg-foreground text-background" : "border-[#9AA4B2] bg-background hover:border-foreground"
        }`}
      >
        {(done || fading) && <Check className="size-3.5" strokeWidth={3} />}
      </button>

      <div className="min-w-0 flex-1">
        <div className={`truncate ${done ? "text-muted-foreground line-through" : isAction ? "font-semibold" : "text-ink-2"}`}>{task.title}</div>
        {ctx && (
          <div className="mt-0.5 flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
            <span className="size-2 shrink-0 rounded-full" style={{ background: ctx.dot }} aria-hidden />
            <span className="truncate">{ctx.label}</span>
          </div>
        )}
      </div>

      {/* Hover actions — move between to-do and waiting-on, delete */}
      {!done && (
        <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <button
            type="button"
            onClick={() => onMove(task)}
            title={isAction ? "Move to Waiting on" : "Move to To do"}
            aria-label={isAction ? "Move to Waiting on" : "Move to To do"}
            className={ICON_BTN}
          >
            {isAction ? <ArrowRight className="size-4" strokeWidth={1.75} /> : <ArrowLeft className="size-4" strokeWidth={1.75} />}
          </button>
          <button type="button" onClick={() => onDelete(task)} aria-label="Delete task" title="Delete task" className={`${ICON_BTN} hover:text-bad`}>
            <Trash2 className="size-4" strokeWidth={1.75} />
          </button>
        </span>
      )}

      {!done &&
        (editingDate ? (
          <input
            type="date"
            autoFocus
            aria-label="Deadline"
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
            className="h-8 rounded-lg border border-field bg-background px-2 text-xs text-ink-2 outline-none"
          />
        ) : tag ? (
          <button
            type="button"
            onClick={() => setEditingDate(true)}
            title="Change deadline"
            className={`inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-xs font-semibold ${tag.tone === "bad" ? "bg-bad-bg text-bad" : "bg-background text-ink-2"}`}
          >
            {tag.text}
          </button>
        ) : (
          <button type="button" onClick={() => setEditingDate(true)} aria-label="Set deadline" title="Set deadline" className={`${ICON_BTN} opacity-0 group-hover:opacity-100 focus-visible:opacity-100`}>
            <CalendarDays className="size-4" strokeWidth={1.75} />
          </button>
        ))}
    </li>
  );
}

// A completed task in the Done section — muted and struck through.
function DoneRow({
  task,
  showBadge,
  onReopen,
  onDelete,
}: {
  task: PanelTask;
  showBadge: boolean;
  onReopen: (task: PanelTask) => void;
  onDelete: (task: PanelTask) => void;
}) {
  const ctx = showBadge ? contextFor(task) : null;
  const when = task.completedAt ?? task.createdAt;

  return (
    <li className="group flex items-center gap-4 py-3">
      <button
        type="button"
        onClick={() => onReopen(task)}
        aria-label={`Reopen "${task.title}"`}
        title="Reopen"
        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ok text-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
      >
        <Check className="size-3.5" strokeWidth={3} />
      </button>
      <div className="min-w-0 flex-1">
        <div className="truncate text-muted-foreground line-through">{task.title}</div>
        <div className="mt-0.5 truncate text-sm text-muted-foreground">
          Done {formatDone(when)}
          {ctx ? ` · ${ctx.label}` : ""}
        </div>
      </div>
      <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        <button type="button" onClick={() => onReopen(task)} aria-label="Reopen task" title="Reopen task" className={ICON_BTN}>
          <RotateCcw className="size-4" strokeWidth={1.75} />
        </button>
        <button type="button" onClick={() => onDelete(task)} aria-label="Delete task" title="Delete task" className={`${ICON_BTN} hover:text-bad`}>
          <Trash2 className="size-4" strokeWidth={1.75} />
        </button>
      </span>
    </li>
  );
}

export function ActionTrackPanel({ projectId, productionId }: Props) {
  const [tasks, setTasks] = useState<PanelTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [fadingIds, setFadingIds] = useState<Set<string>>(new Set());
  const [showDone, setShowDone] = useState(true);
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
  // DONE — every completed task, most-recently-finished first.
  const done = tasks
    .filter((t) => t.status === "DONE")
    .sort((a, b) =>
      (b.completedAt ?? b.createdAt).localeCompare(a.completedAt ?? a.createdAt)
    );

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

  // Reopen a completed task — it returns to whichever section it came from
  // (ACTION or TRACK, preserved in taskType).
  function reopen(task: PanelTask) {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id ? { ...t, status: "TODO", completedAt: null } : t
      )
    );
    patch(task.id, { status: "TODO" });
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

  async function clearDone() {
    const ids = done.map((t) => t.id);
    setTasks((prev) => prev.filter((t) => !ids.includes(t.id)));
    await Promise.all(ids.map((id) => fetch(`/api/tasks/${id}`, { method: "DELETE" })));
  }

  // Badges show project context — redundant inside a project's own task list.
  const showBadges = !projectId && !productionId;

  if (loading) {
    return (
      <section className="rounded-2xl bg-surface px-6 py-6 sm:px-7">
        <div className="mb-4 h-6 w-32 animate-pulse rounded-md bg-surface-2" />
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-11 animate-pulse rounded-lg bg-surface-2" />
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

  const heading = (text: string, count: number) => (
    <h3 className="flex items-center gap-2 pt-3 text-sm font-semibold text-muted-foreground">
      {text}
      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-background px-1.5 text-xs font-semibold text-ink-2">{count}</span>
    </h3>
  );

  return (
    <section className="rounded-2xl bg-surface px-6 py-6 sm:px-7" aria-label="Your tasks">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-semibold">{projectId || productionId ? "Tasks" : "Your tasks"}</h2>
        {!projectId && !productionId && (
          <a href="/me/tasks" className="text-sm font-semibold underline decoration-[1.5px] underline-offset-4 hover:text-brand">
            See all
          </a>
        )}
      </div>

      {heading("To do", actions.length)}
      <QuickAdd placeholder="Add a task, press Enter to save" label="Add a task" onAdd={(title, due) => addTask("ACTION", title, due)} />
      {actions.length === 0 ? (
        <p className="pb-3 pt-1 text-[15px] text-muted-foreground">Nothing needs doing. Enjoy the quiet.</p>
      ) : (
        <ul className="[&>li+li]:border-t [&>li+li]:border-line">{renderRows(actions)}</ul>
      )}

      <div className="mt-3 border-t border-line" />
      {heading("Waiting on", tracks.length)}
      <QuickAdd placeholder="Something you're waiting on…" label="Add something you're waiting on" onAdd={(title, due) => addTask("TRACK", title, due)} />
      {tracks.length === 0 ? (
        <p className="pb-1 pt-1 text-[15px] text-muted-foreground">Nothing being tracked right now.</p>
      ) : (
        <ul className="[&>li+li]:border-t [&>li+li]:border-line">{renderRows(tracks)}</ul>
      )}

      {done.length > 0 && (
        <div className="mt-3 border-t border-line pt-1">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowDone((v) => !v)}
              aria-expanded={showDone}
              className="flex min-h-11 items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
              {showDone ? <ChevronDown className="size-4" strokeWidth={1.75} /> : <ChevronRight className="size-4" strokeWidth={1.75} />}
              Done
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-ok-bg px-1.5 text-xs font-semibold text-ok">{done.length}</span>
            </button>
            {showDone && (
              <button type="button" onClick={clearDone} className="min-h-9 rounded-full px-3 text-sm font-semibold text-muted-foreground hover:bg-bad-bg hover:text-bad">
                Clear all
              </button>
            )}
          </div>
          {showDone && (
            <ul className="[&>li+li]:border-t [&>li+li]:border-line">
              {done.map((t) => (
                <DoneRow key={t.id} task={t} showBadge={showBadges} onReopen={reopen} onDelete={remove} />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
