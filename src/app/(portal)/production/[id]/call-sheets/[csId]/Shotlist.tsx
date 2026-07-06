"use client";

import { useCallback, useEffect, useState } from "react";
import type { CallSheetLocation, Shot, ShotStatus, ShotStyle } from "./types";
import { SHOT_STATUS_LABELS, emptyShot, parseShotList } from "./types";
import { Copy, ChevronDown, ChevronRight, Wand2, Package, Loader2, Sparkles } from "lucide-react";
import { AddButton, DeleteButton, smallInputCls, inputCls, labelCls } from "./shared";

// A deliverable this shot can feed — the SAME ProductionDeliverable records the
// Deliverables views edit. Linking here writes straight back to them.
interface LinkedDeliverable {
  id: string;
  title: string;
  type: string;
  linkedShots?: string[];
}

const STATUS_STYLES: Record<ShotStatus, string> = {
  planned: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400",
  in_progress: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
  completed: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",
};

export function StatusBadge({ status }: { status: ShotStatus }) {
  return (
    <span
      className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[status]}`}
    >
      {SHOT_STATUS_LABELS[status]}
    </span>
  );
}

// Overall shot-style / creative-approach block shown at the top of the shot list.
function ShotStyleEditor({
  shotStyle,
  setShotStyle,
}: {
  shotStyle: ShotStyle;
  setShotStyle: (v: ShotStyle) => void;
}) {
  return (
    <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 p-3.5 space-y-3">
      <p className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Shot Style</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Overall Tone</label>
          <input
            type="text"
            value={shotStyle.tone}
            onChange={(e) => setShotStyle({ ...shotStyle, tone: e.target.value })}
            placeholder="e.g. Warm, editorial, candid"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Visual Device</label>
          <input
            type="text"
            value={shotStyle.visualDevice}
            onChange={(e) => setShotStyle({ ...shotStyle, visualDevice: e.target.value })}
            placeholder="e.g. Handheld, natural light, 35mm"
            className={inputCls}
          />
        </div>
      </div>
      <div>
        <label className={labelCls}>Style Notes</label>
        <textarea
          value={shotStyle.notes}
          onChange={(e) => setShotStyle({ ...shotStyle, notes: e.target.value })}
          placeholder="Overall visual approach, references, do's and don'ts…"
          rows={2}
          className={`${inputCls} resize-none`}
        />
      </div>
    </div>
  );
}

// Paste-a-brief parser: turns raw text into structured shot cards. Uses the
// LLM parser (which digests any format) and falls back to the regex parser if
// the endpoint is unavailable or the model can't structure the text.
function ShotlistImporter({
  onParsed,
}: {
  onParsed: (result: { shots: Shot[]; style?: ShotStyle | null }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!raw.trim() || busy) return;
    setBusy(true);
    try {
      let shots: Shot[] = [];
      let style: ShotStyle | null = null;
      try {
        const res = await fetch("/api/ai/parse-content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: raw, type: "shotlist" }),
        });
        const data = await res.json();
        if (res.ok && Array.isArray(data.shots) && data.shots.length > 0) {
          shots = data.shots;
          style = data.style ?? null;
        }
      } catch {
        // fall through to regex below
      }
      if (shots.length === 0) shots = parseShotList(raw);
      if (shots.length > 0) {
        onParsed({ shots, style });
        setRaw("");
        setOpen(false);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
      >
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        <Sparkles size={13} /> Paste a shot list to auto-format
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-snug">
            Paste raw text in any format — an AI parser reads it and organises the shots, style and
            per-shot notes for you. Structured layouts (<span className="font-mono">Shot 1</span>,{" "}
            <span className="font-mono">Scene:</span>, <span className="font-mono">Video:</span>,{" "}
            <span className="font-mono">Stills:</span> …) also work if the AI is unavailable.
          </p>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={"Shot 1 — Opening wide\nScene: Talent walks into the atrium\nVideo: Slow push-in on gimbal, wide to medium\nDialogue: \"Tell us how it started…\"\nStills: Full-length, environmental portrait\nTone: Editorial, airy"}
            rows={7}
            className={`${inputCls} resize-y font-mono text-xs`}
          />
          <div className="flex items-center gap-2">
            <button
              onClick={run}
              disabled={!raw.trim() || busy}
              className="flex items-center gap-1.5 bg-[#A93B2E] text-white px-3.5 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40"
            >
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
              {busy ? "Parsing…" : "Parse into shots"}
            </button>
            <span className="text-[11px] text-gray-400 dark:text-gray-500">Parsed shots are appended — you can edit any field after.</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ShotCard({
  shot,
  index,
  locations,
  deliverables,
  onToggleDeliverable,
  onChange,
  onDuplicate,
  onDelete,
}: {
  shot: Shot;
  index: number;
  locations: CallSheetLocation[];
  deliverables: LinkedDeliverable[];
  onToggleDeliverable: (d: LinkedDeliverable, shotNumber: string) => void;
  onChange: (patch: Partial<Shot>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const shotNumber = shot.shotNumber || String(index + 1);
  const linkedDeliverables = deliverables.filter((d) =>
    (d.linkedShots ?? []).map(String).includes(shotNumber)
  );
  const bodyField = (label: string, key: keyof Shot, placeholder: string, rows = 2) => (
    <div>
      <label className={labelCls}>{label}</label>
      <textarea
        value={(shot[key] as string | undefined) ?? ""}
        onChange={(e) => onChange({ [key]: e.target.value } as Partial<Shot>)}
        placeholder={placeholder}
        rows={rows}
        className={`${inputCls} resize-none`}
      />
    </div>
  );

  return (
    <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 p-3">
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={() => setOpen((o) => !o)}
          className="text-gray-300 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400 p-0.5"
          title={open ? "Collapse" : "Expand"}
        >
          {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </button>
        <span className="flex items-center justify-center min-w-6 h-6 px-1.5 rounded-lg bg-gray-900 text-white text-xs font-bold">
          {shot.shotNumber || index + 1}
        </span>
        <input
          type="text"
          value={shot.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Shot description / headline"
          className={`${smallInputCls} flex-1`}
        />
        <select
          value={shot.status}
          onChange={(e) => onChange({ status: e.target.value as ShotStatus })}
          className={smallInputCls}
        >
          {(Object.keys(SHOT_STATUS_LABELS) as ShotStatus[]).map((s) => (
            <option key={s} value={s}>
              {SHOT_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        {linkedDeliverables.length > 0 && (
          <span
            title={`Feeds: ${linkedDeliverables.map((d) => d.title).join(", ")}`}
            className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-50 dark:bg-red-900/30 text-[#A93B2E]"
          >
            <Package size={10} /> {linkedDeliverables.length}
          </span>
        )}
        <button
          onClick={onDuplicate}
          title="Duplicate shot"
          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-300 dark:text-gray-600 hover:text-[#A93B2E] transition-colors"
        >
          <Copy size={13} />
        </button>
        <DeleteButton onClick={onDelete} />
      </div>

      {open && (
        <div className="space-y-3 pl-7">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Location</label>
              <select
                value={shot.locationRef ?? ""}
                onChange={(e) => onChange({ locationRef: e.target.value })}
                className={inputCls}
              >
                <option value="">— No specific location —</option>
                {locations.map((l, i) => (
                  <option key={i} value={l.name || `Location ${i + 1}`}>
                    {l.name || `Location ${i + 1}`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Est. Duration</label>
              <input
                type="text"
                value={shot.duration}
                onChange={(e) => onChange({ duration: e.target.value })}
                placeholder="e.g. 45 min"
                className={inputCls}
              />
            </div>
          </div>
          {bodyField("Scene", "scene", "What happens in this shot")}
          {bodyField("Video Notes", "video", "Camera direction, framing, movement")}
          {bodyField("Dialogue / Interview Prompts", "dialogue", "Lines, questions, VO prompts")}
          {bodyField("Stills List", "stills", "What the photographer should capture")}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Talent</label>
              <input
                type="text"
                value={shot.talent}
                onChange={(e) => onChange({ talent: e.target.value })}
                placeholder="Talent involved"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Equipment</label>
              <input
                type="text"
                value={shot.equipment}
                onChange={(e) => onChange({ equipment: e.target.value })}
                placeholder="Equipment notes"
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Tone / Style</label>
            <input
              type="text"
              value={shot.tone ?? ""}
              onChange={(e) => onChange({ tone: e.target.value })}
              placeholder="Per-shot tone or style notes"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Feeds deliverables</label>
            {deliverables.length === 0 ? (
              <p className="text-[11px] text-gray-400 dark:text-gray-500 italic">
                No deliverables yet — add them in the Deliverables section.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {deliverables.map((d) => {
                  const on = (d.linkedShots ?? []).map(String).includes(shotNumber);
                  return (
                    <button
                      key={d.id}
                      onClick={() => onToggleDeliverable(d, shotNumber)}
                      title={on ? "Unlink from this deliverable" : "Link to this deliverable"}
                      className={`text-[11px] font-medium px-2 py-1 rounded-lg border transition-colors ${
                        on
                          ? "bg-[#A93B2E] text-white border-transparent"
                          : "text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
                      }`}
                    >
                      {d.title}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function ShotlistEditor({
  shotlist,
  setShotlist,
  shotStyle,
  setShotStyle,
  locations,
  productionId,
}: {
  shotlist: Shot[];
  setShotlist: (v: Shot[]) => void;
  shotStyle: ShotStyle;
  setShotStyle: (v: ShotStyle) => void;
  locations: CallSheetLocation[];
  productionId: string;
}) {
  const [deliverables, setDeliverables] = useState<LinkedDeliverable[]>([]);

  const loadDeliverables = useCallback(() => {
    fetch(`/api/productions/${productionId}/deliverables`)
      .then((r) => r.json())
      .then((d) => setDeliverables(Array.isArray(d.deliverables) ? d.deliverables : []))
      .catch(() => {});
  }, [productionId]);

  useEffect(() => {
    loadDeliverables();
  }, [loadDeliverables]);

  function update(i: number, patch: Partial<Shot>) {
    setShotlist(shotlist.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  }

  // Toggle this shot on a deliverable's linkedShots — the mapping is stored on
  // the deliverable, so this writes straight back to it (kept in sync with the
  // Deliverables views).
  function toggleDeliverable(d: LinkedDeliverable, shotNumber: string) {
    const set = new Set((d.linkedShots ?? []).map(String));
    if (set.has(shotNumber)) set.delete(shotNumber);
    else set.add(shotNumber);
    const next = Array.from(set);
    setDeliverables((prev) =>
      prev.map((x) => (x.id === d.id ? { ...x, linkedShots: next } : x))
    );
    fetch(`/api/productions/${productionId}/deliverables?deliverableId=${d.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ linkedShots: next }),
    }).catch(() => {});
  }

  return (
    <div className="space-y-3">
      <ShotStyleEditor shotStyle={shotStyle} setShotStyle={setShotStyle} />
      <ShotlistImporter
        onParsed={({ shots, style }) => {
          setShotlist([...shotlist, ...shots]);
          // Only adopt a parsed style when the shoot doesn't already have one,
          // so re-parsing never clobbers hand-edited style notes.
          if (style && (style.tone || style.visualDevice || style.notes)) {
            const empty = !shotStyle.tone && !shotStyle.visualDevice && !shotStyle.notes;
            if (empty) setShotStyle(style);
          }
        }}
      />
      {shotlist.map((shot, i) => (
        <ShotCard
          key={i}
          shot={shot}
          index={i}
          locations={locations}
          deliverables={deliverables}
          onToggleDeliverable={toggleDeliverable}
          onChange={(patch) => update(i, patch)}
          onDuplicate={() => {
            const next = [...shotlist];
            next.splice(i + 1, 0, { ...shot, status: "planned" });
            setShotlist(next);
          }}
          onDelete={() => setShotlist(shotlist.filter((_, j) => j !== i))}
        />
      ))}
      <AddButton label="Add Shot" onClick={() => setShotlist([...shotlist, emptyShot()])} />
    </div>
  );
}

export function ShotlistDoc({
  shotlist,
  shotStyle,
}: {
  shotlist: Shot[];
  shotStyle?: ShotStyle;
}) {
  const hasStyle = !!(shotStyle && (shotStyle.tone || shotStyle.visualDevice || shotStyle.notes));
  if (shotlist.length === 0 && !hasStyle) return null;

  // Structured shots render as cards; legacy shots (no structured fields) fall
  // back to the compact table.
  const structured = shotlist.some(
    (s) => s.scene || s.video || s.dialogue || s.stills || s.locationRef || s.tone
  );

  return (
    <div className="space-y-4">
      {hasStyle && (
        <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1.5">
            Shot Style
          </p>
          <div className="text-sm text-gray-700 dark:text-gray-300 space-y-0.5">
            {shotStyle!.tone && (
              <p>
                <span className="text-gray-400 dark:text-gray-500">Tone:</span> {shotStyle!.tone}
              </p>
            )}
            {shotStyle!.visualDevice && (
              <p>
                <span className="text-gray-400 dark:text-gray-500">Visual device:</span> {shotStyle!.visualDevice}
              </p>
            )}
            {shotStyle!.notes && (
              <p className="whitespace-pre-wrap text-gray-600 dark:text-gray-400">{shotStyle!.notes}</p>
            )}
          </div>
        </div>
      )}

      {structured
        ? shotlist.map((shot, i) => (
            <div key={i} className="rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 px-3 py-2">
                <span className="flex items-center justify-center min-w-6 h-6 px-1.5 rounded-lg bg-[#A93B2E] text-white text-xs font-bold">
                  {shot.shotNumber || i + 1}
                </span>
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  {shot.description || "Untitled shot"}
                </span>
                {shot.locationRef && (
                  <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">{shot.locationRef}</span>
                )}
              </div>
              <div className="px-3 py-2.5 text-sm text-gray-600 dark:text-gray-400 space-y-1.5">
                {shot.scene && <DocLine label="Scene" value={shot.scene} />}
                {shot.video && <DocLine label="Video" value={shot.video} />}
                {shot.dialogue && <DocLine label="Dialogue" value={shot.dialogue} />}
                {shot.stills && <DocLine label="Stills" value={shot.stills} />}
                {shot.talent && <DocLine label="Talent" value={shot.talent} />}
                {shot.equipment && <DocLine label="Equipment" value={shot.equipment} />}
                {shot.duration && <DocLine label="Duration" value={shot.duration} />}
                {shot.tone && <DocLine label="Tone" value={shot.tone} />}
              </div>
            </div>
          ))
        : shotlist.length > 0 && (
            <div className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
              <div className="grid grid-cols-[32px_1.6fr_1fr_1fr_1fr_70px_90px] gap-0 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide bg-gray-50 dark:bg-gray-800 px-3 py-2">
                <span>#</span>
                <span>Description</span>
                <span>Setup</span>
                <span>Talent</span>
                <span>Equipment</span>
                <span>Dur.</span>
                <span>Status</span>
              </div>
              {shotlist.map((shot, i) => (
                <div
                  key={i}
                  className={`grid grid-cols-[32px_1.6fr_1fr_1fr_1fr_70px_90px] gap-0 px-3 py-2.5 text-sm items-center ${
                    i % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50/50 dark:bg-gray-800/50"
                  }`}
                >
                  <span className="font-bold text-[#A93B2E]">{i + 1}</span>
                  <span className="text-gray-800 dark:text-gray-200 font-medium pr-2">{shot.description || "—"}</span>
                  <span className="text-gray-600 dark:text-gray-400 text-xs pr-2">{shot.setup}</span>
                  <span className="text-gray-600 dark:text-gray-400 text-xs pr-2">{shot.talent}</span>
                  <span className="text-gray-600 dark:text-gray-400 text-xs pr-2">{shot.equipment}</span>
                  <span className="text-gray-600 dark:text-gray-400 text-xs">{shot.duration}</span>
                  <span>
                    <StatusBadge status={shot.status} />
                  </span>
                </div>
              ))}
            </div>
          )}
    </div>
  );
}

function DocLine({ label, value }: { label: string; value: string }) {
  return (
    <p className="whitespace-pre-wrap">
      <span className="text-gray-400 dark:text-gray-500 font-medium">{label}:</span> {value}
    </p>
  );
}
