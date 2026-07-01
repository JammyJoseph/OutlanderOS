"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Plus, Trash2, RefreshCw, Wand2, ChevronDown, ChevronRight, Loader2,
} from "lucide-react";
import { parseDeliverables } from "./types";
import { inputCls, labelCls, smallInputCls } from "./shared";
import { LinkedShotsPicker, ShotOption } from "../../_components/LinkedShotsPicker";

// A production deliverable — the SAME record the production Deliverables tab
// edits. Reading/writing it here keeps the two views in sync (one source of
// truth), which satisfies the two-way-sync requirement without any extra state.
interface Deliverable {
  id: string;
  type: string;
  title: string;
  status: string;
  dueDate: string | null;
  url: string | null;
  notes: string | null;
  linkedShots?: string[];
}

const TYPES = ["photo", "video", "reel", "bts", "other"];
const TYPE_LABEL: Record<string, string> = {
  photo: "Photo",
  video: "Video",
  reel: "Reel",
  bts: "BTS",
  other: "Other",
};

const STATUSES = ["AWAITING", "IN_PROGRESS", "DELIVERED", "APPROVED"];
const STATUS_LABEL: Record<string, string> = {
  AWAITING: "Awaiting",
  IN_PROGRESS: "In Progress",
  DELIVERED: "Delivered",
  APPROVED: "Approved",
};

// Editor + read-only doc share this component; `readOnly` renders the doc form.
export function CallSheetDeliverables({
  productionId,
  readOnly = false,
}: {
  productionId: string;
  readOnly?: boolean;
}) {
  const [items, setItems] = useState<Deliverable[]>([]);
  const [shots, setShots] = useState<ShotOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [raw, setRaw] = useState("");

  useEffect(() => {
    fetch(`/api/productions/${productionId}/shots`)
      .then((r) => r.json())
      .then((d) => setShots(Array.isArray(d.shots) ? d.shots : []))
      .catch(() => {});
  }, [productionId]);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/productions/${productionId}/deliverables`)
      .then((r) => r.json())
      .then((d) => setItems(Array.isArray(d.deliverables) ? d.deliverables : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [productionId]);

  useEffect(() => {
    load();
  }, [load]);

  async function addOne(payload: Partial<Deliverable>) {
    setBusy(true);
    try {
      await fetch(`/api/productions/${productionId}/deliverables`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      load();
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, p: Partial<Deliverable>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...p } : it)));
    await fetch(`/api/productions/${productionId}/deliverables?deliverableId=${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
  }

  async function remove(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id));
    await fetch(`/api/productions/${productionId}/deliverables?deliverableId=${id}`, {
      method: "DELETE",
    });
  }

  async function runImport() {
    if (!raw.trim() || busy) return;
    setBusy(true);
    try {
      // LLM parser first (digests any format); fall back to the regex parser if
      // the endpoint is unavailable or returns nothing structured.
      let parsed: { type: string; title: string; notes: string }[] = [];
      try {
        const res = await fetch("/api/ai/parse-content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: raw, type: "deliverables" }),
        });
        const data = await res.json();
        if (res.ok && Array.isArray(data.deliverables) && data.deliverables.length > 0) {
          parsed = data.deliverables;
        }
      } catch {
        // fall through to regex below
      }
      if (parsed.length === 0) parsed = parseDeliverables(raw);
      if (parsed.length === 0) return;
      for (const d of parsed) {
        await fetch(`/api/productions/${productionId}/deliverables`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: d.type, title: d.title, notes: d.notes, status: "AWAITING" }),
        });
      }
      setRaw("");
      setImportOpen(false);
      load();
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
        <Loader2 size={14} className="animate-spin" /> Loading deliverables…
      </div>
    );
  }

  // ── Read-only doc view (call sheet preview / PDF) ──
  if (readOnly) {
    if (items.length === 0) return null;
    return (
      <div className="border border-gray-100 rounded-xl overflow-hidden">
        {items.map((d, i) => (
          <div
            key={d.id}
            className={`px-4 py-2.5 text-sm ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}
          >
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                {TYPE_LABEL[d.type] || d.type}
              </span>
              <span className="text-gray-800 font-medium">{d.title}</span>
            </div>
            {d.notes && (
              <p className="text-xs text-gray-500 whitespace-pre-wrap mt-0.5">{d.notes}</p>
            )}
            {d.linkedShots && d.linkedShots.length > 0 && (
              <p className="text-[11px] text-gray-400 mt-0.5">
                From shots {d.linkedShots.join(", ")}
              </p>
            )}
          </div>
        ))}
      </div>
    );
  }

  // ── Editor view ──
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[11px] text-gray-400 leading-snug">
          Synced two-way with the project&apos;s Deliverables tab — edits here update there and vice versa.
        </p>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800"
          title="Pull the latest from the Deliverables tab"
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      <div className="rounded-xl border border-dashed border-gray-200 bg-white p-3">
        <button
          onClick={() => setImportOpen((o) => !o)}
          className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800"
        >
          {importOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          <Wand2 size={13} /> Paste a deliverables brief to auto-format
        </button>
        {importOpen && (
          <div className="mt-3 space-y-2">
            <p className="text-[11px] text-gray-400 leading-snug">
              Paste a deliverables brief in any format — an AI parser reads it and splits out each
              deliverable with its type, quantity and spec notes. Simple{" "}
              <span className="font-mono">Nx …</span> lists (e.g.{" "}
              <span className="font-mono">8x Edited Hero Images</span>) also work if the AI is unavailable.
            </p>
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder={
                "8x Edited High-Res Digital Hero Images\n- 3000px, sRGB, retouched\n12x Secondary Stills\n4x Social Video Edits\n- 9:16, 15s, captioned"
              }
              rows={6}
              className={`${inputCls} resize-y font-mono text-xs`}
            />
            <button
              onClick={runImport}
              disabled={busy || !raw.trim()}
              className="flex items-center gap-1.5 bg-[#ff4444] text-white px-3.5 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40"
            >
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
              Parse into deliverables
            </button>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-gray-400 italic">No deliverables yet.</p>
      ) : (
        <div className="space-y-2">
          {items.map((d) => (
            <div key={d.id} className="rounded-xl border border-gray-100 bg-gray-50/50 p-3 space-y-2">
              <div className="grid grid-cols-[1fr_130px_150px_32px] gap-2 items-center">
                <input
                  type="text"
                  value={d.title}
                  onChange={(e) => patch(d.id, { title: e.target.value })}
                  placeholder="Deliverable"
                  className={smallInputCls}
                />
                <select
                  value={d.type}
                  onChange={(e) => patch(d.id, { type: e.target.value })}
                  className={smallInputCls}
                >
                  {TYPES.map((t) => (
                    <option key={t} value={t}>
                      {TYPE_LABEL[t]}
                    </option>
                  ))}
                </select>
                <select
                  value={d.status}
                  onChange={(e) => patch(d.id, { status: e.target.value })}
                  className={smallInputCls}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => remove(d.id)}
                  className="p-1.5 rounded-lg text-gray-300 hover:text-[#ff4444] hover:bg-red-50"
                  title="Remove deliverable"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div>
                <label className={labelCls}>Format / spec notes</label>
                <textarea
                  value={d.notes ?? ""}
                  onChange={(e) => patch(d.id, { notes: e.target.value })}
                  placeholder="Dimensions, duration, format, description…"
                  rows={2}
                  className={`${inputCls} resize-none`}
                />
              </div>
              <LinkedShotsPicker
                shots={shots}
                selected={d.linkedShots ?? []}
                onChange={(next) => patch(d.id, { linkedShots: next })}
                accent="#ff4444"
              />
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => addOne({ type: "photo", title: "New deliverable", status: "AWAITING" })}
        disabled={busy}
        className="flex items-center gap-1.5 text-sm font-medium text-[#ff4444] hover:text-[#ff4444] disabled:opacity-40"
      >
        <Plus size={15} /> Add deliverable
      </button>
    </div>
  );
}
