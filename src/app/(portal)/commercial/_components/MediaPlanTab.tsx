"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Loader2,
  Plus,
  Trash2,
  Lock as LockIcon,
  Unlock,
  GripVertical,
  Banknote,
  CheckCircle2,
  Film,
  History,
  PencilLine,
  X,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import {
  type MediaPlanData,
  type MediaPlanPhase,
  type MediaPlanLine,
  computeLine,
  phaseSubtotal,
  mediaPlanTotals,
  emptyMediaPlan,
} from "@/lib/media-plan";
import { type RateCardEntry, CUSTOM_PLACEMENT, RATE_TYPES, MEASUREMENTS } from "@/lib/rate-card";

const GOLD = "#ffd700";

function gbp(n: number): string {
  return `£${(n || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function gbp0(n: number): string {
  return `£${(n || 0).toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
}
function uid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
}

interface AllocationDraft {
  name: string;
  amount: string;
  isProductionBudget: boolean;
}

function blankLine(): MediaPlanLine {
  return computeLine({
    id: uid(),
    placement: "",
    description: "",
    startDate: null,
    endDate: null,
    rateCard: 0,
    discount: 0,
    netRate: 0,
    units: 1,
    totalCost: 0,
    impressions: 0,
    rateType: "Flat Fee",
    measurement: "Impressions",
    addedValue: "",
    notes: "",
  });
}

export default function MediaPlanTab({
  dealId,
  onSaved,
}: {
  dealId: string;
  onSaved: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lockBusy, setLockBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [plan, setPlan] = useState<MediaPlanData>(emptyMediaPlan());
  const [rateCard, setRateCard] = useState<RateCardEntry[]>([]);
  const [marginPct, setMarginPct] = useState("");
  const [marginAmt, setMarginAmt] = useState("");
  const [allocations, setAllocations] = useState<AllocationDraft[]>([]);

  const [locked, setLocked] = useState(false);
  const [lockedAt, setLockedAt] = useState<string | null>(null);
  const [lockedByName, setLockedByName] = useState<string | null>(null);
  const [version, setVersion] = useState(1);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [updatedBy, setUpdatedBy] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Editing a locked plan locally (the "Update & Re-lock" flow).
  const [editingLocked, setEditingLocked] = useState(false);
  const [showLockConfirm, setShowLockConfirm] = useState(false);
  const [showUnlockConfirm, setShowUnlockConfirm] = useState(false);

  const dragRef = useRef<{ phaseId: string; index: number } | null>(null);

  const load = useCallback(async () => {
    const d = await fetch(`/api/commercial/deals/${dealId}/media-plan`).then((r) => r.json());
    const loadedPlan: MediaPlanData = d.plan ?? emptyMediaPlan();
    setPlan({
      phases: (loadedPlan.phases ?? []).map((p) => ({
        ...p,
        lines: (p.lines ?? []).map((l) => computeLine(l)),
      })),
      version: loadedPlan.version ?? 1,
      updatedAt: loadedPlan.updatedAt ?? null,
      updatedBy: loadedPlan.updatedBy ?? null,
    });
    setMarginPct(d.marginPercent != null ? String(d.marginPercent) : "");
    setMarginAmt(d.marginAmount != null ? String(d.marginAmount) : "");
    const loadedAlloc = (d.allocations ?? []) as AllocationDraft[];
    setAllocations(
      loadedAlloc.length
        ? loadedAlloc.map((a) => ({ name: a.name, amount: String(a.amount), isProductionBudget: a.isProductionBudget }))
        : [{ name: "Production", amount: "", isProductionBudget: true }]
    );
    setLocked(Boolean(d.locked));
    setLockedAt(d.lockedAt ?? null);
    setLockedByName(d.lockedByName ?? null);
    setVersion(d.version ?? 1);
    setUpdatedAt(d.updatedAt ?? null);
    setUpdatedBy(d.updatedBy ?? null);
    setEditingLocked(false);
  }, [dealId]);

  useEffect(() => {
    Promise.all([
      load(),
      fetch("/api/commercial/rate-card")
        .then((r) => r.json())
        .then((rc) => setRateCard(Array.isArray(rc) ? rc : []))
        .catch(() => setRateCard([])),
      fetch("/api/me")
        .then((r) => r.json())
        .then((d) => setIsAdmin(d.user?.role === "ADMIN"))
        .catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [load]);

  // The fields are editable when the plan isn't locked, or when the user has
  // explicitly chosen to edit a locked plan (re-lock flow).
  const editable = !locked || editingLocked;

  const totals = mediaPlanTotals(plan);
  const total = totals.net;
  const margin = Number(marginAmt) || 0;
  const allocated = allocations.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
  const remaining = total - margin - allocated;
  const balanced = total > 0 && Math.abs(remaining) < 0.01;
  const productionAllocations = allocations.filter((a) => a.isProductionBudget && (Number(a.amount) || 0) > 0);
  const productionTotal = productionAllocations.reduce((s, a) => s + (Number(a.amount) || 0), 0);

  // ── plan mutation helpers ──────────────────────────────────────────────────
  function mutate(fn: (p: MediaPlanData) => MediaPlanData) {
    setPlan((prev) => fn(prev));
  }

  function updateLine(phaseId: string, lineId: string, patch: Partial<MediaPlanLine>) {
    mutate((p) => ({
      ...p,
      phases: p.phases.map((ph) =>
        ph.id !== phaseId
          ? ph
          : {
              ...ph,
              lines: ph.lines.map((l) => (l.id === lineId ? computeLine({ ...l, ...patch }) : l)),
            }
      ),
    }));
  }

  function onPlacementChange(phaseId: string, lineId: string, name: string) {
    if (name === CUSTOM_PLACEMENT || name === "") {
      updateLine(phaseId, lineId, { placement: name === CUSTOM_PLACEMENT ? "Custom" : "" });
      return;
    }
    const preset = rateCard.find((r) => r.name === name);
    if (!preset) {
      updateLine(phaseId, lineId, { placement: name });
      return;
    }
    updateLine(phaseId, lineId, {
      placement: preset.name,
      description: preset.name,
      rateCard: preset.rate,
      impressions: preset.impressions,
      rateType: preset.rateType,
      measurement: preset.measurement,
    });
  }

  function addLine(phaseId: string) {
    mutate((p) => ({
      ...p,
      phases: p.phases.map((ph) => (ph.id === phaseId ? { ...ph, lines: [...ph.lines, blankLine()] } : ph)),
    }));
  }

  function addPhase() {
    mutate((p) => ({
      ...p,
      phases: [...p.phases, { id: uid(), name: `Phase ${p.phases.length + 1}`, lines: [blankLine()] }],
    }));
  }

  function renamePhase(phaseId: string, name: string) {
    mutate((p) => ({ ...p, phases: p.phases.map((ph) => (ph.id === phaseId ? { ...ph, name } : ph)) }));
  }

  function deletePhase(phaseId: string) {
    mutate((p) => ({ ...p, phases: p.phases.filter((ph) => ph.id !== phaseId) }));
  }

  function deleteLine(phaseId: string, lineId: string) {
    mutate((p) => ({
      ...p,
      phases: p.phases.map((ph) => (ph.id === phaseId ? { ...ph, lines: ph.lines.filter((l) => l.id !== lineId) } : ph)),
    }));
  }

  // Drag-reorder within a phase.
  function onDrop(phaseId: string, targetIndex: number) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || drag.phaseId !== phaseId || drag.index === targetIndex) return;
    mutate((p) => ({
      ...p,
      phases: p.phases.map((ph) => {
        if (ph.id !== phaseId) return ph;
        const lines = [...ph.lines];
        const [moved] = lines.splice(drag.index, 1);
        lines.splice(targetIndex, 0, moved);
        return { ...ph, lines };
      }),
    }));
  }

  // ── margin dual entry ───────────────────────────────────────────────────────
  function onMarginPct(v: string) {
    setMarginPct(v);
    const pct = Number(v);
    if (v !== "" && !Number.isNaN(pct) && total > 0) {
      setMarginAmt(String(Math.round(((total * pct) / 100) * 100) / 100));
    }
  }
  function onMarginAmt(v: string) {
    setMarginAmt(v);
    const amt = Number(v);
    if (v !== "" && !Number.isNaN(amt) && total > 0) {
      setMarginPct(String(Math.round((amt / total) * 100 * 10) / 10));
    }
  }

  function economicsPayload() {
    return {
      marginPercent: marginPct === "" ? null : Number(marginPct),
      marginAmount: marginAmt === "" ? null : Number(marginAmt),
      allocations: allocations
        .filter((a) => a.name.trim())
        .map((a) => ({ name: a.name.trim(), amount: Number(a.amount) || 0, isProductionBudget: a.isProductionBudget })),
    };
  }

  async function save(): Promise<boolean> {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/commercial/deals/${dealId}/media-plan`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, ...economicsPayload() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save media plan");
        return false;
      }
      setSavedAt(Date.now());
      await load();
      await onSaved();
      return true;
    } finally {
      setSaving(false);
    }
  }

  async function setLock(nextLocked: boolean) {
    setLockBusy(true);
    setError(null);
    try {
      if (nextLocked) {
        const ok = await save();
        if (!ok) return;
      }
      const res = await fetch(`/api/commercial/deals/${dealId}/media-plan/lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locked: nextLocked }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to update lock");
        return;
      }
      setShowLockConfirm(false);
      setShowUnlockConfirm(false);
      await load();
      await onSaved();
    } finally {
      setLockBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={20} className="animate-spin text-gray-400" />
      </div>
    );
  }

  const placementOptions = [...rateCard.map((r) => r.name), CUSTOM_PLACEMENT];

  const cell =
    "px-2 py-1.5 text-sm border border-gray-100 focus:outline-none focus:ring-2 focus:ring-[#ffd700]/30 focus:border-[#ffd700] disabled:bg-transparent disabled:text-gray-600 rounded-md bg-white";
  const autoCell = "px-2 py-1.5 text-sm bg-gray-50 text-gray-700 tabular-nums rounded-md border border-gray-100";

  return (
    <div className="space-y-5">
      {/* ── Version / lock banner ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <History size={13} className="text-gray-400" />
          <span className="font-medium text-gray-700">Version {version}</span>
          {updatedAt && (
            <span>
              — Last updated {format(parseISO(updatedAt), "d MMM yyyy")}
              {updatedBy ? ` by ${updatedBy}` : ""}
            </span>
          )}
        </div>
        {locked && (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
            <LockIcon size={11} /> Locked
            {lockedAt ? ` · ${format(parseISO(lockedAt), "d MMM yyyy")}` : ""}
            {lockedByName ? ` · ${lockedByName}` : ""}
          </span>
        )}
      </div>

      {locked && !editingLocked && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm font-semibold text-emerald-800 flex items-center gap-2">
            <LockIcon size={14} /> Media plan locked — this is the deal budget.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setEditingLocked(true)}
              className="text-xs font-medium text-emerald-700 hover:text-emerald-900 underline underline-offset-2 inline-flex items-center gap-1"
            >
              <PencilLine size={12} /> Edit plan
            </button>
            {isAdmin && (
              <button
                onClick={() => setShowUnlockConfirm(true)}
                className="text-xs font-medium text-emerald-700 hover:text-emerald-900 underline underline-offset-2 inline-flex items-center gap-1"
              >
                <Unlock size={12} /> Unlock (admin)
              </button>
            )}
          </div>
        </div>
      )}

      {locked && editingLocked && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 text-sm font-medium text-amber-800">
          Unsaved changes since lock. Click <span className="font-bold">Update &amp; Re-lock</span> to apply.
        </div>
      )}

      {/* ── Spreadsheet ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <Banknote size={15} style={{ color: GOLD }} />
            Media Plan
          </h3>
          {savedAt && !saving && (
            <span className="text-xs text-emerald-600 flex items-center gap-1">
              <CheckCircle2 size={13} /> Saved
            </span>
          )}
        </div>

        {plan.phases.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-gray-500 mb-4">No phases yet. Build the plan by adding a phase.</p>
            {editable && (
              <button
                onClick={addPhase}
                className="inline-flex items-center gap-1.5 bg-[#ffd700] text-black px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-[#e6c200] transition-colors"
              >
                <Plus size={15} /> Add Phase
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: 1500 }}>
              <thead>
                <tr className="bg-gray-50 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="w-7" />
                  <th className="px-2 py-2 text-left" style={{ minWidth: 180 }}>Placement</th>
                  <th className="px-2 py-2 text-left" style={{ minWidth: 160 }}>Description</th>
                  <th className="px-2 py-2 text-left" style={{ minWidth: 120 }}>Start</th>
                  <th className="px-2 py-2 text-left" style={{ minWidth: 120 }}>End</th>
                  <th className="px-2 py-2 text-right" style={{ minWidth: 100 }}>Rate Card</th>
                  <th className="px-2 py-2 text-right" style={{ minWidth: 70 }}>Disc %</th>
                  <th className="px-2 py-2 text-right" style={{ minWidth: 100 }}>Net Rate</th>
                  <th className="px-2 py-2 text-right" style={{ minWidth: 60 }}>Units</th>
                  <th className="px-2 py-2 text-right" style={{ minWidth: 110 }}>Total</th>
                  <th className="px-2 py-2 text-right" style={{ minWidth: 110 }}>Impressions</th>
                  <th className="px-2 py-2 text-left" style={{ minWidth: 110 }}>Rate Type</th>
                  <th className="px-2 py-2 text-left" style={{ minWidth: 120 }}>Measurement</th>
                  <th className="px-2 py-2 text-left" style={{ minWidth: 160 }}>Added Value</th>
                  <th className="px-2 py-2 text-left" style={{ minWidth: 140 }}>Notes</th>
                  <th className="w-9" />
                </tr>
              </thead>
              <tbody>
                {plan.phases.map((phase) => (
                  <PhaseBlock
                    key={phase.id}
                    phase={phase}
                    editable={editable}
                    placementOptions={placementOptions}
                    rateCard={rateCard}
                    cell={cell}
                    autoCell={autoCell}
                    onRename={(name) => renamePhase(phase.id, name)}
                    onDeletePhase={() => deletePhase(phase.id)}
                    onAddLine={() => addLine(phase.id)}
                    onPlacementChange={(lineId, name) => onPlacementChange(phase.id, lineId, name)}
                    onUpdateLine={(lineId, patch) => updateLine(phase.id, lineId, patch)}
                    onDeleteLine={(lineId) => deleteLine(phase.id, lineId)}
                    onDragStart={(index) => (dragRef.current = { phaseId: phase.id, index })}
                    onDropRow={(index) => onDrop(phase.id, index)}
                  />
                ))}
                {/* Grand total */}
                <tr className="bg-amber-50/60 font-bold text-gray-900 text-sm border-t-2" style={{ borderTopColor: GOLD }}>
                  <td />
                  <td className="px-2 py-3" colSpan={4}>
                    Media Plan Total
                  </td>
                  <td className="px-2 py-3 text-right tabular-nums text-gray-500 font-medium">
                    {gbp0(totals.gross)}
                  </td>
                  <td />
                  <td className="px-2 py-3 text-right tabular-nums text-gray-500 font-medium" colSpan={2}>
                    −{gbp0(totals.discount)} disc
                  </td>
                  <td className="px-2 py-3 text-right tabular-nums text-base">{gbp0(totals.net)}</td>
                  <td colSpan={5} />
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {plan.phases.length > 0 && editable && (
          <div className="px-5 py-3.5 border-t border-gray-100">
            <button
              onClick={addPhase}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#ffd700] hover:text-[#e6c200] transition-colors"
            >
              <Plus size={15} /> Add Phase
            </button>
          </div>
        )}
      </div>

      {/* Prominent media plan total */}
      <div className="rounded-2xl px-5 py-4 bg-gradient-to-r from-amber-50 to-amber-50/30 border border-amber-200 flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm font-semibold text-[#e6c200]">
          Media Plan Total: <span className="text-lg tabular-nums">{gbp0(total)}</span>
        </p>
        <p className="text-xs text-[#e6c200]/80">This is the deal budget.</p>
      </div>

      {/* ── Deal Economics ────────────────────────────────────────────────── */}
      <DealEconomics
        total={total}
        marginPct={marginPct}
        marginAmt={marginAmt}
        onMarginPct={onMarginPct}
        onMarginAmt={onMarginAmt}
        allocations={allocations}
        setAllocations={setAllocations}
        editable={editable}
        margin={margin}
        allocated={allocated}
        remaining={remaining}
        balanced={balanced}
        productionTotal={productionTotal}
        productionCount={productionAllocations.length}
      />

      {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      {/* ── Actions ───────────────────────────────────────────────────────── */}
      {editable && (
        <div className="flex items-center justify-end gap-3">
          {!locked && (
            <button
              onClick={save}
              disabled={saving || lockBusy}
              className="flex items-center gap-2 border border-gray-200 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              Save Draft
            </button>
          )}
          {locked && editingLocked && (
            <button
              onClick={() => {
                setEditingLocked(false);
                load();
              }}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            onClick={() => (locked ? save() : setShowLockConfirm(true))}
            disabled={saving || lockBusy || !balanced}
            title={balanced ? "Lock the media plan" : "Margin + allocations must equal the media plan total"}
            className="flex items-center gap-2 bg-[#ffd700] text-black px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-[#e6c200] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving || lockBusy ? <Loader2 size={14} className="animate-spin" /> : <LockIcon size={14} />}
            {locked ? "Update & Re-lock" : "Lock Media Plan"}
          </button>
        </div>
      )}

      {/* Lock confirm */}
      {showLockConfirm && (
        <ConfirmModal
          title="Lock media plan?"
          icon={<LockIcon size={16} style={{ color: GOLD }} />}
          body={
            <>
              <p className="text-sm text-gray-600">
                The media plan and allocations become read-only and the production budget
                {productionTotal > 0 ? ` of ${gbp0(productionTotal)}` : ""} is finalised for the Production team. The
                deal advances to Budget Set. Only an admin can unlock it afterwards.
              </p>
              <div className="mt-4 rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 text-sm font-medium text-gray-700 tabular-nums">
                Total: {gbp0(total)} | Margin: {gbp0(margin)}
                {marginPct !== "" ? ` (${Number(marginPct)}%)` : ""} | Allocated: {gbp0(allocated)}
              </div>
            </>
          }
          confirmLabel="Lock Media Plan"
          busy={lockBusy}
          onConfirm={() => setLock(true)}
          onClose={() => setShowLockConfirm(false)}
        />
      )}
      {showUnlockConfirm && (
        <ConfirmModal
          title="Unlock media plan?"
          body={
            <p className="text-sm text-gray-600">
              The media plan becomes editable again. If the deal has already been cleared for production, re-lock it
              after editing so downstream numbers stay correct.
            </p>
          }
          confirmLabel="Unlock"
          confirmTone="dark"
          busy={lockBusy}
          onConfirm={() => setLock(false)}
          onClose={() => setShowUnlockConfirm(false)}
        />
      )}
    </div>
  );
}

// ─── Phase block (header + rows + subtotal) ───────────────────────────────────
function PhaseBlock({
  phase,
  editable,
  placementOptions,
  rateCard,
  cell,
  autoCell,
  onRename,
  onDeletePhase,
  onAddLine,
  onPlacementChange,
  onUpdateLine,
  onDeleteLine,
  onDragStart,
  onDropRow,
}: {
  phase: MediaPlanPhase;
  editable: boolean;
  placementOptions: string[];
  rateCard: RateCardEntry[];
  cell: string;
  autoCell: string;
  onRename: (name: string) => void;
  onDeletePhase: () => void;
  onAddLine: () => void;
  onPlacementChange: (lineId: string, name: string) => void;
  onUpdateLine: (lineId: string, patch: Partial<MediaPlanLine>) => void;
  onDeleteLine: (lineId: string) => void;
  onDragStart: (index: number) => void;
  onDropRow: (index: number) => void;
}) {
  const subtotal = phaseSubtotal(phase);
  const [confirmDeleteLine, setConfirmDeleteLine] = useState<string | null>(null);
  const [confirmDeletePhase, setConfirmDeletePhase] = useState(false);

  return (
    <>
      {/* Phase header */}
      <tr className="bg-amber-50/40">
        <td colSpan={16} className="px-0 py-0">
          <div className="flex items-center justify-between gap-2 pl-3 pr-3 py-2 border-l-4" style={{ borderLeftColor: GOLD }}>
            <input
              value={phase.name}
              onChange={(e) => onRename(e.target.value)}
              disabled={!editable}
              className="bg-transparent text-sm font-bold text-gray-900 px-1 py-0.5 rounded focus:outline-none focus:ring-2 focus:ring-[#ffd700]/30 disabled:text-gray-800 w-48"
            />
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-gray-500 tabular-nums">
                Subtotal: <span className="text-gray-900">{gbp0(subtotal)}</span>
              </span>
              {editable && (
                <button
                  onClick={() => setConfirmDeletePhase(true)}
                  className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                  title="Delete phase"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>
        </td>
      </tr>

      {/* Lines */}
      {phase.lines.map((line, index) => (
        <tr
          key={line.id}
          className="hover:bg-amber-50/20 even:bg-gray-50/40"
          draggable={editable}
          onDragStart={() => onDragStart(index)}
          onDragOver={(e) => editable && e.preventDefault()}
          onDrop={() => onDropRow(index)}
        >
          <td className="text-center align-middle">
            {editable && <GripVertical size={13} className="text-gray-300 mx-auto cursor-grab" />}
          </td>
          <td className="p-1">
            <select
              value={placementOptions.includes(line.placement) ? line.placement : line.placement ? "Custom" : ""}
              onChange={(e) => onPlacementChange(line.id, e.target.value)}
              disabled={!editable}
              className={`${cell} w-full`}
            >
              <option value="">Select…</option>
              {rateCard.map((r) => (
                <option key={r.name} value={r.name}>
                  {r.name} — {gbp0(r.rate)}
                </option>
              ))}
              <option value="Custom">Custom</option>
            </select>
          </td>
          <td className="p-1">
            <input
              value={line.description}
              onChange={(e) => onUpdateLine(line.id, { description: e.target.value })}
              disabled={!editable}
              className={`${cell} w-full`}
            />
          </td>
          <td className="p-1">
            <input
              type="date"
              value={line.startDate ?? ""}
              onChange={(e) => onUpdateLine(line.id, { startDate: e.target.value || null })}
              disabled={!editable}
              className={`${cell} w-full`}
            />
          </td>
          <td className="p-1">
            <input
              type="date"
              value={line.endDate ?? ""}
              onChange={(e) => onUpdateLine(line.id, { endDate: e.target.value || null })}
              disabled={!editable}
              className={`${cell} w-full`}
            />
          </td>
          <td className="p-1">
            <input
              type="number"
              min="0"
              value={line.rateCard || ""}
              onChange={(e) => onUpdateLine(line.id, { rateCard: Number(e.target.value) })}
              disabled={!editable}
              className={`${cell} w-full text-right tabular-nums`}
            />
          </td>
          <td className="p-1">
            <input
              type="number"
              min="0"
              max="100"
              value={line.discount || ""}
              onChange={(e) => onUpdateLine(line.id, { discount: Number(e.target.value) })}
              disabled={!editable}
              className={`${cell} w-full text-right tabular-nums`}
            />
          </td>
          <td className="p-1">
            <div className={`${autoCell} text-right`}>{gbp0(line.netRate)}</div>
          </td>
          <td className="p-1">
            <input
              type="number"
              min="0"
              value={line.units}
              onChange={(e) => onUpdateLine(line.id, { units: Number(e.target.value) })}
              disabled={!editable}
              className={`${cell} w-full text-right tabular-nums`}
            />
          </td>
          <td className="p-1">
            <div className={`${autoCell} text-right font-semibold`}>{gbp0(line.totalCost)}</div>
          </td>
          <td className="p-1">
            <input
              type="number"
              min="0"
              value={line.impressions || ""}
              onChange={(e) => onUpdateLine(line.id, { impressions: Number(e.target.value) })}
              disabled={!editable}
              className={`${cell} w-full text-right tabular-nums`}
            />
          </td>
          <td className="p-1">
            <select
              value={line.rateType}
              onChange={(e) => onUpdateLine(line.id, { rateType: e.target.value })}
              disabled={!editable}
              className={`${cell} w-full`}
            >
              {RATE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </td>
          <td className="p-1">
            <select
              value={line.measurement}
              onChange={(e) => onUpdateLine(line.id, { measurement: e.target.value })}
              disabled={!editable}
              className={`${cell} w-full`}
            >
              {MEASUREMENTS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </td>
          <td className="p-1">
            <input
              value={line.addedValue}
              onChange={(e) => onUpdateLine(line.id, { addedValue: e.target.value })}
              disabled={!editable}
              placeholder="IG story, x2 stories…"
              className={`${cell} w-full`}
            />
          </td>
          <td className="p-1">
            <input
              value={line.notes}
              onChange={(e) => onUpdateLine(line.id, { notes: e.target.value })}
              disabled={!editable}
              className={`${cell} w-full`}
            />
          </td>
          <td className="text-center align-middle">
            {editable && (
              <button
                onClick={() => setConfirmDeleteLine(line.id)}
                className="p-1.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                title="Delete line"
              >
                <Trash2 size={13} />
              </button>
            )}
          </td>
        </tr>
      ))}

      {/* Add line within phase */}
      {editable && (
        <tr>
          <td />
          <td colSpan={15} className="px-1 py-1.5">
            <button
              onClick={onAddLine}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#ffd700] hover:text-[#e6c200] transition-colors"
            >
              <Plus size={12} /> Add Line
            </button>
          </td>
        </tr>
      )}

      {/* Subtotal row */}
      <tr className="bg-gray-50 text-xs font-semibold text-gray-600">
        <td />
        <td className="px-2 py-2" colSpan={8}>
          {phase.name} subtotal
        </td>
        <td className="px-2 py-2 text-right tabular-nums text-gray-900 text-sm">{gbp0(subtotal)}</td>
        <td colSpan={6} />
      </tr>

      {confirmDeleteLine && (
        <DeleteRowConfirm
          label="Delete this line?"
          onConfirm={() => {
            onDeleteLine(confirmDeleteLine);
            setConfirmDeleteLine(null);
          }}
          onClose={() => setConfirmDeleteLine(null)}
        />
      )}
      {confirmDeletePhase && (
        <DeleteRowConfirm
          label={`Delete phase "${phase.name}" and its ${phase.lines.length} line${phase.lines.length === 1 ? "" : "s"}?`}
          onConfirm={() => {
            onDeletePhase();
            setConfirmDeletePhase(false);
          }}
          onClose={() => setConfirmDeletePhase(false)}
        />
      )}
    </>
  );
}

// ─── Deal Economics ───────────────────────────────────────────────────────────
function DealEconomics({
  total,
  marginPct,
  marginAmt,
  onMarginPct,
  onMarginAmt,
  allocations,
  setAllocations,
  editable,
  margin,
  allocated,
  remaining,
  balanced,
  productionTotal,
  productionCount,
}: {
  total: number;
  marginPct: string;
  marginAmt: string;
  onMarginPct: (v: string) => void;
  onMarginAmt: (v: string) => void;
  allocations: AllocationDraft[];
  setAllocations: React.Dispatch<React.SetStateAction<AllocationDraft[]>>;
  editable: boolean;
  margin: number;
  allocated: number;
  remaining: number;
  balanced: boolean;
  productionTotal: number;
  productionCount: number;
}) {
  const inputCls =
    "px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#ffd700]/30 focus:border-[#ffd700] disabled:bg-gray-50 disabled:text-gray-500";

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 max-w-3xl">
      <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-1">
        <Film size={15} style={{ color: GOLD }} />
        Deal Economics
      </h3>
      <p className="text-xs text-gray-400 mb-4">
        Company margin and where the rest of the budget goes. Margin + allocations must equal the media plan total.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Media Plan Total</p>
          <div className="px-3 py-2 rounded-xl bg-gray-50 border border-gray-100 text-sm font-semibold text-gray-700 tabular-nums">
            {gbp0(total)}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Company Margin (%)</p>
          <div className="relative">
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={marginPct}
              onChange={(e) => onMarginPct(e.target.value)}
              disabled={!editable}
              placeholder="0"
              className={`${inputCls} w-full pr-7`}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">%</span>
          </div>
        </div>
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Company Margin (£)</p>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">£</span>
            <input
              type="number"
              min="0"
              value={marginAmt}
              onChange={(e) => onMarginAmt(e.target.value)}
              disabled={!editable}
              placeholder="0"
              className={`${inputCls} w-full pl-7`}
            />
          </div>
        </div>
      </div>

      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Budget Allocations</p>
      <p className="text-[11px] text-gray-400 mb-3">
        Where the money after margin goes. Tick the allocation that is the production budget — that amount is handed to
        the Production team.
      </p>
      <div className="space-y-2">
        {allocations.map((a, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="text"
              value={a.name}
              onChange={(e) => setAllocations((prev) => prev.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
              disabled={!editable}
              placeholder="Allocation (e.g. Media Spend, Production, Print Costs)"
              className={`${inputCls} flex-1`}
            />
            <div className="relative w-36">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">£</span>
              <input
                type="number"
                min="0"
                value={a.amount}
                onChange={(e) => setAllocations((prev) => prev.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))}
                disabled={!editable}
                placeholder="0"
                className={`${inputCls} w-full pl-7`}
              />
            </div>
            <button
              onClick={() =>
                setAllocations((prev) =>
                  prev.map((x, j) => ({ ...x, isProductionBudget: j === i ? !x.isProductionBudget : false }))
                )
              }
              disabled={!editable}
              title={a.isProductionBudget ? "This is the production budget" : "Mark as the production budget"}
              className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1.5 rounded-lg border transition-colors disabled:cursor-not-allowed ${
                a.isProductionBudget
                  ? "bg-red-50 border-red-200 text-[#ff4444]"
                  : "bg-white border-gray-200 text-gray-400 hover:border-gray-300"
              }`}
            >
              <Film size={11} /> Production
            </button>
            <button
              onClick={() => setAllocations((prev) => prev.filter((_, j) => j !== i))}
              disabled={!editable}
              className="p-2 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors disabled:opacity-30"
              title="Remove allocation"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      {editable && (
        <button
          onClick={() => setAllocations((prev) => [...prev, { name: "", amount: "", isProductionBudget: false }])}
          className="mt-3 flex items-center gap-1.5 text-xs font-medium text-[#ffd700] hover:text-[#e6c200] transition-colors"
        >
          <Plus size={13} /> Add allocation
        </button>
      )}

      <div className="mt-5 pt-4 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Margin</p>
          <p className="font-bold text-gray-900 tabular-nums">{gbp0(margin)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Allocated</p>
          <p className="font-bold text-gray-900 tabular-nums">{gbp0(allocated)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Margin + Allocated</p>
          <p className="font-bold text-gray-900 tabular-nums">{gbp0(margin + allocated)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Remaining</p>
          <p
            className={`font-bold tabular-nums ${
              remaining < -0.01 ? "text-red-500" : balanced ? "text-emerald-600" : "text-amber-600"
            }`}
          >
            {remaining < -0.01 ? `${gbp0(Math.abs(remaining))} over` : gbp0(Math.max(remaining, 0))}
          </p>
        </div>
      </div>

      {remaining < -0.01 && (
        <p className="text-[11px] text-red-500 bg-red-50 rounded-lg px-3 py-2 mt-3">
          Over-allocated — margin + allocations exceed the media plan total by {gbp0(Math.abs(remaining))}.
        </p>
      )}
      {productionCount === 0 && allocated > 0 && (
        <p className="text-[11px] text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mt-3">
          No allocation is flagged as the production budget yet — the Production team won&apos;t receive an allocation.
        </p>
      )}
      {productionTotal > 0 && (
        <p className="text-[11px] text-gray-500 mt-3">
          Production budget handed to the team: <span className="font-semibold text-gray-700">{gbp0(productionTotal)}</span>
        </p>
      )}
    </div>
  );
}

// ─── Small modals ─────────────────────────────────────────────────────────────
function ConfirmModal({
  title,
  icon,
  body,
  confirmLabel,
  confirmTone = "gold",
  busy,
  onConfirm,
  onClose,
}: {
  title: string;
  icon?: React.ReactNode;
  body: React.ReactNode;
  confirmLabel: string;
  confirmTone?: "gold" | "dark";
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="border-b border-gray-50 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            {icon}
            {title}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5">
          {body}
          <div className="flex gap-3 mt-5">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={busy}
              className={`flex-1 flex items-center justify-center gap-2 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 ${
                confirmTone === "dark" ? "bg-gray-900 hover:bg-gray-800" : "bg-[#ffd700] hover:bg-[#e6c200]"
              }`}
            >
              {busy && <Loader2 size={15} className="animate-spin" />}
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DeleteRowConfirm({ label, onConfirm, onClose }: { label: string; onConfirm: () => void; onClose: () => void }) {
  return (
    <tr>
      <td colSpan={16} className="p-0">
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-6 py-5">
              <p className="text-sm font-medium text-gray-800">{label}</p>
              <div className="flex gap-3 mt-5">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={onConfirm}
                  className="flex-1 bg-[#ff4444] text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-[#ff4444] transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}
