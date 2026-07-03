"use client";

import { useMemo, useState } from "react";
import {
  Plus,
  Trash2,
  Wand2,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Check,
  Loader2,
  CalendarClock,
  CalendarDays,
  ListChecks,
  Flag,
  Circle,
  Sparkles,
  RefreshCw,
  CornerDownRight,
} from "lucide-react";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
} from "date-fns";
import {
  ProductionMilestone,
  MilestonePhase,
  MilestoneStatus,
  MILESTONE_PHASES,
  MILESTONE_PHASE_STYLES,
  milestoneStatus,
  parseMilestones,
} from "./types";
import { ActionTrackPanel } from "@/components/tasks/ActionTrackPanel";
import { useConfirm } from "@/components/ui/confirm-provider";

interface Props {
  productionId: string;
  milestones: ProductionMilestone[];
  shootDates: string[];
  refresh: () => void;
}

const STATUS_BADGE: Record<MilestoneStatus, { bg: string; text: string; label: string }> = {
  PENDING: { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-500 dark:text-gray-400", label: "Pending" },
  DONE: { bg: "bg-emerald-50 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-300", label: "Done" },
  OVERDUE: { bg: "bg-red-50 dark:bg-red-900/30", text: "text-red-600 dark:text-red-400", label: "Overdue" },
};

const inputCls =
  "px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ffd700]/30 focus:border-[#ffd700]";

// Deadline tone: overdue (red), due within 2 days (yellow), otherwise neutral.
type DeadlineTone = "overdue" | "soon" | "ok";
function deadlineTone(dateISO: string, done: boolean): DeadlineTone {
  if (done) return "ok";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateISO);
  d.setHours(0, 0, 0, 0);
  const diffDays = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (diffDays < 0) return "overdue";
  if (diffDays <= 2) return "soon";
  return "ok";
}

export default function TimelineTab({ productionId, milestones, shootDates, refresh }: Props) {
  const confirm = useConfirm();
  const [view, setView] = useState<"list" | "calendar">("list");
  const [showAdd, setShowAdd] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const hasShootDate = (shootDates ?? []).filter(Boolean).length > 0;
  const hasTemplate = milestones.some((m) => m.templateKey);

  async function add(form: Partial<ProductionMilestone>) {
    await fetch(`/api/productions/${productionId}/milestones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setShowAdd(false);
    refresh();
  }

  async function update(id: string, patch: Partial<ProductionMilestone>) {
    await fetch(`/api/productions/${productionId}/milestones?milestoneId=${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    refresh();
  }

  async function remove(id: string) {
    const ok = await confirm({
      title: "Delete this item?",
      message: "This removes it (and any sub-tasks) from the timeline. This cannot be undone.",
      confirmLabel: "Delete",
      confirmVariant: "danger",
    });
    if (!ok) return;
    await fetch(`/api/productions/${productionId}/milestones?milestoneId=${id}`, {
      method: "DELETE",
    });
    refresh();
  }

  async function generateTemplate(recalc = false) {
    setSeeding(true);
    try {
      await fetch(`/api/productions/${productionId}/milestones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: recalc ? "recalculate" : "applyTemplate" }),
      });
      refresh();
    } finally {
      setSeeding(false);
    }
  }

  async function runImport() {
    setImportError(null);
    const parsed = parseMilestones(raw);
    if (!parsed.length) {
      setImportError("No milestones found. Check each line has a recognisable date (e.g. WED 1 JUL).");
      return;
    }
    setBusy(true);
    try {
      await fetch(`/api/productions/${productionId}/milestones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ milestones: parsed }),
      });
      setRaw("");
      setImportOpen(false);
      refresh();
    } finally {
      setBusy(false);
    }
  }

  // Top-level items grouped by phase; children collected per parent.
  const { byPhase, childrenOf } = useMemo(() => {
    const children = new Map<string, ProductionMilestone[]>();
    for (const m of milestones) {
      if (m.parentId) {
        if (!children.has(m.parentId)) children.set(m.parentId, []);
        children.get(m.parentId)!.push(m);
      }
    }
    for (const list of children.values()) list.sort((a, b) => a.date.localeCompare(b.date));

    const map: Record<MilestonePhase, ProductionMilestone[]> = {
      PRE_PRODUCTION: [],
      PRODUCTION: [],
      POST_PRODUCTION: [],
    };
    for (const m of milestones) {
      if (m.parentId) continue; // rendered under its parent
      (map[m.phase] ?? map.PRE_PRODUCTION).push(m);
    }
    for (const k of Object.keys(map) as MilestonePhase[]) {
      map[k].sort((a, b) => a.date.localeCompare(b.date));
    }
    return { byPhase: map, childrenOf: children };
  }, [milestones]);

  const overdueCount = milestones.filter((m) => milestoneStatus(m) === "OVERDUE").length;
  const soonCount = milestones.filter(
    (m) => !m.done && deadlineTone(m.date, m.done) === "soon"
  ).length;
  const doneCount = milestones.filter((m) => m.done).length;

  return (
    <div className="space-y-5">
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        {/* Header: title, stats, view toggle */}
        <div className="px-5 py-4 border-b border-gray-50 dark:border-gray-800 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
              <CalendarClock size={15} className="text-[#ffd700]" />
              Timeline
            </h2>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
              Tasks and milestones from pre-production through delivery and go-live.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {milestones.length > 0 && (
              <div className="flex items-center gap-2 text-[11px]">
                {overdueCount > 0 && (
                  <span className="font-semibold px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                    {overdueCount} overdue
                  </span>
                )}
                {soonCount > 0 && (
                  <span className="font-semibold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                    {soonCount} due soon
                  </span>
                )}
                <span className="font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                  {doneCount}/{milestones.length} done
                </span>
              </div>
            )}
            <div className="flex items-center rounded-xl border border-gray-200 dark:border-gray-700 p-0.5">
              <button
                onClick={() => setView("list")}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  view === "list" ? "bg-[#ffd700] text-black" : "text-gray-500 dark:text-gray-400"
                }`}
              >
                <ListChecks size={13} /> List
              </button>
              <button
                onClick={() => setView("calendar")}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  view === "calendar" ? "bg-[#ffd700] text-black" : "text-gray-500 dark:text-gray-400"
                }`}
              >
                <CalendarDays size={13} /> Calendar
              </button>
            </div>
            <button
              onClick={() => setShowAdd((v) => !v)}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#ffd700] hover:text-[#ffd700]"
            >
              <Plus size={13} /> Add
            </button>
          </div>
        </div>

        {/* Standard-timeline generator */}
        <div className="px-5 py-3 border-b border-gray-50 dark:border-gray-800 flex items-center gap-2 flex-wrap">
          {!hasTemplate ? (
            <button
              onClick={() => generateTemplate(false)}
              disabled={seeding || !hasShootDate}
              title={hasShootDate ? "" : "Set a shoot date first (Overview tab)"}
              className="inline-flex items-center gap-1.5 bg-[#ffd700] text-black px-3.5 py-1.5 rounded-lg text-xs font-medium hover:bg-[#ffd700] disabled:opacity-40"
            >
              {seeding ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              Generate standard timeline
            </button>
          ) : (
            <button
              onClick={() => generateTemplate(true)}
              disabled={seeding || !hasShootDate}
              title="Realign template task deadlines to the current shoot date"
              className="inline-flex items-center gap-1.5 border border-gray-200 dark:border-gray-700 px-3.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40"
            >
              {seeding ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              Recalculate deadlines
            </button>
          )}
          {!hasShootDate && (
            <span className="text-[11px] text-gray-400 dark:text-gray-500">
              Set a shoot date on the Overview tab to auto-schedule standard tasks.
            </span>
          )}
        </div>

        {showAdd && <AddMilestoneForm onAdd={add} onCancel={() => setShowAdd(false)} />}

        {/* Paste importer */}
        <div className="px-5 py-3 border-b border-gray-50 dark:border-gray-800">
          <button
            onClick={() => setImportOpen((o) => !o)}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            {importOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            <Wand2 size={13} /> Paste a timeline to auto-format
          </button>
          {importOpen && (
            <div className="mt-3 space-y-2">
              <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-snug">
                One item per line:{" "}
                <span className="font-mono">PHASE — DATE — TITLE — DESCRIPTION</span>. Phase and
                description are optional; a phase line carries down to the lines beneath it.
              </p>
              <textarea
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                placeholder={
                  "PRE-PRODUCTION — WED 1 JUL — PUMA FEEDBACK ON V1 DECK — Schedule, route, locations, crew approved\nPRODUCTION — TUE 7 JUL — SHOOT DAY — Shoot\nPOST-PRODUCTION — WED 15 JUL — V1 ASSETS DELIVERED\nPOST-PRODUCTION — FRI 24 JUL — GO LIVE — Launch"
                }
                rows={6}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-mono bg-white dark:bg-gray-900 resize-y focus:outline-none focus:ring-2 focus:ring-[#ffd700]/30 focus:border-[#ffd700]"
              />
              {importError && (
                <p className="text-xs font-medium text-red-600 dark:text-red-400">{importError}</p>
              )}
              <button
                onClick={runImport}
                disabled={busy || !raw.trim()}
                className="inline-flex items-center gap-1.5 bg-[#ffd700] text-black px-3.5 py-1.5 rounded-lg text-xs font-medium hover:bg-[#ffd700] disabled:opacity-40"
              >
                {busy ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
                Parse into timeline
              </button>
            </div>
          )}
        </div>

        {/* Body: list or calendar */}
        {milestones.length === 0 && !showAdd ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">No timeline items yet.</p>
            <button
              onClick={() => setShowAdd(true)}
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#ffd700] hover:text-[#ffd700]"
            >
              <Plus size={12} /> Add your first item
            </button>
          </div>
        ) : view === "calendar" ? (
          <TimelineCalendar milestones={milestones} onToggleDone={(id, done) => update(id, { done })} />
        ) : (
          <div className="px-5 py-5 space-y-6">
            {MILESTONE_PHASES.map(({ key }) => {
              const items = byPhase[key];
              if (items.length === 0) return null;
              const style = MILESTONE_PHASE_STYLES[key];
              return (
                <div key={key}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
                    <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                      {style.label}
                    </h3>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">{items.length}</span>
                  </div>
                  <div className="space-y-2.5">
                    {items.map((m) => (
                      <MilestoneRow
                        key={m.id}
                        milestone={m}
                        subtasks={childrenOf.get(m.id) ?? []}
                        onUpdate={(patch) => update(m.id, patch)}
                        onUpdateChild={(cid, patch) => update(cid, patch)}
                        onRemove={() => remove(m.id)}
                        onRemoveChild={(cid) => remove(cid)}
                        onAddSubtask={(title) =>
                          add({
                            title,
                            phase: m.phase,
                            date: m.date,
                            parentId: m.id,
                          })
                        }
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Working tasks — keeps the ACTION / TRACK / DONE system alongside the
          scheduled timeline. */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-2">
          <ListChecks size={13} className="text-[#ffd700]" />
          Working Tasks
        </h3>
        <ActionTrackPanel productionId={productionId} />
      </div>
    </div>
  );
}

// ─── Milestone / task row (with sub-tasks) ────────────────────────────────────

function MilestoneRow({
  milestone,
  subtasks,
  onUpdate,
  onUpdateChild,
  onRemove,
  onRemoveChild,
  onAddSubtask,
}: {
  milestone: ProductionMilestone;
  subtasks: ProductionMilestone[];
  onUpdate: (patch: Partial<ProductionMilestone>) => void;
  onUpdateChild: (id: string, patch: Partial<ProductionMilestone>) => void;
  onRemove: () => void;
  onRemoveChild: (id: string) => void;
  onAddSubtask: (title: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(milestone.title);
  const [description, setDescription] = useState(milestone.description ?? "");
  const [date, setDate] = useState(milestone.date.split("T")[0]);
  const [phase, setPhase] = useState<MilestonePhase>(milestone.phase);
  const [addingSub, setAddingSub] = useState(false);
  const [subTitle, setSubTitle] = useState("");

  const status = milestoneStatus(milestone);
  const badge = STATUS_BADGE[status];
  const tone = deadlineTone(milestone.date, milestone.done);
  const isDiamond = !!milestone.isMilestone;

  const dateLabel = (() => {
    try {
      return format(parseISO(milestone.date), "EEE d MMM").toUpperCase();
    } catch {
      return "—";
    }
  })();

  function saveEdits() {
    const patch: Partial<ProductionMilestone> = {};
    if (title !== milestone.title) patch.title = title;
    if ((description || "") !== (milestone.description || "")) patch.description = description;
    if (date !== milestone.date.split("T")[0]) patch.date = new Date(date + "T12:00:00").toISOString();
    if (phase !== milestone.phase) patch.phase = phase;
    if (Object.keys(patch).length > 0) onUpdate(patch);
    setEditing(false);
  }

  const cardTone =
    tone === "overdue"
      ? "bg-red-50/40 dark:bg-red-900/20 border-red-200 dark:border-red-800"
      : tone === "soon"
      ? "bg-amber-50/40 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
      : milestone.done
      ? "bg-gray-50/60 dark:bg-gray-800/60 border-gray-100 dark:border-gray-800"
      : "bg-gray-50/50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-800";

  return (
    <div className="group flex items-start gap-3">
      {/* Date */}
      <div className="w-24 shrink-0 pt-2.5 text-right">
        <span
          className={`text-xs font-semibold tabular-nums ${
            tone === "overdue"
              ? "text-red-500 dark:text-red-400"
              : tone === "soon"
              ? "text-amber-600 dark:text-amber-400"
              : "text-gray-700 dark:text-gray-300"
          }`}
        >
          {dateLabel}
        </span>
      </div>
      {/* Glyph: diamond for milestones, circle for tasks */}
      <div className="pt-3 shrink-0">
        {isDiamond ? (
          <Flag size={13} className="text-[#ffd700]" />
        ) : (
          <Circle size={11} className="text-gray-300 dark:text-gray-600 mt-0.5" />
        )}
      </div>
      {/* Card */}
      <div className={`flex-1 min-w-0 rounded-xl p-3 border transition-colors ${cardTone}`}>
        {editing ? (
          <div className="space-y-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              className={`${inputCls} w-full font-medium`}
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
              className={`${inputCls} w-full resize-none`}
            />
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={phase}
                onChange={(e) => setPhase(e.target.value as MilestonePhase)}
                className={inputCls}
              >
                {MILESTONE_PHASES.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={inputCls}
              />
              <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                <input
                  type="checkbox"
                  checked={isDiamond}
                  onChange={(e) => onUpdate({ isMilestone: e.target.checked })}
                />
                Milestone
              </label>
              <button
                onClick={saveEdits}
                className="bg-[#ffd700] text-black text-xs font-medium px-3 py-2 rounded-xl hover:bg-[#ffd700]"
              >
                Save
              </button>
              <button
                onClick={() => setEditing(false)}
                className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 px-2 py-2"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <button
                onClick={() => onUpdate({ done: !milestone.done })}
                title={milestone.done ? "Mark not done" : "Mark done"}
                className={`mt-0.5 shrink-0 w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                  milestone.done
                    ? "bg-emerald-500 border-emerald-500 text-white"
                    : "border-gray-300 dark:border-gray-600 hover:border-emerald-400 text-transparent"
                }`}
              >
                <Check size={11} />
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setEditing(true)}
                    className={`text-sm font-medium text-left ${
                      milestone.done ? "text-gray-400 dark:text-gray-500 line-through" : "text-gray-900 dark:text-gray-100"
                    }`}
                  >
                    {milestone.title}
                  </button>
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${badge.bg} ${badge.text}`}
                  >
                    {tone === "soon" && status === "PENDING" ? "Due soon" : badge.label}
                  </span>
                </div>
                {milestone.description && (
                  <p
                    className={`text-xs mt-1 whitespace-pre-wrap ${
                      milestone.done ? "text-gray-400 dark:text-gray-500" : "text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {milestone.description}
                  </p>
                )}
              </div>
            </div>

            {/* Sub-tasks */}
            {subtasks.length > 0 && (
              <div className="mt-2.5 ml-7 space-y-1.5 border-l border-gray-200 dark:border-gray-700 pl-3">
                {subtasks.map((s) => (
                  <div key={s.id} className="group/sub flex items-center gap-2">
                    <button
                      onClick={() => onUpdateChild(s.id, { done: !s.done })}
                      className={`shrink-0 w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${
                        s.done
                          ? "bg-emerald-500 border-emerald-500 text-white"
                          : "border-gray-300 dark:border-gray-600 hover:border-emerald-400 text-transparent"
                      }`}
                    >
                      <Check size={9} />
                    </button>
                    <span
                      className={`text-xs flex-1 min-w-0 truncate ${
                        s.done ? "text-gray-400 dark:text-gray-500 line-through" : "text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {s.title}
                    </span>
                    <button
                      onClick={() => onRemoveChild(s.id)}
                      className="opacity-0 group-hover/sub:opacity-100 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add sub-task */}
            <div className="mt-2 ml-7">
              {addingSub ? (
                <div className="flex items-center gap-2">
                  <CornerDownRight size={12} className="text-gray-300 dark:text-gray-600 shrink-0" />
                  <input
                    autoFocus
                    value={subTitle}
                    onChange={(e) => setSubTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && subTitle.trim()) {
                        onAddSubtask(subTitle.trim());
                        setSubTitle("");
                        setAddingSub(false);
                      }
                      if (e.key === "Escape") {
                        setSubTitle("");
                        setAddingSub(false);
                      }
                    }}
                    placeholder="Sub-task… (Enter to add)"
                    className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-[#ffd700]/30"
                  />
                </div>
              ) : (
                <button
                  onClick={() => setAddingSub(true)}
                  className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-1 text-[11px] font-medium text-gray-400 dark:text-gray-500 hover:text-[#ffd700] transition-opacity"
                >
                  <Plus size={11} /> Sub-task
                </button>
              )}
            </div>
          </>
        )}
      </div>
      <button
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 p-1 mt-3"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

// ─── Add form ─────────────────────────────────────────────────────────────────

function AddMilestoneForm({
  onAdd,
  onCancel,
}: {
  onAdd: (form: Partial<ProductionMilestone>) => void;
  onCancel: () => void;
}) {
  const [phase, setPhase] = useState<MilestonePhase>("PRE_PRODUCTION");
  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isMilestone, setIsMilestone] = useState(false);

  function submit() {
    if (!title.trim() || !date) return;
    onAdd({
      phase,
      date: new Date(date + "T12:00:00").toISOString(),
      title: title.trim(),
      description: description.trim() || null,
      isMilestone,
    });
  }

  return (
    <div className="px-5 py-4 bg-amber-50/30 dark:bg-amber-900/20 border-b border-gray-50 dark:border-gray-800 grid grid-cols-1 md:grid-cols-12 gap-2 items-start">
      <select
        value={phase}
        onChange={(e) => setPhase(e.target.value as MilestonePhase)}
        className={`md:col-span-3 ${inputCls}`}
      >
        {MILESTONE_PHASES.map((p) => (
          <option key={p.key} value={p.key}>
            {p.label}
          </option>
        ))}
      </select>
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className={`md:col-span-2 ${inputCls} tabular-nums`}
      />
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        className={`md:col-span-3 ${inputCls}`}
      />
      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description"
        className={`md:col-span-2 ${inputCls}`}
      />
      <div className="md:col-span-2 flex items-center gap-2 justify-end pt-0.5">
        <label className="flex items-center gap-1 text-[11px] text-gray-600 dark:text-gray-400" title="Show as a milestone (diamond)">
          <input type="checkbox" checked={isMilestone} onChange={(e) => setIsMilestone(e.target.checked)} />
          Milestone
        </label>
        <button
          onClick={submit}
          className="bg-[#ffd700] text-black text-xs font-medium px-3 py-2 rounded-xl hover:bg-[#ffd700] transition-colors"
        >
          Add
        </button>
        <button onClick={onCancel} className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 px-1 py-2">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Calendar sub-view (single production) ────────────────────────────────────

function TimelineCalendar({
  milestones,
  onToggleDone,
}: {
  milestones: ProductionMilestone[];
  onToggleDone: (id: string, done: boolean) => void;
}) {
  const [month, setMonth] = useState<Date>(() => {
    // Open on the month of the earliest pending item, else today.
    const pending = milestones
      .filter((m) => !m.done)
      .map((m) => parseISO(m.date))
      .sort((a, b) => a.getTime() - b.getTime())[0];
    return pending ?? new Date();
  });
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const byDay = useMemo(() => {
    const map = new Map<string, ProductionMilestone[]>();
    for (const m of milestones) {
      const k = format(parseISO(m.date), "yyyy-MM-dd");
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(m);
    }
    return map;
  }, [milestones]);

  const calStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const calEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });
  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const selected = selectedKey ? byDay.get(selectedKey) ?? [] : [];

  return (
    <div>
      <div className="px-5 py-3 flex items-center justify-between border-b border-gray-50 dark:border-gray-800">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          {format(month, "MMMM yyyy")}
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMonth(new Date())}
            className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 px-2 py-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Today
          </button>
          <button
            onClick={() => setMonth((m) => subMonths(m, 1))}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400"
            aria-label="Previous month"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            onClick={() => setMonth((m) => addMonths(m, 1))}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400"
            aria-label="Next month"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      <div className="px-3 pt-3 grid grid-cols-7">
        {dayLabels.map((d) => (
          <div
            key={d}
            className="text-center text-[10px] font-semibold text-gray-400 dark:text-gray-500 py-1 uppercase tracking-wide"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="px-3 pb-3 grid grid-cols-7 gap-1">
        {days.map((day) => {
          const k = format(day, "yyyy-MM-dd");
          const list = byDay.get(k) ?? [];
          const inMonth = isSameMonth(day, month);
          const current = isToday(day);
          const isSelected = selectedKey === k;
          return (
            <button
              key={k}
              onClick={() => setSelectedKey(isSelected ? null : list.length ? k : null)}
              className={`text-left flex flex-col rounded-lg border p-1.5 min-h-[80px] transition-all ${
                isSelected
                  ? "border-[#ffd700] bg-amber-50/60 dark:bg-amber-900/20"
                  : "border-transparent hover:border-gray-200 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50"
              }`}
            >
              <span
                className={`text-xs font-semibold leading-none mb-1 inline-flex items-center justify-center h-5 w-5 rounded-full ${
                  current
                    ? "bg-[#ffd700] text-black"
                    : !inMonth
                    ? "text-gray-300 dark:text-gray-600"
                    : "text-gray-700 dark:text-gray-300"
                }`}
              >
                {format(day, "d")}
              </span>
              <div className="flex flex-col gap-0.5 w-full">
                {list.slice(0, 3).map((m) => {
                  const tone = deadlineTone(m.date, m.done);
                  return (
                    <span
                      key={m.id}
                      className={`flex items-center gap-1 text-[10px] leading-tight rounded px-1 py-0.5 truncate ${
                        m.done ? "opacity-40 line-through" : ""
                      } ${
                        tone === "overdue"
                          ? "bg-red-50 dark:bg-red-900/30"
                          : tone === "soon"
                          ? "bg-amber-50 dark:bg-amber-900/30"
                          : "bg-gray-50 dark:bg-gray-800"
                      }`}
                      title={m.title}
                    >
                      {m.isMilestone ? (
                        <span className="inline-block w-2 h-2 rotate-45 bg-[#ffd700] shrink-0" />
                      ) : (
                        <span className="inline-block w-2 h-2 rounded-full border border-gray-400 shrink-0" />
                      )}
                      <span className="truncate text-gray-700 dark:text-gray-300">{m.title}</span>
                    </span>
                  );
                })}
                {list.length > 3 && (
                  <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 px-1">
                    +{list.length - 3} more
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {selectedKey && (
        <div className="px-5 py-4 border-t border-gray-50 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            {format(parseISO(selectedKey), "EEEE d MMMM")}
          </p>
          {selected.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-gray-500">Nothing scheduled.</p>
          ) : (
            <div className="space-y-1.5">
              {selected.map((m) => (
                <div key={m.id} className="flex items-center gap-2.5">
                  <button
                    onClick={() => onToggleDone(m.id, !m.done)}
                    className={`shrink-0 w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                      m.done
                        ? "bg-emerald-500 border-emerald-500 text-white"
                        : "border-gray-300 dark:border-gray-600 hover:border-emerald-400 text-transparent"
                    }`}
                  >
                    <Check size={11} />
                  </button>
                  {m.isMilestone ? (
                    <Flag size={12} className="text-[#ffd700] shrink-0" />
                  ) : (
                    <Circle size={10} className="text-gray-300 dark:text-gray-600 shrink-0" />
                  )}
                  <span
                    className={`text-sm flex-1 min-w-0 truncate ${
                      m.done ? "text-gray-400 dark:text-gray-500 line-through" : "text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {m.title}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
