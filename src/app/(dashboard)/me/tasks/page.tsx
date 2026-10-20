"use client";

// My tasks: every open task, grouped by when it's due, with a detail panel.
// The dashboard's task card is the quick view; this is the whole list.
//
// Same data and endpoints as the dashboard card (/api/tasks), so nothing about
// how tasks are stored or shared changed.

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, Plus, Trash2, X } from "lucide-react";
import { Chips, KV, Page, PageHead, Tag, pill } from "@/components/os";
import { useConfirm } from "@/components/ui/confirm-provider";
import { TASK_TABS, TASK_TAB_LABELS, taskTabFor, type TaskTab } from "../_components/types";

interface Person {
  id: string;
  name: string;
}
interface FullTask {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: string;
  priority: string;
  portal: string | null;
  taskType: string;
  completedAt: string | null;
  createdAt: string;
  project: { id: string; title: string } | null;
  production: { id: string; title: string } | null;
  assignedTo: Person | null;
  createdBy: Person | null;
}

const DAY = 86_400_000;
const DOTS: Record<string, string> = {
  commercial: "#9C7C2E",
  production: "#A93B2E",
  print: "#2E5E44",
  finance: "#2F4B8F",
  followup: "#6B4E8E",
};
const PRIORITY: Record<string, string> = { LOW: "Low", MEDIUM: "Medium", HIGH: "High", URGENT: "Urgent" };

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

type Group = "Overdue" | "Today" | "This week" | "Later";
function groupOf(t: FullTask): Group {
  if (!t.dueDate) return "Later";
  const due = new Date(t.dueDate).setHours(0, 0, 0, 0);
  const today = startOfToday();
  if (due < today) return "Overdue";
  if (due === today) return "Today";
  if (due < today + 7 * DAY) return "This week";
  return "Later";
}

const dayLabel = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

function contextLine(t: FullTask) {
  const where = t.production?.title ?? t.project?.title ?? null;
  const tab = taskTabFor(t.portal);
  const due = t.dueDate ? (groupOf(t) === "Overdue" ? `due ${dayLabel(t.dueDate)}` : dayLabel(t.dueDate)) : "no date";
  return [where ?? TASK_TAB_LABELS[tab], due].join(" · ");
}

function Tasks() {
  const params = useSearchParams();
  const confirm = useConfirm();
  const [tasks, setTasks] = useState<FullTask[] | null>(null);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<TaskTab>("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const addRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setError(false);
    try {
      const r = await fetch("/api/tasks");
      if (!r.ok) throw new Error();
      const j = await r.json();
      setTasks(Array.isArray(j.tasks) ? j.tasks : []);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (params.get("new") === "1") addRef.current?.focus();
  }, [params]);

  async function patch(id: string, body: Record<string, unknown>) {
    setTasks((cur) => cur?.map((t) => (t.id === id ? { ...t, ...body } as FullTask : t)) ?? cur);
    const r = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) void load();
  }

  async function add() {
    const title = draft.trim();
    if (!title || saving) return;
    setSaving(true);
    try {
      const portal = tab === "all" || tab === "general" ? null : tab;
      const r = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, portal, taskType: "ACTION" }),
      });
      if (r.ok) {
        setDraft("");
        await load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function remove(t: FullTask) {
    const ok = await confirm({
      title: "Delete this task?",
      message: `“${t.title}” will be removed for everyone it's shared with.`,
      confirmLabel: "Delete",
      confirmVariant: "danger",
    });
    if (!ok) return;
    setTasks((cur) => cur?.filter((x) => x.id !== t.id) ?? cur);
    setSelected(null);
    const r = await fetch(`/api/tasks/${t.id}`, { method: "DELETE" });
    if (!r.ok) void load();
  }

  const inTab = useMemo(
    () => (tasks ?? []).filter((t) => tab === "all" || taskTabFor(t.portal) === tab),
    [tasks, tab],
  );
  const open = inTab.filter((t) => t.status !== "DONE");
  const done = inTab.filter((t) => t.status === "DONE");
  const groups = (["Overdue", "Today", "This week", "Later"] as Group[])
    .map((g) => ({
      g,
      items: open
        .filter((t) => groupOf(t) === g)
        .sort((a, b) => (a.dueDate ?? "9").localeCompare(b.dueDate ?? "9")),
    }))
    .filter((x) => x.items.length);
  const allOpen = (tasks ?? []).filter((t) => t.status !== "DONE");
  const dueToday = allOpen.filter((t) => groupOf(t) === "Today").length;
  const current = (tasks ?? []).find((t) => t.id === selected) ?? null;

  const chipOptions = TASK_TABS.map((t) => ({ value: t, label: TASK_TAB_LABELS[t] }));

  return (
    <Page>
      <PageHead
        eyebrow={tasks ? `${allOpen.length} open · ${dueToday} due today` : " "}
        title="Tasks"
        aside={
          <button type="button" className={pill("primary")} onClick={() => addRef.current?.focus()}>
            <Plus strokeWidth={1.75} /> New task
          </button>
        }
      />

      <div className="-mt-4 flex flex-col gap-2">
        <Chips label="Filter tasks" options={chipOptions} value={tab} onChange={setTab} />

        <div className="flex flex-wrap items-start gap-8">
          <div className="min-w-0 flex-[999_1_480px]">
            <div className="mt-4 flex h-[52px] items-center gap-3 rounded-[14px] bg-surface px-4 text-muted-foreground focus-within:shadow-[0_0_0_3px_var(--focus)]">
              <Plus className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />
              <input
                ref={addRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void add();
                }}
                aria-label="Add a task"
                placeholder="Add a task, press Enter to save"
                disabled={saving}
                className="h-12 min-w-0 flex-1 border-0 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground focus-visible:shadow-none"
              />
            </div>

            {error && (
              <div className="mt-6 flex items-center justify-between gap-4 rounded-xl bg-bad-bg px-5 py-4 text-bad">
                Couldn&rsquo;t load your tasks.
                <button type="button" onClick={() => void load()} className={pill("outline", "sm")}>
                  Try again
                </button>
              </div>
            )}
            {!tasks && !error && (
              <div className="mt-6 space-y-3">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded-lg bg-surface" />
                ))}
              </div>
            )}
            {tasks && open.length === 0 && (
              <p className="mt-8 text-[15px] text-muted-foreground">Nothing open here. Add one above.</p>
            )}

            {groups.map(({ g, items }) => (
              <section key={g} aria-label={g}>
                <h2 className={`flex items-center gap-2 pb-1.5 pt-6 text-sm font-semibold ${g === "Overdue" ? "text-bad" : "text-muted-foreground"}`}>
                  {g}
                  {g === "Overdue" && <Tag tone="bad">{items.length}</Tag>}
                </h2>
                <ul>
                  {items.map((t) => {
                    const on = t.id === selected;
                    const dot = DOTS[taskTabFor(t.portal)];
                    return (
                      <li
                        key={t.id}
                        className={`flex items-center gap-4 border-b border-line px-3 py-3.5 ${on ? "-mx-0 rounded-[14px] border-transparent bg-surface" : ""}`}
                      >
                        <button
                          type="button"
                          onClick={() => void patch(t.id, { status: "DONE" })}
                          aria-label={`Mark "${t.title}" as done`}
                          className="flex size-6 shrink-0 items-center justify-center rounded-full border-[1.5px] border-[#9AA4B2] bg-background hover:border-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                        />
                        <button type="button" onClick={() => setSelected(on ? null : t.id)} aria-expanded={on} className="min-w-0 flex-1 text-left">
                          <span className={`block truncate ${t.taskType === "TRACK" ? "text-ink-2" : "font-semibold"}`}>{t.title}</span>
                          <span className="mt-0.5 flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
                            {dot && <span className="size-2 shrink-0 rounded-full" style={{ background: dot }} aria-hidden />}
                            <span className="truncate">
                              {t.taskType === "TRACK" ? "Waiting on · " : ""}
                              {contextLine(t)}
                            </span>
                          </span>
                        </button>
                        {(t.priority === "HIGH" || t.priority === "URGENT") && <Tag tone={on ? "plain" : "neutral"}>{PRIORITY[t.priority]}</Tag>}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}

            {done.length > 0 && (
              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => setShowDone((v) => !v)}
                  aria-expanded={showDone}
                  className="inline-flex min-h-11 items-center gap-2 text-[15px] font-semibold hover:text-brand"
                >
                  {showDone ? "Hide" : "Show"} {done.length} done
                </button>
                {showDone && (
                  <ul>
                    {done.map((t) => (
                      <li key={t.id} className="flex items-center gap-4 border-b border-line px-3 py-3">
                        <button
                          type="button"
                          onClick={() => void patch(t.id, { status: "TODO" })}
                          aria-label={`Reopen "${t.title}"`}
                          className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ok text-background"
                        >
                          <Check className="size-3.5" strokeWidth={3} />
                        </button>
                        <span className="min-w-0 flex-1 truncate text-muted-foreground line-through">{t.title}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {current && (
            <aside className="sticky top-6 mt-4 min-w-0 flex-[1_1_320px] rounded-2xl bg-surface p-6" aria-label="Task details">
              <div className="mb-3 flex items-start justify-between gap-3">
                {groupOf(current) === "Overdue" && current.status !== "DONE" ? <Tag tone="bad">Overdue</Tag> : <Tag tone="plain">{current.taskType === "TRACK" ? "Waiting on" : "To do"}</Tag>}
                <button type="button" onClick={() => setSelected(null)} aria-label="Close details" className="-m-2 flex size-10 items-center justify-center rounded-full hover:bg-background">
                  <X className="size-5" strokeWidth={1.75} />
                </button>
              </div>
              <h2 className="text-[22px] font-semibold leading-tight">{current.title}</h2>
              {current.description && <p className="mt-2 text-[15px] text-ink-2">{current.description}</p>}

              <div className="mt-4 [&>*+*]:border-t [&>*+*]:border-line">
                {(current.project || current.production) && (
                  <KV k={current.production ? "Production" : "Deal"} v={current.production?.title ?? current.project?.title} />
                )}
                <div className="flex items-center justify-between gap-6 py-2.5 text-[15px]">
                  <label htmlFor="task-due" className="text-muted-foreground">
                    Due
                  </label>
                  <input
                    id="task-due"
                    type="date"
                    value={current.dueDate ? current.dueDate.slice(0, 10) : ""}
                    onChange={(e) => void patch(current.id, { dueDate: e.target.value || null })}
                    className="h-9 rounded-lg border border-field bg-background px-2 text-sm"
                  />
                </div>
                <div className="flex items-center justify-between gap-6 py-2.5 text-[15px]">
                  <label htmlFor="task-priority" className="text-muted-foreground">
                    Priority
                  </label>
                  <select
                    id="task-priority"
                    value={current.priority}
                    onChange={(e) => void patch(current.id, { priority: e.target.value })}
                    className="h-9 rounded-lg border border-field bg-background px-2 text-sm"
                  >
                    {Object.entries(PRIORITY).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
                {current.createdBy && <KV k="Assigned by" v={current.createdBy.name} />}
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {current.production ? (
                  <Link href={`/production/${current.production.id}`} className={pill("primary", "sm")}>
                    Open production
                  </Link>
                ) : current.project ? (
                  <Link href={`/commercial/deals/${current.project.id}`} className={pill("primary", "sm")}>
                    Open deal
                  </Link>
                ) : null}
                {current.status !== "DONE" ? (
                  <button type="button" onClick={() => void patch(current.id, { status: "DONE" })} className={pill("secondary", "sm")}>
                    Mark done
                  </button>
                ) : (
                  <button type="button" onClick={() => void patch(current.id, { status: "TODO" })} className={pill("secondary", "sm")}>
                    Reopen
                  </button>
                )}
                <button type="button" onClick={() => void remove(current)} className={pill("ghost", "sm")} aria-label="Delete task">
                  <Trash2 strokeWidth={1.75} />
                </button>
              </div>
            </aside>
          )}
        </div>
      </div>
    </Page>
  );
}

export default function MyTasksPage() {
  return (
    <Suspense fallback={null}>
      <Tasks />
    </Suspense>
  );
}
