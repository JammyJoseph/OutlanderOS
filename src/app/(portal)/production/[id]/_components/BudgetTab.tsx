"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Briefcase,
  ChevronDown,
  ChevronRight,
  Lock,
  Plus,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import {
  BudgetLineItem,
  BUDGET_SECTIONS,
  gbp,
  lineTotal,
  ProductionFull,
  ProductionBudgetStatus,
  sectionOf,
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

const DEFAULT_MARKUP = 10;
const DEFAULT_VAT = 20;

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
  const [seeding, setSeeding] = useState(false);

  // Markup / VAT — live inputs, persisted on blur.
  const [markupInput, setMarkupInput] = useState(
    String(production.budgetMarkupPercent ?? DEFAULT_MARKUP)
  );
  const [vatInput, setVatInput] = useState(String(production.budgetVatPercent ?? DEFAULT_VAT));

  // Collapsed sections, remembered per-production in sessionStorage.
  const collapseKey = `prodBudgetCollapse:${production.id}`;
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(collapseKey);
      if (raw) setCollapsed(JSON.parse(raw));
    } catch {}
  }, [collapseKey]);
  function toggleSection(key: string) {
    setCollapsed((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        sessionStorage.setItem(collapseKey, JSON.stringify(next));
      } catch {}
      return next;
    });
  }

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
  const isFinal = budgetStatus === "FINAL";

  const totals = useMemo(() => {
    const t = (items ?? []).reduce(
      (acc, it) => {
        acc.budgeted += lineTotal(it);
        acc.actual += it.actual || 0;
        return acc;
      },
      { budgeted: 0, actual: 0 }
    );
    return { ...t, variance: t.budgeted - t.actual };
  }, [items]);

  // Group items by section (explicit section, else mapped from legacy category).
  const grouped = useMemo(() => {
    const map: Record<string, BudgetLineItem[]> = {};
    for (const s of BUDGET_SECTIONS) map[s.key] = [];
    for (const it of items ?? []) {
      const key = sectionOf(it);
      if (!map[key]) map[key] = [];
      map[key].push(it);
    }
    return map;
  }, [items]);

  // Sections to render: all standard sections, plus any unknown keys that
  // somehow carry items (defensive — shouldn't normally happen).
  const sections = useMemo(() => {
    const known = new Set(BUDGET_SECTIONS.map((s) => s.key));
    const extras = Object.keys(grouped)
      .filter((k) => !known.has(k) && (grouped[k] ?? []).length > 0)
      .map((k) => ({ key: k, label: k.replace(/_/g, " "), accent: "border-l-gray-300", costCategory: "other", template: [] }));
    return [...BUDGET_SECTIONS, ...extras];
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

  async function addLine(section: string) {
    const res = await fetch(`/api/productions/${production.id}/budget`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section, role: "", description: "", budgeted: 0, actual: 0 }),
    });
    await handleResponse(res);
  }

  async function seedTemplate() {
    setSeeding(true);
    try {
      const res = await fetch(`/api/productions/${production.id}/budget`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: true }),
      });
      await handleResponse(res);
    } finally {
      setSeeding(false);
    }
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

  // Persist a production-level patch (markup / VAT) and refresh.
  async function saveProduction(patch: { budgetMarkupPercent?: number | null; budgetVatPercent?: number | null }) {
    const res = await fetch(`/api/productions/${production.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    await handleResponse(res);
  }

  function reopenBudget(current: ProductionBudgetStatus) {
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
  const spentPct = allocation > 0 ? Math.min((totals.actual / allocation) * 100, 100) : 0;
  const overSpent = allocation > 0 && totals.actual > allocation;

  // Summary maths — markup applies to the budgeted subtotal, VAT on top.
  const markupPct = markupInput === "" ? 0 : Number(markupInput) || 0;
  const vatPct = vatInput === "" ? 0 : Number(vatInput) || 0;
  const subtotal = totals.budgeted;
  const markupAmt = subtotal * (markupPct / 100);
  const totalExcVat = subtotal + markupAmt;
  const vatAmt = totalExcVat * (vatPct / 100);
  const grandTotal = totalExcVat + vatAmt;
  const budgetCoversCosts = campaignBudget != null ? campaignBudget - grandTotal : null;

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

  const hasItems = (items ?? []).length > 0;

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
                className="flex items-center gap-2 bg-[#ffd700] text-black px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#e6c200] transition-colors shadow-sm"
              >
                <Lock size={13} />
                {nextAction.label}
              </button>
            )}
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
            {locked ? "Allocated Budget" : "Total Campaign Budget"}
            {locked && <Lock size={11} className="text-[#ffd700]" />}
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
                    className="font-medium text-[#ffd700] hover:text-[#e6c200] inline-flex items-center gap-0.5"
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
                        overSpent ? "bg-red-500" : "bg-[#ffd700]"
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
        <SummaryCard label="Total Budgeted" value={gbp(totals.budgeted)} accent={
          <span className="text-gray-500">Grand total inc. VAT: <span className="text-gray-700 font-semibold">{gbp(grandTotal)}</span></span>
        } />
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

      {/* Empty-state template CTA */}
      {!hasItems && canEditBudgeted && (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 shadow-sm px-6 py-8 text-center">
          <p className="text-sm font-semibold text-gray-700 mb-1">Start your production budget</p>
          <p className="text-xs text-gray-500 mb-4 max-w-md mx-auto">
            Populate the standard industry sections (Pre-Production, Crew, Talent, Equipment, Post…)
            with common line items, ready to fill in. You can add or remove lines from any section.
          </p>
          <button
            onClick={seedTemplate}
            disabled={seeding}
            className="inline-flex items-center gap-2 bg-[#ffd700] text-black px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-[#e6c200] transition-colors shadow-sm disabled:opacity-50"
          >
            {seeding ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            Set up from template
          </button>
        </div>
      )}

      {/* Line items grouped by section — this is the live P&L */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-gray-50/60 border-b border-gray-100 flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-600">
            Production Budget
          </p>
          <div className="flex items-center gap-4">
            {hasItems && canEditBudgeted && (
              <button
                onClick={seedTemplate}
                disabled={seeding}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-gray-700 disabled:opacity-50"
                title="Add any missing standard sections"
              >
                {seeding ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                Fill template
              </button>
            )}
            {!canEditBudgeted && (
              <p className="text-[10px] font-medium text-amber-600 flex items-center gap-1">
                <Lock size={10} />
                {isFinal ? "Final — read-only" : "Budgeted amounts locked — actuals only"}
              </p>
            )}
          </div>
        </div>
        {/* Sticky column headers */}
        <div className="grid grid-cols-12 px-5 py-2.5 bg-gray-50/60 border-b border-gray-100 text-[10px] font-bold uppercase tracking-widest text-gray-500 sticky top-0 z-10">
          <div className="col-span-3">Role / Item</div>
          <div className="col-span-3">Description</div>
          <div className="col-span-1 text-right">Qty</div>
          <div className="col-span-1 text-right">Rate</div>
          <div className="col-span-1 text-right">Total</div>
          <div className="col-span-1 text-right">Actuals</div>
          <div className="col-span-2 text-right pr-6">Variance</div>
        </div>

        {sections.map((sec) => {
          const lines = grouped[sec.key] ?? [];
          if (!canEditBudgeted && lines.length === 0) return null;
          const secBudgeted = lines.reduce((s, l) => s + lineTotal(l), 0);
          const secActual = lines.reduce((s, l) => s + (l.actual || 0), 0);
          const secVariance = secBudgeted - secActual;
          const isCollapsed = !!collapsed[sec.key];
          return (
            <div key={sec.key} className={`border-b border-gray-50 last:border-b-0 border-l-2 ${sec.accent}`}>
              <button
                onClick={() => toggleSection(sec.key)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50/40 hover:bg-gray-50/80 transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  {isCollapsed ? (
                    <ChevronRight size={14} className="text-gray-400" />
                  ) : (
                    <ChevronDown size={14} className="text-gray-400" />
                  )}
                  <span className="text-xs font-bold uppercase tracking-widest text-gray-700">
                    {sec.label}
                  </span>
                  {lines.length > 0 && (
                    <span className="text-[10px] text-gray-400">({lines.length})</span>
                  )}
                </div>
                <div className="flex items-center gap-5 text-xs tabular-nums">
                  <span className="text-gray-500" title="Budgeted">{gbp(secBudgeted)}</span>
                  <span className="text-gray-400" title="Actuals">{gbp(secActual)}</span>
                  <span
                    className={`font-medium w-20 text-right ${
                      secVariance >= 0 ? "text-emerald-600" : "text-red-600"
                    }`}
                    title="Variance"
                  >
                    {secVariance >= 0 ? "" : "−"}
                    {gbp(Math.abs(secVariance))}
                  </span>
                </div>
              </button>
              {!isCollapsed && (
                <>
                  {lines.map((line) => (
                    <BudgetRow
                      key={line.id}
                      line={line}
                      canEditBudgeted={canEditBudgeted}
                      canEditActual={canEditActual}
                      onUpdate={(patch) => updateLine(line.id, patch)}
                      onDelete={() => deleteLine(line.id)}
                    />
                  ))}
                  {canEditBudgeted && (
                    <div className="px-5 py-1.5">
                      <button
                        onClick={() => addLine(sec.key)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-[#ffd700] hover:text-[#e6c200]"
                      >
                        <Plus size={12} /> Add line
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}

        {/* Grand budgeted/actual total row */}
        <div className="grid grid-cols-12 px-5 py-3 bg-gray-50 border-t border-gray-100 text-sm font-semibold tabular-nums">
          <div className="col-span-6 text-gray-700">Total</div>
          <div className="col-span-1" />
          <div className="col-span-1" />
          <div className="col-span-1 text-right">{gbp(totals.budgeted)}</div>
          <div className="col-span-1 text-right">{gbp(totals.actual)}</div>
          <div
            className={`col-span-2 text-right pr-6 ${
              totals.variance >= 0 ? "text-emerald-600" : "text-red-600"
            }`}
          >
            {totals.variance >= 0 ? "+" : "−"}
            {gbp(Math.abs(totals.variance))}
          </div>
        </div>
      </div>

      {/* Budget summary — subtotal → markup → VAT → grand total */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-gray-50/60 border-b border-gray-100">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-600">Budget Summary</p>
        </div>
        <div className="px-5 py-4 space-y-2.5 max-w-xl ml-auto">
          <SummaryRow label="Subtotal (all sections)" value={gbp(subtotal)} />
          <SummaryRow
            label="Markup"
            editable={!isFinal}
            percentValue={markupInput}
            onPercentChange={setMarkupInput}
            onPercentBlur={() =>
              saveProduction({ budgetMarkupPercent: markupInput === "" ? null : Number(markupInput) })
            }
            value={gbp(markupAmt)}
          />
          <SummaryRow label="Total exc. VAT" value={gbp(totalExcVat)} strong />
          <SummaryRow
            label="VAT"
            editable={!isFinal}
            percentValue={vatInput}
            onPercentChange={setVatInput}
            onPercentBlur={() =>
              saveProduction({ budgetVatPercent: vatInput === "" ? null : Number(vatInput) })
            }
            value={gbp(vatAmt)}
          />
          <div className="border-t border-gray-100 pt-2.5">
            <SummaryRow label="Grand Total" value={gbp(grandTotal)} grand />
          </div>
          <div className="border-t border-gray-100 pt-2.5 space-y-2.5">
            <SummaryRow
              label={locked ? "Allocated Budget (Commercial)" : "Campaign Budget"}
              value={gbp(allocation)}
              muted
            />
            {campaignBudget != null && (
              <div
                className={`flex items-center justify-between rounded-xl px-3 py-2.5 ${
                  budgetCoversCosts! >= 0
                    ? "bg-emerald-50 border border-emerald-200"
                    : "bg-red-50 border border-red-200"
                }`}
              >
                <span
                  className={`text-xs font-semibold inline-flex items-center gap-1.5 ${
                    budgetCoversCosts! >= 0 ? "text-emerald-700" : "text-red-700"
                  }`}
                >
                  {budgetCoversCosts! >= 0 ? (
                    <>
                      <CheckCircle2 size={14} /> Budget covers the costs
                    </>
                  ) : (
                    <>
                      <TrendingUp size={14} /> Costs exceed the allocated budget
                    </>
                  )}
                </span>
                <span
                  className={`text-sm font-bold tabular-nums ${
                    budgetCoversCosts! >= 0 ? "text-emerald-700" : "text-red-700"
                  }`}
                >
                  {budgetCoversCosts! >= 0
                    ? `${gbp(budgetCoversCosts!)} headroom`
                    : `${gbp(Math.abs(budgetCoversCosts!))} over`}
                </span>
              </div>
            )}
          </div>
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
            the company margin{!isFinal ? " — final once actuals are submitted" : ""}.
          </p>
        </div>
      )}

      {/* Status-change confirmation */}
      {confirmStatus && nextAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="border-b border-gray-50 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Lock size={16} className="text-[#ffd700]" /> {nextAction.label}
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
                  className="flex-1 flex items-center justify-center gap-2 bg-[#ffd700] text-black px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-[#e6c200] transition-colors disabled:opacity-50"
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
  const [role, setRole] = useState(line.role ?? "");
  const [description, setDescription] = useState(line.description);
  const [quantity, setQuantity] = useState(line.quantity != null ? String(line.quantity) : "");
  const [rate, setRate] = useState(line.rate != null ? String(line.rate) : "");
  const [actual, setActual] = useState(String(line.actual ?? 0));

  const total = lineTotal(line);
  const variance = total - (line.actual || 0);

  const editAny = canEditActual || canEditBudgeted;

  return (
    <div className="grid grid-cols-12 px-5 py-1.5 items-center hover:bg-amber-50/20 group min-h-[28px]">
      <input
        type="text"
        value={role}
        onChange={(e) => setRole(e.target.value)}
        onBlur={() => {
          if (role !== (line.role ?? "")) onUpdate({ role });
        }}
        disabled={!canEditBudgeted}
        placeholder="Role / item"
        className="col-span-3 text-[12px] font-medium bg-transparent border-none outline-none px-2 py-1 rounded-md focus:bg-white disabled:text-gray-500 truncate"
      />
      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onBlur={() => {
          if (description !== line.description) onUpdate({ description });
        }}
        disabled={!editAny}
        placeholder="Description"
        className="col-span-3 text-[12px] text-gray-600 bg-transparent border-none outline-none px-2 py-1 rounded-md focus:bg-white disabled:text-gray-400 truncate"
      />
      <input
        type="number"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        onBlur={() => {
          const v = quantity === "" ? null : Number(quantity);
          if (v !== line.quantity) onUpdate({ quantity: v });
        }}
        disabled={!canEditBudgeted}
        placeholder="—"
        className="col-span-1 text-[12px] bg-transparent border-none outline-none px-1 py-1 rounded-md focus:bg-white text-right tabular-nums disabled:text-gray-500"
      />
      <input
        type="number"
        value={rate}
        onChange={(e) => setRate(e.target.value)}
        onBlur={() => {
          const v = rate === "" ? null : Number(rate);
          if (v !== line.rate) onUpdate({ rate: v });
        }}
        disabled={!canEditBudgeted}
        placeholder="—"
        className="col-span-1 text-[12px] bg-transparent border-none outline-none px-1 py-1 rounded-md focus:bg-white text-right tabular-nums disabled:text-gray-500"
      />
      <div className="col-span-1 text-[12px] text-right text-gray-400 tabular-nums px-1" title="Qty × Rate">
        {gbp(total)}
      </div>
      <input
        type="number"
        value={actual}
        onChange={(e) => setActual(e.target.value)}
        onBlur={() => onUpdate({ actual: actual === "" ? 0 : Number(actual) })}
        disabled={!canEditActual}
        placeholder="0"
        title={canEditActual ? undefined : "The budget is final — actuals are read-only"}
        className="col-span-1 text-[12px] bg-transparent border-none outline-none px-1 py-1 rounded-md focus:bg-white text-right tabular-nums disabled:text-gray-500"
      />
      <div className="col-span-2 flex items-center justify-end gap-1 pr-1">
        <span
          className={`text-[12px] font-medium tabular-nums ${
            variance >= 0 ? "text-emerald-600" : "text-red-600"
          }`}
        >
          {variance >= 0 ? "" : "−"}
          {gbp(Math.abs(variance))}
        </span>
        {canEditBudgeted ? (
          <button
            onClick={onDelete}
            className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 p-1"
          >
            <Trash2 size={12} />
          </button>
        ) : (
          <span className="w-[22px]" />
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

function SummaryRow({
  label,
  value,
  strong,
  grand,
  muted,
  editable,
  percentValue,
  onPercentChange,
  onPercentBlur,
}: {
  label: string;
  value: string;
  strong?: boolean;
  grand?: boolean;
  muted?: boolean;
  editable?: boolean;
  percentValue?: string;
  onPercentChange?: (v: string) => void;
  onPercentBlur?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <span
          className={`${grand ? "text-base font-bold text-gray-900" : strong ? "text-sm font-semibold text-gray-800" : muted ? "text-xs text-gray-400 uppercase tracking-wide font-semibold" : "text-sm text-gray-600"}`}
        >
          {label}
        </span>
        {percentValue !== undefined && (
          <span className="inline-flex items-center gap-0.5 text-xs text-gray-500">
            <input
              type="number"
              value={percentValue}
              onChange={(e) => onPercentChange?.(e.target.value)}
              onBlur={onPercentBlur}
              disabled={!editable}
              className="w-14 text-right bg-gray-50 border border-gray-200 rounded-md px-1.5 py-0.5 text-xs tabular-nums outline-none focus:border-[#ffd700] disabled:opacity-60"
            />
            %
          </span>
        )}
      </div>
      <span
        className={`tabular-nums ${grand ? "text-lg font-bold text-gray-900" : strong ? "text-sm font-semibold text-gray-800" : muted ? "text-sm font-medium text-gray-500" : "text-sm text-gray-700"}`}
      >
        {value}
      </span>
    </div>
  );
}
