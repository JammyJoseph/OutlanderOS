"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Briefcase,
  Lock,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import {
  BudgetLineItem,
  BUDGET_CATEGORIES,
  gbp,
  ProductionFull,
  ProductionBudgetStatus,
} from "./types";

interface Props {
  production: ProductionFull;
  items: BudgetLineItem[];
  campaignBudget: number | null;
  onCampaignBudgetChange: (n: number | null) => void;
  refresh: () => void;
  // When the production was created from the Commercial portal its total
  // allocation is locked — production can log costs but not change the total.
  locked?: boolean;
}

const STATUS_FLOW: ProductionBudgetStatus[] = ["BUDGETING", "LOCKED", "IN_PROGRESS", "FINAL"];

const STATUS_STYLES: Record<ProductionBudgetStatus, { bg: string; text: string; label: string }> = {
  BUDGETING: { bg: "bg-blue-100", text: "text-blue-700", label: "Budgeting" },
  LOCKED: { bg: "bg-amber-100", text: "text-amber-700", label: "Locked" },
  IN_PROGRESS: { bg: "bg-purple-100", text: "text-purple-700", label: "In Progress" },
  FINAL: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Final" },
};

export default function BudgetTab({
  production,
  items,
  campaignBudget,
  onCampaignBudgetChange,
  refresh,
  locked = false,
}: Props) {
  const [budgetInput, setBudgetInput] = useState(
    campaignBudget != null ? String(campaignBudget) : ""
  );
  const [apiError, setApiError] = useState<string | null>(null);
  const [confirmStatus, setConfirmStatus] = useState<ProductionBudgetStatus | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setIsAdmin(d.user?.role === "ADMIN"))
      .catch(() => {});
  }, []);

  // Budget lifecycle only applies to productions cleared from Commercial.
  const budgetStatus: ProductionBudgetStatus | null = locked
    ? production.productionBudgetStatus ?? "BUDGETING"
    : null;
  const canEditBudgeted = !budgetStatus || budgetStatus === "BUDGETING";
  const canEditActual = budgetStatus !== "FINAL";

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

  async function handleResponse(res: Response) {
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setApiError(data.error || "That change was not allowed.");
      setTimeout(() => setApiError(null), 5000);
    } else {
      setApiError(null);
    }
    refresh();
  }

  async function addLine(category: string) {
    const res = await fetch(`/api/productions/${production.id}/budget`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, description: "", budgeted: 0, actual: 0 }),
    });
    await handleResponse(res);
  }

  async function updateLine(itemId: string, patch: Partial<BudgetLineItem>) {
    const res = await fetch(`/api/productions/${production.id}/budget?itemId=${itemId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    await handleResponse(res);
  }

  async function deleteLine(itemId: string) {
    const res = await fetch(`/api/productions/${production.id}/budget?itemId=${itemId}`, {
      method: "DELETE",
    });
    await handleResponse(res);
  }

  function reopenBudget(current: ProductionBudgetStatus) {
    // LOCKED reopens to BUDGETING (line items editable again);
    // FINAL reopens to IN_PROGRESS (actuals editable again).
    const target: ProductionBudgetStatus = current === "FINAL" ? "IN_PROGRESS" : "BUDGETING";
    const message =
      current === "FINAL"
        ? "Reopen this finalised budget? Actual costs become editable again and the result is no longer reported as final to Finance."
        : "Reopen this locked budget? Budgeted amounts become editable again.";
    if (!confirm(message)) return;
    setBudgetStatus(target);
  }

  async function setBudgetStatus(next: ProductionBudgetStatus) {
    setStatusBusy(true);
    try {
      const res = await fetch(`/api/productions/${production.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productionBudgetStatus: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setApiError(data.error || "Failed to update budget status");
        setTimeout(() => setApiError(null), 5000);
      } else {
        setApiError(null);
      }
      setConfirmStatus(null);
      refresh();
    } finally {
      setStatusBusy(false);
    }
  }

  const allocation = campaignBudget ?? 0;
  const overall = campaignBudget != null ? campaignBudget - totals.actual : null;
  const remainingToBudget = campaignBudget != null ? campaignBudget - totals.budgeted : null;
  const spentPct = allocation > 0 ? Math.min((totals.actual / allocation) * 100, 100) : 0;
  const overSpent = allocation > 0 && totals.actual > allocation;

  // Deal context + margin impact (commercial productions only).
  const deal = production.campaign;
  const dealTotal = deal?.value ?? null;
  const targetMarginPct = deal?.marginPercent ?? null;
  const targetMarginAmt =
    deal?.marginAmount ?? (targetMarginPct != null && dealTotal ? (dealTotal * targetMarginPct) / 100 : null);
  const savings = campaignBudget != null ? campaignBudget - totals.actual : null;
  const newMarginPct =
    savings != null && targetMarginAmt != null && dealTotal
      ? ((targetMarginAmt + savings) / dealTotal) * 100
      : null;

  // The lock-step button for the current status.
  const nextAction: { next: ProductionBudgetStatus; label: string; confirm: string } | null =
    budgetStatus === "BUDGETING"
      ? {
          next: "LOCKED",
          label: "Lock Budget",
          confirm: `Lock the line-item budget at ${gbp(totals.budgeted)}? Budgeted amounts become read-only — only actual costs can be entered afterwards.`,
        }
      : budgetStatus === "LOCKED"
        ? {
            next: "IN_PROGRESS",
            label: "Start Tracking Actuals",
            confirm: "Mark this budget as in progress? Use this once the project is live and actual costs are coming in.",
          }
        : budgetStatus === "IN_PROGRESS"
          ? {
              next: "FINAL",
              label: "Submit Final Actuals",
              confirm: `Finalise the budget at ${gbp(totals.actual)} actual spend? Everything becomes read-only and the result is reported to Finance. Only an admin can reopen it.`,
            }
          : null;

  return (
    <div className="space-y-5">
      {/* Lifecycle status bar — commercial productions only */}
      {budgetStatus && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mr-1">
              Budget Status
            </p>
            {STATUS_FLOW.map((s, i) => {
              const style = STATUS_STYLES[s];
              const active = s === budgetStatus;
              const passed = STATUS_FLOW.indexOf(budgetStatus) > i;
              return (
                <span key={s} className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                      active
                        ? `${style.bg} ${style.text}`
                        : passed
                          ? "bg-gray-100 text-gray-500"
                          : "bg-gray-50 text-gray-300"
                    }`}
                  >
                    {passed && <CheckCircle2 size={11} />}
                    {style.label}
                  </span>
                  {i < STATUS_FLOW.length - 1 && <span className="text-gray-200 text-xs">→</span>}
                </span>
              );
            })}
          </div>
          <div className="flex items-center gap-3">
            {nextAction && (
              <button
                onClick={() => setConfirmStatus(nextAction.next)}
                className="flex items-center gap-2 bg-[#D4A853] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#c49843] transition-colors shadow-sm"
              >
                <Lock size={13} />
                {nextAction.label}
              </button>
            )}
            {/* Admin-only reopen: LOCKED goes back to budgeting, FINAL back to
                tracking actuals. */}
            {isAdmin && (budgetStatus === "LOCKED" || budgetStatus === "FINAL") && (
              <button
                onClick={() => reopenBudget(budgetStatus)}
                disabled={statusBusy}
                className="text-xs font-medium text-amber-700 hover:text-amber-900 underline underline-offset-2 disabled:opacity-50"
              >
                Reopen Budget (admin)
              </button>
            )}
          </div>
        </div>
      )}
      {budgetStatus && (budgetStatus === "LOCKED" || budgetStatus === "FINAL") && production.productionLockedAt && (
        <p className="text-[11px] text-gray-400 -mt-3 px-1">
          Budget {budgetStatus === "FINAL" ? "finalised" : "locked"} on{" "}
          {new Date(production.productionLockedAt).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
          {isAdmin ? "" : " — ask an admin to reopen it"}
        </p>
      )}

      {apiError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
          {apiError}
        </div>
      )}

      {/* Top: allocation + totals */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          className={`rounded-2xl border shadow-sm p-5 md:col-span-1 ${
            locked ? "bg-amber-50/40 border-amber-100" : "bg-white border-gray-100"
          }`}
        >
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
            {locked ? "Production Budget" : "Total Campaign Budget"}
            {locked && <Lock size={11} className="text-[#D4A853]" />}
          </p>
          {locked ? (
            <>
              <span className="text-2xl font-semibold text-gray-900">
                {gbp(campaignBudget ?? 0)}
              </span>
              {deal && production.campaignId && (
                <p className="text-[11px] text-gray-500 mt-2 leading-snug">
                  From deal:{" "}
                  <Link
                    href={`/commercial/deals/${production.campaignId}`}
                    className="font-medium text-[#D4A853] hover:text-[#c49843] inline-flex items-center gap-0.5"
                  >
                    <Briefcase size={10} /> {deal.title} <ArrowUpRight size={10} />
                  </Link>
                  {dealTotal != null && (
                    <>
                      {" — "}Total deal: {gbp(dealTotal)}
                      {targetMarginPct != null ? `, Margin: ${targetMarginPct}%` : ""}
                    </>
                  )}
                </p>
              )}
              <p className="text-[11px] text-gray-400 mt-1 leading-snug">
                Set by Commercial — read-only here.
              </p>
              {/* Spent vs budget progress */}
              {allocation > 0 && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-gray-500">
                      {gbp(totals.actual)} / {gbp(allocation)} spent
                    </span>
                    <span className={`font-semibold ${overSpent ? "text-red-600" : "text-gray-600"}`}>
                      {Math.round((totals.actual / allocation) * 100)}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={`h-full rounded-full transition-all ${
                        overSpent ? "bg-red-500" : "bg-[#D4A853]"
                      }`}
                      style={{ width: `${spentPct}%` }}
                    />
                  </div>
                </div>
              )}
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
        <SummaryCard
          label="Total Budgeted"
          value={gbp(totals.budgeted)}
          accent={
            remainingToBudget != null ? (
              remainingToBudget >= 0 ? (
                <span className="text-gray-500">
                  Remaining to budget: <span className="text-emerald-600">{gbp(remainingToBudget)}</span>
                </span>
              ) : (
                <span className="text-red-600">
                  {gbp(Math.abs(remainingToBudget))} over the allocation
                </span>
              )
            ) : undefined
          }
        />
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

      {/* Line items grouped by category — this is the live P&L */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-gray-50/60 border-b border-gray-100 flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-600">
            Production P&amp;L
          </p>
          {!canEditBudgeted && (
            <p className="text-[10px] font-medium text-amber-600 flex items-center gap-1">
              <Lock size={10} />
              {budgetStatus === "FINAL"
                ? "Final — read-only"
                : "Budgeted amounts locked — actuals only"}
            </p>
          )}
        </div>
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
          if (!canEditBudgeted && lines.length === 0) return null;
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
                  {canEditBudgeted && (
                    <button
                      onClick={() => addLine(cat.key)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-[#D4A853] hover:text-[#c49843]"
                    >
                      <Plus size={12} /> Add
                    </button>
                  )}
                </div>
              </div>
              {(lines ?? []).map((line) => (
                <BudgetRow
                  key={line.id}
                  line={line}
                  canEditBudgeted={canEditBudgeted}
                  canEditActual={canEditActual}
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
            {totals.variance >= 0 ? "+" : "−"}
            {gbp(Math.abs(totals.variance))}
            {totals.variance >= 0 ? " saved" : " over"}
          </div>
          <div className="col-span-2" />
        </div>
      </div>

      {/* Margin impact — commercial productions with a deal margin */}
      {locked && savings != null && allocation > 0 && (
        <div
          className={`rounded-2xl border px-5 py-4 ${
            savings >= 0 ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"
          }`}
        >
          <p
            className={`text-sm font-semibold ${
              savings >= 0 ? "text-emerald-800" : "text-red-700"
            }`}
          >
            {savings >= 0
              ? `Production Savings: ${gbp(savings)}`
              : `Production Overspend: ${gbp(Math.abs(savings))}`}
            {targetMarginPct != null && newMarginPct != null && (
              <span className="font-normal">
                {" "}
                — this {savings >= 0 ? "increases" : "reduces"} the deal margin from{" "}
                {Math.round(targetMarginPct * 10) / 10}% to {Math.round(newMarginPct * 10) / 10}%
              </span>
            )}
          </p>
          <p className={`text-xs mt-1 ${savings >= 0 ? "text-emerald-600" : "text-red-500"}`}>
            Allocation {gbp(allocation)} − actuals {gbp(totals.actual)}. Savings flow straight into
            the company margin{budgetStatus !== "FINAL" ? " — final once actuals are submitted" : ""}.
          </p>
        </div>
      )}

      {/* Status-change confirmation */}
      {confirmStatus && nextAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="border-b border-gray-50 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Lock size={16} className="text-[#D4A853]" /> {nextAction.label}
              </h2>
              <button
                onClick={() => setConfirmStatus(null)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-gray-600">{nextAction.confirm}</p>
              {confirmStatus === "LOCKED" &&
                remainingToBudget != null &&
                Math.abs(remainingToBudget) > 0.01 && (
                  <p
                    className={`text-xs rounded-lg px-3 py-2 mt-3 ${
                      remainingToBudget > 0
                        ? "text-amber-600 bg-amber-50"
                        : "text-red-500 bg-red-50"
                    }`}
                  >
                    {remainingToBudget > 0
                      ? `${gbp(remainingToBudget)} of the allocation is not budgeted yet — any unspent budget becomes savings.`
                      : `The line items exceed the allocation by ${gbp(Math.abs(remainingToBudget))}.`}
                  </p>
                )}
              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => setConfirmStatus(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setBudgetStatus(confirmStatus)}
                  disabled={statusBusy}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#D4A853] text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-[#c49843] transition-colors disabled:opacity-50"
                >
                  {statusBusy ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />}
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BudgetRow({
  line,
  canEditBudgeted,
  canEditActual,
  onUpdate,
  onDelete,
}: {
  line: BudgetLineItem;
  canEditBudgeted: boolean;
  canEditActual: boolean;
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
        disabled={!canEditActual && !canEditBudgeted}
        placeholder="Line item"
        className="col-span-4 text-sm bg-transparent border-none outline-none px-2 py-1 rounded-md focus:bg-white disabled:text-gray-500"
      />
      <input
        type="number"
        value={budgeted}
        onChange={(e) => setBudgeted(e.target.value)}
        onBlur={() => onUpdate({ budgeted: Number(budgeted) })}
        disabled={!canEditBudgeted}
        placeholder="0"
        title={canEditBudgeted ? undefined : "Budgeted amounts are locked"}
        className="col-span-2 text-sm bg-transparent border-none outline-none px-2 py-1 rounded-md focus:bg-white text-right tabular-nums disabled:text-gray-500"
      />
      <input
        type="number"
        value={actual}
        onChange={(e) => setActual(e.target.value)}
        onBlur={() => onUpdate({ actual: Number(actual) })}
        disabled={!canEditActual}
        placeholder="0"
        title={canEditActual ? undefined : "The budget is final — actuals are read-only"}
        className="col-span-2 text-sm bg-transparent border-none outline-none px-2 py-1 rounded-md focus:bg-white text-right tabular-nums disabled:text-gray-500"
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
          disabled={!canEditActual && !canEditBudgeted}
          placeholder="—"
          className="flex-1 text-xs text-gray-500 bg-transparent border-none outline-none px-2 py-1 rounded-md focus:bg-white"
        />
        {canEditBudgeted && (
          <button
            onClick={onDelete}
            className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 p-1"
          >
            <Trash2 size={13} />
          </button>
        )}
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
