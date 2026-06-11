"use client";

import { useMemo, useState } from "react";
import { Lock, Plus, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { BudgetLineItem, BUDGET_CATEGORIES, gbp } from "./types";

interface Props {
  productionId: string;
  items: BudgetLineItem[];
  campaignBudget: number | null;
  onCampaignBudgetChange: (n: number | null) => void;
  refresh: () => void;
  // When the production was created from the Commercial portal its total
  // allocation is locked — production can log costs but not change the total.
  locked?: boolean;
}

export default function BudgetTab({
  productionId,
  items,
  campaignBudget,
  onCampaignBudgetChange,
  refresh,
  locked = false,
}: Props) {
  const [budgetInput, setBudgetInput] = useState(
    campaignBudget != null ? String(campaignBudget) : ""
  );

  const totals = useMemo(() => {
    const t = (items ?? []).reduce(
      (acc, it) => {
        acc.budgeted += it.budgeted || 0;
        acc.actual += it.actual || 0;
        return acc;
      },
      { budgeted: 0, actual: 0 }
    );
    return { ...t, variance: t.budgeted - t.actual };
  }, [items]);

  const grouped = useMemo(() => {
    const map: Record<string, BudgetLineItem[]> = {};
    for (const cat of BUDGET_CATEGORIES) map[cat.key] = [];
    for (const it of items ?? []) {
      if (!map[it.category]) map[it.category] = [];
      map[it.category].push(it);
    }
    return map;
  }, [items]);

  // Categories outside the standard list (e.g. free-form ones copied from a
  // deal's budget breakdown) still need to render.
  const categories = useMemo(() => {
    const known = new Set(BUDGET_CATEGORIES.map((c) => c.key));
    const extras = Object.keys(grouped)
      .filter((key) => !known.has(key) && (grouped[key] ?? []).length > 0)
      .map((key) => ({ key, label: key.replace(/_/g, " ") }));
    return [...BUDGET_CATEGORIES, ...extras];
  }, [grouped]);

  async function addLine(category: string) {
    await fetch(`/api/productions/${productionId}/budget`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, description: "", budgeted: 0, actual: 0 }),
    });
    refresh();
  }

  async function updateLine(itemId: string, patch: Partial<BudgetLineItem>) {
    await fetch(`/api/productions/${productionId}/budget?itemId=${itemId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    refresh();
  }

  async function deleteLine(itemId: string) {
    await fetch(`/api/productions/${productionId}/budget?itemId=${itemId}`, {
      method: "DELETE",
    });
    refresh();
  }

  const overall = campaignBudget != null ? campaignBudget - totals.actual : null;

  return (
    <div className="space-y-5">
      {/* Top: campaign budget + totals */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          className={`rounded-2xl border shadow-sm p-5 md:col-span-1 ${
            locked ? "bg-amber-50/40 border-amber-100" : "bg-white border-gray-100"
          }`}
        >
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
            {locked ? "Allocated Production Budget" : "Total Campaign Budget"}
            {locked && <Lock size={11} className="text-[#D4A853]" />}
          </p>
          {locked ? (
            <>
              <div className="flex items-center gap-1">
                <span className="text-2xl font-semibold text-gray-900">
                  {gbp(campaignBudget ?? 0)}
                </span>
              </div>
              <p className="text-[11px] text-gray-500 mt-2 leading-snug">
                Budget set in Commercial — {gbp(campaignBudget ?? 0)} allocated for
                production. Line items below were copied from the deal&apos;s budget breakdown.
              </p>
              {campaignBudget != null && (
                <p
                  className={`text-xs font-medium mt-1.5 ${
                    overall! >= 0 ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {overall! >= 0
                    ? `${gbp(overall!)} remaining`
                    : `${gbp(Math.abs(overall!))} over`}
                </p>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center gap-1">
                <span className="text-2xl font-semibold text-gray-400">£</span>
                <input
                  type="number"
                  min="0"
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                  onBlur={() =>
                    onCampaignBudgetChange(budgetInput === "" ? null : Number(budgetInput))
                  }
                  placeholder="0"
                  className="text-2xl font-semibold text-gray-900 bg-transparent border-none outline-none w-full focus:bg-amber-50/40 rounded-md px-1"
                />
              </div>
              {campaignBudget != null && (
                <p
                  className={`text-xs font-medium mt-2 ${
                    overall! >= 0 ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {overall! >= 0
                    ? `${gbp(overall!)} remaining`
                    : `${gbp(Math.abs(overall!))} over`}
                </p>
              )}
            </>
          )}
        </div>
        <SummaryCard label="Total Budgeted" value={gbp(totals.budgeted)} />
        <SummaryCard
          label="Total Actual"
          value={gbp(totals.actual)}
          accent={
            totals.variance >= 0 ? (
              <span className="text-emerald-600 inline-flex items-center gap-1">
                <TrendingDown size={12} /> {gbp(totals.variance)} under
              </span>
            ) : (
              <span className="text-red-600 inline-flex items-center gap-1">
                <TrendingUp size={12} /> {gbp(Math.abs(totals.variance))} over
              </span>
            )
          }
        />
      </div>

      {/* Categories */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="grid grid-cols-12 px-5 py-3 bg-gray-50/60 border-b border-gray-100 text-[10px] font-bold uppercase tracking-widest text-gray-500">
          <div className="col-span-4">Description</div>
          <div className="col-span-2 text-right">Budgeted</div>
          <div className="col-span-2 text-right">Actual</div>
          <div className="col-span-2 text-right">Variance</div>
          <div className="col-span-2">Notes</div>
        </div>
        {categories.map((cat) => {
          const lines = grouped[cat.key] ?? [];
          const catBudgeted = lines.reduce((s, l) => s + (l.budgeted || 0), 0);
          const catActual = lines.reduce((s, l) => s + (l.actual || 0), 0);
          const catVariance = catBudgeted - catActual;
          return (
            <div key={cat.key} className="border-b border-gray-50 last:border-b-0">
              <div className="flex items-center justify-between px-5 py-2.5 bg-gray-50/30">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-700">
                    {cat.label}
                  </p>
                  {lines.length > 0 && (
                    <span className="text-[10px] text-gray-400">({lines.length})</span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  {lines.length > 0 && (
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-gray-500">{gbp(catBudgeted)}</span>
                      <span
                        className={`font-medium ${
                          catVariance >= 0 ? "text-emerald-600" : "text-red-600"
                        }`}
                      >
                        {catVariance >= 0 ? "" : "−"}
                        {gbp(Math.abs(catVariance))}
                      </span>
                    </div>
                  )}
                  <button
                    onClick={() => addLine(cat.key)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#D4A853] hover:text-[#c49843]"
                  >
                    <Plus size={12} /> Add
                  </button>
                </div>
              </div>
              {(lines ?? []).map((line) => (
                <BudgetRow
                  key={line.id}
                  line={line}
                  onUpdate={(patch) => updateLine(line.id, patch)}
                  onDelete={() => deleteLine(line.id)}
                />
              ))}
            </div>
          );
        })}
        {/* Total row */}
        <div className="grid grid-cols-12 px-5 py-3 bg-gray-50 border-t border-gray-100 text-sm font-semibold">
          <div className="col-span-4 text-gray-700">Total</div>
          <div className="col-span-2 text-right">{gbp(totals.budgeted)}</div>
          <div className="col-span-2 text-right">{gbp(totals.actual)}</div>
          <div
            className={`col-span-2 text-right ${
              totals.variance >= 0 ? "text-emerald-600" : "text-red-600"
            }`}
          >
            {totals.variance >= 0 ? "" : "−"}
            {gbp(Math.abs(totals.variance))}
          </div>
          <div className="col-span-2" />
        </div>
      </div>
    </div>
  );
}

function BudgetRow({
  line,
  onUpdate,
  onDelete,
}: {
  line: BudgetLineItem;
  onUpdate: (patch: Partial<BudgetLineItem>) => void;
  onDelete: () => void;
}) {
  const [description, setDescription] = useState(line.description);
  const [budgeted, setBudgeted] = useState(String(line.budgeted ?? 0));
  const [actual, setActual] = useState(String(line.actual ?? 0));
  const [notes, setNotes] = useState(line.notes ?? "");
  const variance = (line.budgeted || 0) - (line.actual || 0);

  return (
    <div className="grid grid-cols-12 px-5 py-2 items-center hover:bg-amber-50/20 group">
      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onBlur={() => {
          if (description !== line.description) onUpdate({ description });
        }}
        placeholder="Line item"
        className="col-span-4 text-sm bg-transparent border-none outline-none px-2 py-1 rounded-md focus:bg-white"
      />
      <input
        type="number"
        value={budgeted}
        onChange={(e) => setBudgeted(e.target.value)}
        onBlur={() => onUpdate({ budgeted: Number(budgeted) })}
        placeholder="0"
        className="col-span-2 text-sm bg-transparent border-none outline-none px-2 py-1 rounded-md focus:bg-white text-right tabular-nums"
      />
      <input
        type="number"
        value={actual}
        onChange={(e) => setActual(e.target.value)}
        onBlur={() => onUpdate({ actual: Number(actual) })}
        placeholder="0"
        className="col-span-2 text-sm bg-transparent border-none outline-none px-2 py-1 rounded-md focus:bg-white text-right tabular-nums"
      />
      <div
        className={`col-span-2 text-sm text-right font-medium tabular-nums ${
          variance >= 0 ? "text-emerald-600" : "text-red-600"
        }`}
      >
        {variance >= 0 ? "" : "−"}
        {gbp(Math.abs(variance))}
      </div>
      <div className="col-span-2 flex items-center gap-1">
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => {
            if (notes !== (line.notes ?? "")) onUpdate({ notes });
          }}
          placeholder="—"
          className="flex-1 text-xs text-gray-500 bg-transparent border-none outline-none px-2 py-1 rounded-md focus:bg-white"
        />
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 p-1"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">{label}</p>
      <p className="text-2xl font-semibold text-gray-900">{value}</p>
      {accent && <p className="text-xs mt-1.5 font-medium">{accent}</p>}
    </div>
  );
}
