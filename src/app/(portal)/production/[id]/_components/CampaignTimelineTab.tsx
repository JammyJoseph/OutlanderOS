"use client";

import { useMemo, useState } from "react";
import {
  Plus,
  Trash2,
  Wand2,
  ChevronDown,
  ChevronRight,
  Check,
  Loader2,
  CalendarClock,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import {
  ProductionMilestone,
  MilestonePhase,
  MilestoneStatus,
  MILESTONE_PHASES,
  MILESTONE_PHASE_STYLES,
  milestoneStatus,
  parseMilestones,
} from "./types";

interface Props {
  productionId: string;
  milestones: ProductionMilestone[];
  refresh: () => void;
}

const STATUS_BADGE: Record<MilestoneStatus, { bg: string; text: string; label: string }> = {
  PENDING: { bg: "bg-gray-100", text: "text-gray-500", label: "Pending" },
  DONE: { bg: "bg-emerald-50", text: "text-emerald-700", label: "Done" },
  OVERDUE: { bg: "bg-red-50", text: "text-red-600", label: "Overdue" },
};

const inputCls =
  "px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#ffd700]/30 focus:border-[#ffd700]";

export default function CampaignTimelineTab({ productionId, milestones, refresh }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);

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
    if (!confirm("Delete this milestone?")) return;
    await fetch(`/api/productions/${productionId}/milestones?milestoneId=${id}`, {
      method: "DELETE",
    });
    refresh();
  }

  async function runImport() {
    const parsed = parseMilestones(raw);
    if (!parsed.length) {
      alert("No milestones found. Check each line has a recognisable date (e.g. WED 1 JUL).");
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

  const byPhase = useMemo(() => {
    const map: Record<MilestonePhase, ProductionMilestone[]> = {
      PRE_PRODUCTION: [],
      PRODUCTION: [],
      POST_PRODUCTION: [],
    };
    for (const m of milestones) {
      (map[m.phase] ?? map.PRE_PRODUCTION).push(m);
    }
    for (const k of Object.keys(map) as MilestonePhase[]) {
      map[k].sort((a, b) => a.date.localeCompare(b.date));
    }
    return map;
  }, [milestones]);

  const overdueCount = milestones.filter((m) => milestoneStatus(m) === "OVERDUE").length;
  const doneCount = milestones.filter((m) => m.done).length;

  return (
    <div className="space-y-5">
      {/* Summary + actions */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <CalendarClock size={15} className="text-[#ffd700]" />
              Campaign Timeline
            </h2>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Full project timeline — pre-production through delivery and go-live. The on-the-day
              shoot schedule lives on the call sheet.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {milestones.length > 0 && (
              <div className="flex items-center gap-2 text-[11px]">
                {overdueCount > 0 && (
                  <span className="font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600">
                    {overdueCount} overdue
                  </span>
                )}
                <span className="font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                  {doneCount}/{milestones.length} done
                </span>
              </div>
            )}
            <button
              onClick={() => setShowAdd((v) => !v)}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#ffd700] hover:text-[#e6c200]"
            >
              <Plus size={13} /> Add milestone
            </button>
          </div>
        </div>

        {showAdd && <AddMilestoneForm onAdd={add} onCancel={() => setShowAdd(false)} />}

        {/* Paste importer */}
        <div className="px-5 py-3 border-b border-gray-50">
          <button
            onClick={() => setImportOpen((o) => !o)}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800"
          >
            {importOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            <Wand2 size={13} /> Paste a timeline to auto-format
          </button>
          {importOpen && (
            <div className="mt-3 space-y-2">
              <p className="text-[11px] text-gray-400 leading-snug">
                One milestone per line:{" "}
                <span className="font-mono">PHASE — DATE — TITLE — DESCRIPTION</span>. Phase and
                description are optional; a phase line carries down to the lines beneath it.
              </p>
              <textarea
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                placeholder={
                  "PRE-PRODUCTION — WED 1 JUL — PUMA FEEDBACK ON V1 DECK — Schedule, route, locations, crew approved\nPRE-PRODUCTION — TUE 7 JUL — SHOOT DAY — Shoot\nPOST-PRODUCTION — WED 15 JUL — V1 ASSETS DELIVERED\nPOST-PRODUCTION — FRI 24 JUL — GO LIVE — Launch"
                }
                rows={7}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-mono bg-white resize-y focus:outline-none focus:ring-2 focus:ring-[#ffd700]/30 focus:border-[#ffd700]"
              />
              <button
                onClick={runImport}
                disabled={busy || !raw.trim()}
                className="inline-flex items-center gap-1.5 bg-[#ffd700] text-black px-3.5 py-1.5 rounded-lg text-xs font-medium hover:bg-[#e6c200] disabled:opacity-40"
              >
                {busy ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
                Parse into milestones
              </button>
            </div>
          )}
        </div>

        {milestones.length === 0 && !showAdd ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-gray-500">No milestones yet.</p>
            <button
              onClick={() => setShowAdd(true)}
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#ffd700] hover:text-[#e6c200]"
            >
              <Plus size={12} /> Add your first milestone
            </button>
          </div>
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
                    <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">
                      {style.label}
                    </h3>
                    <span className="text-[10px] text-gray-400">{items.length}</span>
                  </div>
                  <div className="relative">
                    <div className="absolute left-[104px] top-1 bottom-1 w-px bg-gray-100" />
                    <div className="space-y-2.5">
                      {items.map((m) => (
                        <MilestoneRow
                          key={m.id}
                          milestone={m}
                          onUpdate={(patch) => update(m.id, patch)}
                          onRemove={() => remove(m.id)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function MilestoneRow({
  milestone,
  onUpdate,
  onRemove,
}: {
  milestone: ProductionMilestone;
  onUpdate: (patch: Partial<ProductionMilestone>) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(milestone.title);
  const [description, setDescription] = useState(milestone.description ?? "");
  const [date, setDate] = useState(milestone.date.split("T")[0]);
  const [phase, setPhase] = useState<MilestonePhase>(milestone.phase);

  const status = milestoneStatus(milestone);
  const badge = STATUS_BADGE[status];
  const phaseStyle = MILESTONE_PHASE_STYLES[milestone.phase];

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

  return (
    <div className="group flex items-start gap-4">
      {/* Date */}
      <div className="w-24 shrink-0 pt-2 text-right">
        <span
          className={`text-xs font-semibold tabular-nums ${
            status === "OVERDUE" ? "text-red-500" : "text-gray-700"
          }`}
        >
          {dateLabel}
        </span>
      </div>
      {/* Node */}
      <div className="relative flex flex-col items-center pt-3 shrink-0">
        <span
          className={`w-2.5 h-2.5 rounded-full ring-4 ring-white ${
            status === "OVERDUE"
              ? "bg-red-400"
              : status === "DONE"
              ? "bg-emerald-400"
              : phaseStyle.dot
          }`}
        />
      </div>
      {/* Card */}
      <div
        className={`flex-1 min-w-0 rounded-xl p-3 transition-colors -ml-1 border ${
          status === "OVERDUE"
            ? "bg-red-50/40 border-red-100"
            : status === "DONE"
            ? "bg-gray-50/60 border-gray-100"
            : "bg-gray-50/50 border-gray-100 hover:bg-amber-50/20"
        }`}
      >
        {editing ? (
          <div className="space-y-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Milestone title"
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
              <button
                onClick={saveEdits}
                className="bg-[#ffd700] text-black text-xs font-medium px-3 py-2 rounded-xl hover:bg-[#e6c200]"
              >
                Save
              </button>
              <button
                onClick={() => setEditing(false)}
                className="text-xs text-gray-400 hover:text-gray-600 px-2 py-2"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <button
              onClick={() => onUpdate({ done: !milestone.done })}
              title={milestone.done ? "Mark not done" : "Mark done"}
              className={`mt-0.5 shrink-0 w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                milestone.done
                  ? "bg-emerald-500 border-emerald-500 text-white"
                  : "border-gray-300 hover:border-emerald-400 text-transparent"
              }`}
            >
              <Check size={11} />
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setEditing(true)}
                  className={`text-sm font-medium text-left ${
                    milestone.done ? "text-gray-400 line-through" : "text-gray-900"
                  }`}
                >
                  {milestone.title}
                </button>
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${badge.bg} ${badge.text}`}
                >
                  {badge.label}
                </span>
              </div>
              {milestone.description && (
                <p
                  className={`text-xs mt-1 whitespace-pre-wrap ${
                    milestone.done ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  {milestone.description}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
      <button
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 p-1 mt-3"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

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

  function submit() {
    if (!title.trim() || !date) return;
    onAdd({
      phase,
      date: new Date(date + "T12:00:00").toISOString(),
      title: title.trim(),
      description: description.trim() || null,
    });
  }

  return (
    <div className="px-5 py-4 bg-amber-50/30 border-b border-gray-50 grid grid-cols-1 md:grid-cols-12 gap-2 items-start">
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
        placeholder="Title (e.g. PUMA FEEDBACK ON V1 DECK)"
        className={`md:col-span-3 ${inputCls}`}
      />
      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description"
        className={`md:col-span-3 ${inputCls}`}
      />
      <div className="md:col-span-1 flex items-center gap-1 justify-end pt-0.5">
        <button
          onClick={submit}
          className="bg-[#ffd700] text-black text-xs font-medium px-3 py-2 rounded-xl hover:bg-[#e6c200] transition-colors"
        >
          Add
        </button>
        <button onClick={onCancel} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-2">
          Cancel
        </button>
      </div>
    </div>
  );
}
