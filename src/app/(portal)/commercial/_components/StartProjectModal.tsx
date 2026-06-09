"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Film, Loader2, Plus, X } from "lucide-react";

export interface TrelloCardOption {
  id: string;
  name: string;
  client: string;
  budget: number | null;
}

interface Props {
  cards: TrelloCardOption[];
  onClose: () => void;
  onCreated: () => void;
}

const SPLIT_BARS: { key: SplitKey; label: string; color: string }[] = [
  { key: "production", label: "Production", color: "#D4A853" },
  { key: "media", label: "Media", color: "#5B8DEF" },
  { key: "internal", label: "Internal / overhead", color: "#10B981" },
  { key: "other", label: "Other", color: "#9CA3AF" },
];

type SplitKey = "production" | "media" | "internal" | "other";

function gbp(n: number): string {
  return `£${n.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
}

export default function StartProjectModal({ cards, onClose, onCreated }: Props) {
  const [trelloCardId, setTrelloCardId] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [clientName, setClientName] = useState("");
  const [totalBudget, setTotalBudget] = useState("");
  const [splits, setSplits] = useState<Record<SplitKey, string>>({
    production: "",
    media: "",
    internal: "",
    other: "",
  });
  const [requiresProduction, setRequiresProduction] = useState(false);
  const [productionBrief, setProductionBrief] = useState("");
  const [shootDates, setShootDates] = useState<string[]>([""]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill from the linked Trello card.
  useEffect(() => {
    if (!trelloCardId) return;
    const card = cards.find((c) => c.id === trelloCardId);
    if (!card) return;
    setCampaignName((prev) => prev || card.name);
    setClientName((prev) => prev || card.client || "");
    if (card.budget && !totalBudget) setTotalBudget(String(card.budget));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trelloCardId]);

  const total = Number(totalBudget) || 0;
  const splitNums = useMemo(
    () => ({
      production: Number(splits.production) || 0,
      media: Number(splits.media) || 0,
      internal: Number(splits.internal) || 0,
      other: Number(splits.other) || 0,
    }),
    [splits]
  );
  const splitSum =
    splitNums.production + splitNums.media + splitNums.internal + splitNums.other;
  const remaining = total - splitSum;
  const balanced = total > 0 && Math.abs(remaining) < 0.5;

  function updateSplit(key: SplitKey, value: string) {
    setSplits((prev) => ({ ...prev, [key]: value }));
  }
  function updateDate(i: number, value: string) {
    setShootDates((prev) => prev.map((d, j) => (j === i ? value : d)));
  }

  const canSubmit =
    campaignName.trim() &&
    clientName.trim() &&
    total > 0 &&
    balanced &&
    !submitting;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const card = cards.find((c) => c.id === trelloCardId);
      const res = await fetch("/api/commercial/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          campaignName: campaignName.trim(),
          clientName: clientName.trim(),
          trelloCardId: trelloCardId || null,
          trelloCardName: card?.name ?? null,
          totalBudget: total,
          productionBudget: splitNums.production,
          mediaBudget: splitNums.media,
          internalBudget: splitNums.internal,
          otherBudget: splitNums.other,
          requiresProduction,
          productionBrief: requiresProduction ? productionBrief.trim() : null,
          shootDates: requiresProduction ? shootDates.filter(Boolean) : [],
          notes: notes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create project");
      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create project");
    } finally {
      setSubmitting(false);
    }
  }

  const fieldClass =
    "mt-1 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853]";
  const labelClass =
    "block text-[10px] font-bold uppercase tracking-widest text-gray-400";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 font-[family-name:var(--font-manrope)]">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-50 bg-white px-6 py-4 rounded-t-2xl">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Start Project</h2>
            <p className="text-xs text-gray-500">
              Book a deal into a campaign with budget splits
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Link to Trello card */}
          <div>
            <label className={labelClass}>Link to Trello card (optional)</label>
            <select
              value={trelloCardId}
              onChange={(e) => setTrelloCardId(e.target.value)}
              className={fieldClass}
            >
              <option value="">— No linked card —</option>
              {cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.client ? ` · ${c.client}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>
                Project name <span className="text-red-400">*</span>
              </label>
              <input
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="e.g. Summer Campaign 2026"
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass}>
                Client name <span className="text-red-400">*</span>
              </label>
              <input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Aston Martin"
                className={fieldClass}
              />
            </div>
          </div>

          {/* Total budget */}
          <div>
            <label className={labelClass}>
              Total campaign budget (£) <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              min="0"
              value={totalBudget}
              onChange={(e) => setTotalBudget(e.target.value)}
              placeholder="0"
              className={fieldClass}
            />
          </div>

          {/* Budget splits */}
          <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className={labelClass}>Budget splits</p>
              <span
                className={`text-xs font-semibold ${
                  balanced
                    ? "text-emerald-600"
                    : total > 0
                      ? "text-red-500"
                      : "text-gray-400"
                }`}
              >
                {gbp(splitSum)} / {gbp(total)}
                {total > 0 && !balanced && (
                  <span className="ml-1 font-normal">
                    ({remaining > 0 ? `${gbp(remaining)} left` : `${gbp(-remaining)} over`})
                  </span>
                )}
                {balanced && <Check className="inline h-3.5 w-3.5 ml-1" />}
              </span>
            </div>

            {/* Visual allocation bar */}
            <div className="mb-3 flex h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
              {SPLIT_BARS.map((b) => {
                const v = splitNums[b.key];
                const pct = total > 0 ? Math.min(100, (v / total) * 100) : 0;
                return (
                  <div
                    key={b.key}
                    style={{ width: `${pct}%`, backgroundColor: b.color }}
                    className="h-full transition-all"
                  />
                );
              })}
            </div>

            <div className="space-y-2">
              {SPLIT_BARS.map((b) => (
                <div key={b.key} className="flex items-center gap-3">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: b.color }}
                  />
                  <label className="flex-1 text-xs font-medium text-gray-600">
                    {b.label}
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                      £
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={splits[b.key]}
                      onChange={(e) => updateSplit(b.key, e.target.value)}
                      placeholder="0"
                      className="w-32 rounded-lg border border-gray-200 bg-white py-1.5 pl-6 pr-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Requires production toggle */}
          <button
            type="button"
            onClick={() => setRequiresProduction((v) => !v)}
            className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors ${
              requiresProduction
                ? "border-[#D4A853] bg-amber-50/50"
                : "border-gray-200 bg-white hover:bg-gray-50"
            }`}
          >
            <div className="flex items-center gap-3">
              <Film
                size={18}
                className={requiresProduction ? "text-[#D4A853]" : "text-gray-400"}
              />
              <div>
                <p className="text-sm font-semibold text-gray-900">Requires production?</p>
                <p className="text-xs text-gray-500">
                  {requiresProduction
                    ? "A production card will be auto-created with a locked budget"
                    : "Tracks as a supplied-asset campaign"}
                </p>
              </div>
            </div>
            <span
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                requiresProduction ? "bg-[#D4A853]" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  requiresProduction ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </span>
          </button>

          {requiresProduction && (
            <div className="space-y-3 rounded-2xl border border-amber-100 bg-amber-50/30 p-4">
              <div>
                <label className={labelClass}>Production brief</label>
                <textarea
                  value={productionBrief}
                  onChange={(e) => setProductionBrief(e.target.value)}
                  rows={3}
                  placeholder="What needs shooting / producing…"
                  className={`${fieldClass} resize-none`}
                />
              </div>
              <div>
                <label className={labelClass}>Shoot dates</label>
                <div className="mt-1 space-y-2">
                  {shootDates.map((d, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="date"
                        value={d}
                        onChange={(e) => updateDate(i, e.target.value)}
                        className="flex-1 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30"
                      />
                      {shootDates.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setShootDates((prev) => prev.filter((_, j) => j !== i))
                          }
                          className="p-2 rounded-lg text-gray-300 hover:bg-red-50 hover:text-red-500"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShootDates((prev) => [...prev, ""])}
                    className="flex items-center gap-1.5 text-xs font-medium text-[#D4A853] hover:text-[#c49843]"
                  >
                    <Plus size={13} /> Add another date
                  </button>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className={labelClass}>Notes / brief</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Scope, deliverables, anything worth remembering…"
              className={`${fieldClass} resize-none`}
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={onClose}
              className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={!canSubmit}
              className="flex items-center gap-1.5 rounded-xl bg-[#D4A853] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#c49843] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Start Project
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
