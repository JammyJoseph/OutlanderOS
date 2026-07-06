"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  Pencil,
  BookOpen,
  Percent,
  ExternalLink,
  Link2,
} from "lucide-react";
import {
  BudgetLineItem,
  BUDGET_SECTIONS,
  gbp,
  lineTotal,
  lineVatPercent,
  lineVatAmount,
  lineTotalIncVat,
  ProductionFull,
  ProductionBudgetStatus,
  sectionOf,
  InvoiceStatus,
  INVOICE_STATUSES,
  invoiceStatusMeta,
} from "./types";
import { getAPARate, getAPARatesForSection, getReferenceRate } from "@/lib/apa-rates";
import ApaRateCard from "./ApaRateCard";
import { useUser } from "@/components/user-context";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

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
  BUDGETING: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300", label: "Budgeting" },
  LOCKED: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-300", label: "Locked" },
  IN_PROGRESS: { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-300", label: "In Progress" },
  FINAL: { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-300", label: "Final" },
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
  const { user } = useUser();
  const isAdmin = user?.role === "ADMIN";
  const [seeding, setSeeding] = useState(false);
  const [showRateCard, setShowRateCard] = useState(false);
  const [reopenTarget, setReopenTarget] = useState<ProductionBudgetStatus | null>(null);
  const [deleteLineId, setDeleteLineId] = useState<string | null>(null);

  // ── Phase 3E: editorial discount rates ──
  // Only meaningful for editorial productions. `editorialRateDiscount` (null =
  // off) knocks a % off the APA reference rates shown in the budget.
  const isEditorial = (production.billingType ?? "EDITORIAL") === "EDITORIAL";
  const editorialDiscount = production.editorialRateDiscount ?? null;
  const [discountInput, setDiscountInput] = useState(
    editorialDiscount != null ? String(editorialDiscount) : "25"
  );
  const [savingDiscount, setSavingDiscount] = useState(false);

  async function patchProduction(patch: Record<string, unknown>) {
    setSavingDiscount(true);
    try {
      const res = await fetch(`/api/productions/${production.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setApiError(data.error || "Failed to update the production.");
        setTimeout(() => setApiError(null), 5000);
      }
      refresh();
    } finally {
      setSavingDiscount(false);
    }
  }

  function toggleEditorialRates() {
    if (editorialDiscount != null) {
      patchProduction({ editorialRateDiscount: null });
    } else {
      const pct = discountInput === "" ? 25 : Number(discountInput);
      patchProduction({ editorialRateDiscount: pct });
    }
  }

  // The line-item table flips between budget entry (with VAT columns) and a
  // separate actuals-tracking view (budgeted vs actual vs variance).
  const [view, setView] = useState<"budget" | "actuals">("budget");
  // Section key whose freshly-added line should auto-focus its first input —
  // set when a new line is created via the keyboard so data entry stays fluid.
  const [focusSection, setFocusSection] = useState<string | null>(null);

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
        acc.vat += lineVatAmount(it);
        acc.incVat += lineTotalIncVat(it);
        acc.actual += it.actual || 0;
        return acc;
      },
      { budgeted: 0, vat: 0, incVat: 0, actual: 0 }
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

  async function addLine(section: string, opts?: { focus?: boolean }) {
    // Append after the section's existing lines and default qty to 1 / VAT 20%.
    const sectionLines = grouped[section] ?? [];
    const nextSort = sectionLines.reduce((m, l) => Math.max(m, l.sortOrder), -1) + 1;
    if (opts?.focus) setFocusSection(section);
    const res = await fetch(`/api/productions/${production.id}/budget`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        section,
        role: "",
        description: "",
        quantity: 1,
        vatPercent: 20,
        budgeted: 0,
        actual: 0,
        sortOrder: nextSort,
      }),
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

  // Opens the reopen-confirmation dialog; the actual status change happens on
  // confirm (see the ConfirmDialog near the end of the render).
  function reopenBudget(current: ProductionBudgetStatus) {
    const target: ProductionBudgetStatus = current === "FINAL" ? "IN_PROGRESS" : "BUDGETING";
    setReopenTarget(target);
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

  // Budget maths — the figures that matter ALWAYS exclude VAT. The subtotal is
  // the sum of every line item exc. VAT; the VAT and inc-VAT totals come
  // straight from the per-line figures (identical to the table above). Headroom
  // / variance = allocation − subtotal exc. VAT — never the inc-VAT total, and
  // with no markup applied. A positive variance is headroom; negative is over.
  const subtotalExcVat = totals.budgeted;
  const totalVat = totals.vat;
  const totalIncVat = totals.incVat;
  const variance = campaignBudget != null ? campaignBudget - subtotalExcVat : null;

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
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mr-1">
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
                          ? "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                          : "bg-gray-50 dark:bg-gray-800 text-gray-300 dark:text-gray-600"
                    }`}
                  >
                    {passed && <CheckCircle2 size={11} />}
                    {style.label}
                  </span>
                  {i < STATUS_FLOW.length - 1 && <span className="text-gray-200 dark:text-gray-700 text-xs">→</span>}
                </span>
              );
            })}
          </div>
          <div className="flex items-center gap-3">
            {nextAction && (
              <button
                onClick={() => setConfirmStatus(nextAction.next)}
                className="flex items-center gap-2 bg-[#111111] dark:bg-white text-white dark:text-black px-4 py-2 rounded-xl text-sm font-medium hover:opacity-90 transition-colors shadow-sm"
              >
                <Lock size={13} />
                {nextAction.label}
              </button>
            )}
            {isAdmin && (budgetStatus === "LOCKED" || budgetStatus === "FINAL") && (
              <button
                onClick={() => reopenBudget(budgetStatus)}
                disabled={statusBusy}
                className="text-xs font-medium text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-200 underline underline-offset-2 disabled:opacity-50"
              >
                Reopen Budget (admin)
              </button>
            )}
          </div>
        </div>
      )}
      {budgetStatus && (budgetStatus === "LOCKED" || budgetStatus === "FINAL") && production.productionLockedAt && (
        <p className="text-[11px] text-gray-400 dark:text-gray-500 -mt-3 px-1">
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
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {apiError}
        </div>
      )}

      {/* Top: allocation + totals */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          className={`rounded-2xl border shadow-sm p-5 md:col-span-1 ${
            locked ? "bg-amber-50/40 dark:bg-amber-900/30 border-amber-100 dark:border-amber-800" : "bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800"
          }`}
        >
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">
            {locked ? "Allocated Budget" : "Total Campaign Budget"}
            {locked && <Lock size={11} className="text-[#9C7C2E]" />}
          </p>
          {locked ? (
            <>
              <span className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {gbp(campaignBudget ?? 0)}
              </span>
              {deal && production.campaignId && (
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2 leading-snug">
                  From deal:{" "}
                  <Link
                    href={`/commercial/deals/${production.campaignId}`}
                    className="font-medium text-[#9C7C2E] hover:text-[#9C7C2E] inline-flex items-center gap-0.5"
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
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1 leading-snug">
                Set by Commercial — read-only here.
              </p>
              {allocation > 0 && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-gray-500 dark:text-gray-400">
                      {gbp(totals.actual)} / {gbp(allocation)} spent
                    </span>
                    <span className={`font-semibold ${overSpent ? "text-red-600 dark:text-red-400" : "text-gray-600 dark:text-gray-400"}`}>
                      {Math.round((totals.actual / allocation) * 100)}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                    <div
                      className={`h-full rounded-full transition-all ${
                        overSpent ? "bg-red-500" : "bg-[#9C7C2E]"
                      }`}
                      style={{ width: `${spentPct}%` }}
                    />
                  </div>
                </div>
              )}
              {campaignBudget != null && (
                <p
                  className={`text-xs font-medium mt-2 ${
                    overall! >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
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
                <span className="text-2xl font-semibold text-gray-400 dark:text-gray-500">£</span>
                <input
                  type="number"
                  min="0"
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                  onBlur={() =>
                    onCampaignBudgetChange(budgetInput === "" ? null : Number(budgetInput))
                  }
                  placeholder="0"
                  className="text-2xl font-semibold text-gray-900 dark:text-gray-100 bg-transparent border-none outline-none w-full focus:bg-amber-50/40 dark:focus:bg-amber-900/30 rounded-md px-1"
                />
              </div>
              {campaignBudget != null && (
                <p
                  className={`text-xs font-medium mt-2 ${
                    overall! >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
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
        <SummaryCard label="Total Budget (exc. VAT)" value={gbp(totals.budgeted)} accent={
          <span className="text-gray-500 dark:text-gray-400">+ VAT {gbp(totals.vat)} · inc. VAT <span className="text-gray-700 dark:text-gray-300 font-semibold">{gbp(totals.incVat)}</span></span>
        } />
        <SummaryCard
          label="Total Actual"
          value={gbp(totals.actual)}
          accent={
            totals.variance >= 0 ? (
              <span className="text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                <TrendingDown size={12} /> {gbp(totals.variance)} under
              </span>
            ) : (
              <span className="text-red-600 dark:text-red-400 inline-flex items-center gap-1">
                <TrendingUp size={12} /> {gbp(Math.abs(totals.variance))} over
              </span>
            )
          }
        />
      </div>

      {/* Empty-state template CTA */}
      {!hasItems && canEditBudgeted && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 shadow-sm px-6 py-8 text-center">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Start your production budget</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 max-w-md mx-auto">
            Populate the standard industry sections (Pre-Production, Crew, Talent, Equipment, Post…)
            with common line items, ready to fill in. You can add or remove lines from any section.
          </p>
          <button
            onClick={seedTemplate}
            disabled={seeding}
            className="inline-flex items-center gap-2 bg-[#111111] dark:bg-white text-white dark:text-black px-4 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-colors shadow-sm disabled:opacity-50"
          >
            {seeding ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            Set up from template
          </button>
        </div>
      )}

      {/* Line items grouped by section — this is the live P&L */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-gray-50/60 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-600 dark:text-gray-400">
              Production Budget
            </p>
            {/* Budget entry ⇄ post-wrap cost tracking. Budget entry is the
                default; actuals vs budget is a review tool for after the shoot
                once invoices are in — so it's clearly labelled, not inline. */}
            <div className="flex items-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-0.5">
              {(["budget", "actuals"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    view === v
                      ? "bg-[#111111] dark:bg-white text-white dark:text-black"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                  }`}
                  title={
                    v === "budget"
                      ? "Build the budget — roles, quantities, unit costs and VAT"
                      : "Cost tracking — compare actual invoiced spend against budget after the shoot wraps"
                  }
                >
                  {v === "budget" ? "Budget Entry" : "Cost Tracking"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* Phase 3E — editorial discount toggle (editorial productions only) */}
            {isEditorial && (
              <div
                className="inline-flex items-center gap-1.5"
                title="Discount APA reference rates for editorial shoots"
              >
                <button
                  onClick={toggleEditorialRates}
                  disabled={savingDiscount}
                  className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full transition-colors disabled:opacity-50 ${
                    editorialDiscount != null
                      ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  }`}
                >
                  <Percent size={11} />
                  Editorial rates {editorialDiscount != null ? "on" : "off"}
                </button>
                {editorialDiscount != null && (
                  <span className="inline-flex items-center gap-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={discountInput}
                      onChange={(e) => setDiscountInput(e.target.value)}
                      onBlur={() => {
                        const pct = discountInput === "" ? 0 : Number(discountInput);
                        if (pct !== editorialDiscount) patchProduction({ editorialRateDiscount: pct });
                      }}
                      className="w-11 text-right bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md px-1 py-0.5 text-[11px] tabular-nums outline-none focus:border-[#9C7C2E]"
                    />
                    % off
                  </span>
                )}
              </div>
            )}
            <button
              onClick={() => setShowRateCard(true)}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              title="View the full APA standard crew rate card"
            >
              <BookOpen size={11} />
              APA Rate Card
            </button>
            {hasItems && canEditBudgeted && (
              <button
                onClick={seedTemplate}
                disabled={seeding}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-50"
                title="Add any missing standard sections"
              >
                {seeding ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                Fill template
              </button>
            )}
            {!canEditBudgeted && (
              <p className="text-[10px] font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <Lock size={10} />
                {isFinal ? "Final — read-only" : "Budgeted amounts locked — actuals only"}
              </p>
            )}
          </div>
        </div>
        {/* Cost-tracking context — this view is for after the shoot wraps */}
        {view === "actuals" && (
          <div className="px-5 py-2 bg-amber-50/50 dark:bg-amber-900/30 border-b border-amber-100 dark:border-amber-800 text-[11px] text-amber-700 dark:text-amber-300">
            Cost tracking compares actual invoiced spend against the budget. Fill this in after the
            shoot wraps, once invoices are submitted — it isn&apos;t part of building the budget.
          </div>
        )}
        {view === "budget" && (
          <div className="px-5 py-2 bg-blue-50/40 border-b border-blue-100 text-[11px] text-gray-600 dark:bg-blue-950/20 dark:border-blue-900 dark:text-gray-300">
            All budget figures <span className="font-semibold text-gray-800 dark:text-gray-100">exclude VAT</span>. Per-line VAT is shown for information only and is never added to the budget total.
          </div>
        )}
        {/* Sticky column headers */}
        {view === "budget" ? (
          <div className="grid grid-cols-12 px-5 py-2.5 bg-gray-50/60 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800 text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 sticky top-0 z-10">
            <div className="col-span-2">Role / Item</div>
            <div className="col-span-3">Description</div>
            <div className="col-span-1 text-right">Qty</div>
            <div className="col-span-2 text-right">Unit Cost £</div>
            <div className="col-span-1 text-right">VAT %</div>
            <div className="col-span-1 text-right">VAT £</div>
            <div className="col-span-2 text-right pr-6">Total (exc. VAT)</div>
          </div>
        ) : (
          <div className="grid grid-cols-12 px-5 py-2.5 bg-gray-50/60 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800 text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 sticky top-0 z-10">
            <div className="col-span-3">Role / Item</div>
            <div className="col-span-3">Description</div>
            <div className="col-span-2 text-right">Budgeted</div>
            <div className="col-span-2 text-right">Actuals</div>
            <div className="col-span-2 text-right pr-6">Variance</div>
          </div>
        )}

        {sections.map((sec) => {
          const lines = grouped[sec.key] ?? [];
          if (!canEditBudgeted && lines.length === 0) return null;
          const secBudgeted = lines.reduce((s, l) => s + lineTotal(l), 0);
          const secIncVat = lines.reduce((s, l) => s + lineTotalIncVat(l), 0);
          const secVat = secIncVat - secBudgeted;
          const secActual = lines.reduce((s, l) => s + (l.actual || 0), 0);
          const secVariance = secBudgeted - secActual;
          const isCollapsed = !!collapsed[sec.key];
          return (
            <div key={sec.key} className={`border-b border-gray-50 dark:border-gray-800 last:border-b-0 border-l-2 ${sec.accent}`}>
              <button
                onClick={() => toggleSection(sec.key)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50/40 dark:bg-gray-800/40 hover:bg-gray-50/80 dark:hover:bg-gray-800/80 transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  {isCollapsed ? (
                    <ChevronRight size={14} className="text-gray-400 dark:text-gray-500" />
                  ) : (
                    <ChevronDown size={14} className="text-gray-400 dark:text-gray-500" />
                  )}
                  <span className="text-xs font-bold uppercase tracking-widest text-gray-700 dark:text-gray-300">
                    {sec.label}
                  </span>
                  {lines.length > 0 && (
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">({lines.length})</span>
                  )}
                </div>
                <div className="flex items-center gap-5 text-xs tabular-nums">
                  {view === "budget" ? (
                    <>
                      <span className="text-gray-400 dark:text-gray-500" title="VAT (informational only — not in the budget total)">VAT {gbp(secVat)}</span>
                      <span className="text-gray-700 dark:text-gray-300 font-medium w-20 text-right" title="Subtotal (exc. VAT)">
                        {gbp(secBudgeted)}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-gray-500 dark:text-gray-400" title="Budgeted">{gbp(secBudgeted)}</span>
                      <span className="text-gray-400 dark:text-gray-500" title="Actuals">{gbp(secActual)}</span>
                      <span
                        className={`font-medium w-20 text-right ${
                          secVariance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                        }`}
                        title="Variance"
                      >
                        {secVariance >= 0 ? "" : "−"}
                        {gbp(Math.abs(secVariance))}
                      </span>
                    </>
                  )}
                </div>
              </button>
              {!isCollapsed && (
                <>
                  {lines.map((line, idx) => (
                    <BudgetRow
                      key={line.id}
                      line={line}
                      section={sec.key}
                      view={view}
                      canEditBudgeted={canEditBudgeted}
                      canEditActual={canEditActual}
                      editorialDiscount={editorialDiscount}
                      onUpdate={(patch) => updateLine(line.id, patch)}
                      onDelete={() => setDeleteLineId(line.id)}
                      onEnterAtEnd={() => addLine(sec.key, { focus: true })}
                      autoFocusFirst={focusSection === sec.key && idx === lines.length - 1}
                      onAutoFocused={() => setFocusSection(null)}
                    />
                  ))}
                  {canEditBudgeted && (
                    <div className="px-5 py-1.5">
                      <button
                        onClick={() => addLine(sec.key)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-[#9C7C2E] hover:text-[#9C7C2E]"
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

        {/* Grand total row */}
        {view === "budget" ? (
          <div className="grid grid-cols-12 px-5 py-3 bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-800 text-sm font-semibold tabular-nums">
            <div className="col-span-9 text-gray-700 dark:text-gray-300">
              Total{" "}
              <span className="text-xs font-normal text-gray-400 dark:text-gray-500">
                (exc. VAT — inc. VAT {gbp(totals.incVat)})
              </span>
            </div>
            <div className="col-span-1 text-right text-gray-400 dark:text-gray-500">{gbp(totals.vat)}</div>
            <div className="col-span-2 text-right pr-6 text-gray-900 dark:text-gray-100">{gbp(totals.budgeted)}</div>
          </div>
        ) : (
          <div className="grid grid-cols-12 px-5 py-3 bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-800 text-sm font-semibold tabular-nums">
            <div className="col-span-6 text-gray-700 dark:text-gray-300">Total</div>
            <div className="col-span-2 text-right">{gbp(totals.budgeted)}</div>
            <div className="col-span-2 text-right">{gbp(totals.actual)}</div>
            <div
              className={`col-span-2 text-right pr-6 ${
                totals.variance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
              }`}
            >
              {totals.variance >= 0 ? "+" : "−"}
              {gbp(Math.abs(totals.variance))}
            </div>
          </div>
        )}
      </div>

      {/* Budget summary — matches the exported PDF exactly: subtotal exc. VAT,
          VAT, inc. VAT, then the allocation and the variance. The total that
          matters always excludes VAT, so the variance is allocation minus the
          exc-VAT subtotal (positive = headroom / in the green, negative = over). */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-gray-50/60 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-600 dark:text-gray-400">Budget Summary</p>
        </div>
        <div className="px-5 py-4 space-y-2.5 max-w-xl ml-auto">
          <SummaryRow label="Subtotal Excl. VAT" value={gbp(subtotalExcVat)} strong />
          <SummaryRow label="Total VAT Amount" value={gbp(totalVat)} />
          <div className="border-t border-gray-100 dark:border-gray-800 pt-2.5">
            <SummaryRow label="Total Incl. VAT" value={gbp(totalIncVat)} grand />
          </div>
          <div className="border-t border-gray-100 dark:border-gray-800 pt-2.5 space-y-2.5">
            <SummaryRow
              label={locked ? "Allocated Budget (Commercial)" : "Allocated Budget"}
              value={gbp(allocation)}
              muted
            />
            {campaignBudget != null && (
              <div
                className={`flex items-center justify-between rounded-xl px-3 py-2.5 ${
                  variance! >= 0
                    ? "bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800"
                    : "bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800"
                }`}
              >
                <span
                  className={`text-xs font-semibold inline-flex items-center gap-1.5 ${
                    variance! >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"
                  }`}
                >
                  {variance! >= 0 ? (
                    <>
                      <CheckCircle2 size={14} /> Variance — in the green
                    </>
                  ) : (
                    <>
                      <TrendingUp size={14} /> Variance — over budget
                    </>
                  )}
                </span>
                <span
                  className={`text-sm font-bold tabular-nums ${
                    variance! >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"
                  }`}
                >
                  {variance! >= 0
                    ? `+${gbp(variance!)} headroom`
                    : `−${gbp(Math.abs(variance!))} over`}
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
            savings >= 0 ? "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800" : "bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800"
          }`}
        >
          <p
            className={`text-sm font-semibold ${
              savings >= 0 ? "text-emerald-800 dark:text-emerald-300" : "text-red-700 dark:text-red-300"
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
          <p className={`text-xs mt-1 ${savings >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
            Allocation {gbp(allocation)} − actuals {gbp(totals.actual)}. Savings flow straight into
            the company margin{!isFinal ? " — final once actuals are submitted" : ""}.
          </p>
        </div>
      )}

      {/* APA rate card reference */}
      {showRateCard && <ApaRateCard onClose={() => setShowRateCard(false)} />}

      {/* Reopen budget confirmation */}
      <ConfirmDialog
        open={!!reopenTarget}
        title="Reopen budget?"
        message={
          reopenTarget === "IN_PROGRESS"
            ? "Reopen this finalised budget? Actual costs become editable again and the result is no longer reported as final to Finance."
            : "Reopen this locked budget? Budgeted amounts become editable again."
        }
        confirmLabel="Reopen"
        confirmVariant="danger"
        busy={statusBusy}
        onConfirm={async () => {
          if (reopenTarget) await setBudgetStatus(reopenTarget);
          setReopenTarget(null);
        }}
        onCancel={() => setReopenTarget(null)}
      />

      {/* Line-item delete confirmation */}
      <ConfirmDialog
        open={!!deleteLineId}
        title="Delete line item?"
        message="This removes the line from the budget. This cannot be undone."
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={async () => {
          if (deleteLineId) await deleteLine(deleteLineId);
          setDeleteLineId(null);
        }}
        onCancel={() => setDeleteLineId(null)}
      />

      {/* Status-change confirmation */}
      {confirmStatus && nextAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="border-b border-gray-50 dark:border-gray-800 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Lock size={16} className="text-[#9C7C2E]" /> {nextAction.label}
              </h2>
              <button
                onClick={() => setConfirmStatus(null)}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-gray-600 dark:text-gray-400">{nextAction.confirm}</p>
              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => setConfirmStatus(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setBudgetStatus(confirmStatus)}
                  disabled={statusBusy}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#111111] dark:bg-white text-white dark:text-black px-4 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-colors disabled:opacity-50"
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

// Shared cell classes. Editable inputs sit a shade lighter than the (grey) row
// with a subtle inset border; auto-calculated cells are visually locked.
const EDIT_CELL =
  "text-[12px] bg-white border border-gray-200 rounded-md px-2 py-1 outline-none shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] focus:border-[#9C7C2E] focus:ring-1 focus:ring-[#9C7C2E]/30 disabled:bg-transparent disabled:border-transparent disabled:shadow-none disabled:text-gray-500";
const AUTO_CELL = "text-[12px] tabular-nums text-gray-400 cursor-default select-none px-1";

// Role cell: a free-text input with an attached dropdown of the section's APA
// roles. Typing keeps a custom role (rate stays as-is); picking from the list
// auto-fills the APA rate via onPick. Falls back to a plain input for sections
// with no APA roles (equipment, catering, post…).
function RolePicker({
  section,
  value,
  onChange,
  onBlur,
  onKeyDown,
  onPick,
  disabled,
  wrapClass,
  inputClass,
}: {
  section: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onPick: (role: string, rate: number) => void;
  disabled: boolean;
  wrapClass: string;
  inputClass: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const roles = useMemo(() => getAPARatesForSection(section), [section]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={wrapRef} className={`relative ${wrapClass}`}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        disabled={disabled}
        placeholder="Role / item"
        className={`w-full ${roles.length > 0 && !disabled ? "pr-6" : ""} ${inputClass}`}
      />
      {roles.length > 0 && !disabled && (
        <>
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setOpen((o) => !o)}
            className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-gray-300 hover:text-gray-600"
            title="Pick an APA role"
          >
            <ChevronDown size={13} />
          </button>
          {open && (
            <div className="absolute left-0 top-full z-30 mt-1 max-h-60 w-72 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-xl">
              {roles.map((r) => (
                <button
                  key={r.role}
                  type="button"
                  onClick={() => {
                    onPick(r.role, r.maxDailyRate);
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-[12px] hover:bg-amber-50"
                >
                  <span className="text-gray-700">{r.role}</span>
                  <span className="shrink-0 tabular-nums text-gray-400">
                    {gbp(r.maxDailyRate)}/day
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function BudgetRow({
  line,
  section,
  view,
  canEditBudgeted,
  canEditActual,
  editorialDiscount,
  onUpdate,
  onDelete,
  onEnterAtEnd,
  autoFocusFirst,
  onAutoFocused,
}: {
  line: BudgetLineItem;
  section: string;
  view: "budget" | "actuals";
  canEditBudgeted: boolean;
  canEditActual: boolean;
  editorialDiscount: number | null;
  onUpdate: (patch: Partial<BudgetLineItem>) => void;
  onDelete: () => void;
  onEnterAtEnd: () => void;
  autoFocusFirst: boolean;
  onAutoFocused: () => void;
}) {
  const [role, setRole] = useState(line.role ?? "");
  const [description, setDescription] = useState(line.description);
  const [quantity, setQuantity] = useState(line.quantity != null ? String(line.quantity) : "");
  const [rate, setRate] = useState(line.rate != null ? String(line.rate) : "");
  const [vat, setVat] = useState(line.vatPercent != null ? String(line.vatPercent) : "");
  const [actual, setActual] = useState(String(line.actual ?? 0));
  // Invoice tracking (Phase 4D).
  const [poNumber, setPoNumber] = useState(line.poNumber ?? "");
  const [invoicedAmount, setInvoicedAmount] = useState(
    line.invoicedAmount != null ? String(line.invoicedAmount) : ""
  );
  const [invoiceUrl, setInvoiceUrl] = useState(line.invoiceUrl ?? "");
  // Inline validation — rate / quantity / VAT / actual can never be negative.
  const [rowError, setRowError] = useState<string | null>(null);
  const isNeg = (v: string) => v.trim() !== "" && Number(v) < 0;

  const rowRef = useRef<HTMLDivElement>(null);

  const total = lineTotal(line);
  const vatAmt = lineVatAmount(line);
  const variance = total - (line.actual || 0);
  const editAny = canEditActual || canEditBudgeted;

  // APA default for this line's role (if it maps to a rate-card role). Used to
  // pre-fill the rate when a role is picked and to flag manual overrides.
  const apa = getAPARate(line.role ?? "");
  const isOverridden =
    apa != null && line.rate != null && line.rate !== apa.maxDailyRate;

  // APA standard day rate shown as a greyed-out *reference* under the Unit Cost
  // input. Alias-aware so friendly template roles (e.g. "DOP / Videographer")
  // resolve too. Reference only — never auto-filled, never in any calculation.
  const refRate = getReferenceRate(line.role);

  // Editorial discount factor (Phase 3E). 1 when off; e.g. 0.75 at 25% off.
  const discountActive = editorialDiscount != null && editorialDiscount > 0;
  const discountFactor = discountActive ? 1 - editorialDiscount / 100 : 1;
  const discountedRef = refRate != null ? Math.round(refRate * discountFactor) : null;

  // Pick a role from the APA dropdown: set the role and auto-fill its default
  // rate (qty defaults to 1). When editorial rates are on, the discounted rate
  // is filled instead of the full APA day rate.
  function pickRole(apaRole: string, apaRate: number) {
    const filled = discountActive ? Math.round(apaRate * discountFactor) : apaRate;
    setRole(apaRole);
    setRate(String(filled));
    onUpdate({
      role: apaRole,
      rate: filled,
    });
  }

  // Auto-focus the first editable cell when a new line is added via keyboard.
  useEffect(() => {
    if (!autoFocusFirst) return;
    const first = rowRef.current?.querySelector<HTMLInputElement>("input:not([disabled])");
    first?.focus();
    first?.select();
    onAutoFocused();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocusFirst]);

  // Enter moves to the next editable cell in the row; at the end it creates a
  // new line. Tab keeps its native behaviour (which already flows left→right).
  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const inputs = Array.from(
      rowRef.current?.querySelectorAll<HTMLInputElement>("input:not([disabled])") ?? []
    );
    const idx = inputs.indexOf(e.currentTarget);
    if (idx >= 0 && idx < inputs.length - 1) {
      const next = inputs[idx + 1];
      next.focus();
      next.select();
    } else {
      onEnterAtEnd();
    }
  }

  if (view === "actuals") {
    return (
      <div>
      <div
        ref={rowRef}
        className="grid grid-cols-12 gap-1.5 px-5 py-1 items-center bg-gray-50/50 hover:bg-amber-50/30 group min-h-[28px]"
      >
        <RolePicker
          section={section}
          value={role}
          onChange={setRole}
          onBlur={() => {
            if (role !== (line.role ?? "")) onUpdate({ role });
          }}
          onKeyDown={handleKey}
          onPick={pickRole}
          disabled={!canEditBudgeted}
          wrapClass="col-span-3"
          inputClass={`font-medium truncate ${EDIT_CELL}`}
        />
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => {
            if (description !== line.description) onUpdate({ description });
          }}
          onKeyDown={handleKey}
          disabled={!editAny}
          placeholder="Description"
          className={`col-span-3 text-gray-600 truncate ${EDIT_CELL}`}
        />
        <div className={`col-span-2 text-right ${AUTO_CELL}`} title="Budgeted (exc. VAT)">
          {gbp(total)}
        </div>
        <input
          type="number"
          min="0"
          value={actual}
          onChange={(e) => setActual(e.target.value)}
          onBlur={() => {
            if (isNeg(actual)) { setRowError("Actual cost can't be negative."); return; }
            setRowError(null);
            onUpdate({ actual: actual === "" ? 0 : Number(actual) });
          }}
          onKeyDown={handleKey}
          disabled={!canEditActual}
          placeholder="0"
          title={canEditActual ? undefined : "The budget is final — actuals are read-only"}
          className={`col-span-2 text-right tabular-nums ${EDIT_CELL} ${isNeg(actual) ? "border-red-400 focus:border-red-400 focus:ring-red-300/40" : ""}`}
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
      {/* Phase 4D — invoice tracking sub-row */}
      <InvoiceSubRow
        line={line}
        canEdit={canEditActual}
        poNumber={poNumber}
        setPoNumber={setPoNumber}
        invoicedAmount={invoicedAmount}
        setInvoicedAmount={setInvoicedAmount}
        invoiceUrl={invoiceUrl}
        setInvoiceUrl={setInvoiceUrl}
        onUpdate={onUpdate}
      />
      {rowError && <p className="px-5 pb-1 text-[11px] font-medium text-red-600 dark:text-red-400">{rowError}</p>}
      </div>
    );
  }

  // Budget entry view — Qty / Unit Cost / VAT% editable, VAT £ + Total auto.
  return (
    <div>
    <div
      ref={rowRef}
      className="grid grid-cols-12 gap-1.5 px-5 py-1.5 items-center bg-gray-50/50 hover:bg-amber-50/30 group min-h-[30px]"
    >
      <RolePicker
        section={section}
        value={role}
        onChange={setRole}
        onBlur={() => {
          if (role !== (line.role ?? "")) onUpdate({ role });
        }}
        onKeyDown={handleKey}
        onPick={pickRole}
        disabled={!canEditBudgeted}
        wrapClass="col-span-2"
        inputClass={`font-medium truncate ${EDIT_CELL}`}
      />
      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onBlur={() => {
          if (description !== line.description) onUpdate({ description });
        }}
        onKeyDown={handleKey}
        disabled={!canEditBudgeted}
        placeholder="Description"
        className={`col-span-3 text-gray-600 truncate ${EDIT_CELL}`}
      />
      <input
        type="number"
        min="0"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        onBlur={() => {
          if (isNeg(quantity)) { setRowError("Quantity can't be negative."); return; }
          setRowError(null);
          const v = quantity === "" ? null : Number(quantity);
          if (v !== line.quantity) onUpdate({ quantity: v });
        }}
        onKeyDown={handleKey}
        disabled={!canEditBudgeted}
        placeholder="1"
        className={`col-span-1 text-right tabular-nums ${EDIT_CELL} ${isNeg(quantity) ? "border-red-400 focus:border-red-400 focus:ring-red-300/40" : ""}`}
      />
      <div className="col-span-2 flex flex-col">
        <div className="relative">
          <input
            type="number"
            min="0"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            onBlur={() => {
              if (isNeg(rate)) { setRowError("Unit cost can't be negative."); return; }
              setRowError(null);
              const v = rate === "" ? null : Number(rate);
              if (v !== line.rate) onUpdate({ rate: v });
            }}
            onKeyDown={handleKey}
            disabled={!canEditBudgeted}
            placeholder="0"
            className={`w-full text-right tabular-nums ${EDIT_CELL} ${
              isNeg(rate) ? "border-red-400 focus:border-red-400 focus:ring-red-300/40" : isOverridden ? "pl-5 text-amber-700" : ""
            }`}
          />
          {isOverridden && apa && (
            <span
              className="absolute left-1.5 top-1/2 -translate-y-1/2 text-amber-500"
              title={`Manually overridden — APA default is ${gbp(apa.maxDailyRate)}/day`}
            >
              <Pencil size={10} />
            </span>
          )}
        </div>
        {/* APA standard rate — reference only, greyed out, never counted. When
            editorial rates are on, the full rate is struck through and the
            discounted rate shown alongside (Phase 3E). */}
        {refRate != null && (
          <span
            className="mt-0.5 pr-1 text-right text-[10px] leading-none text-gray-400 dark:text-gray-500 select-none"
            title="APA standard day rate — reference only, not included in the budget"
          >
            {discountActive && discountedRef != null ? (
              <>
                APA <span className="line-through">{gbp(refRate)}</span>{" "}
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">{gbp(discountedRef)}</span>
              </>
            ) : (
              <>APA {gbp(refRate)}</>
            )}
          </span>
        )}
      </div>
      <input
        type="number"
        min="0"
        value={vat}
        onChange={(e) => setVat(e.target.value)}
        onBlur={() => {
          if (isNeg(vat)) { setRowError("VAT % can't be negative."); return; }
          setRowError(null);
          const v = vat === "" ? null : Number(vat);
          if (v !== line.vatPercent) onUpdate({ vatPercent: v });
        }}
        onKeyDown={handleKey}
        disabled={!canEditBudgeted}
        placeholder={String(lineVatPercent(line))}
        className={`col-span-1 text-right tabular-nums ${EDIT_CELL} ${isNeg(vat) ? "border-red-400 focus:border-red-400 focus:ring-red-300/40" : ""}`}
      />
      <div className={`col-span-1 text-right ${AUTO_CELL}`} title="(Qty × Unit Cost) × VAT%">
        {gbp(vatAmt)}
      </div>
      <div className="col-span-2 flex items-center justify-end gap-1 pr-1">
        <span
          className="text-[12px] font-semibold tabular-nums text-gray-700 cursor-default select-none"
          title="Qty × Unit Cost (excludes VAT)"
        >
          {gbp(total)}
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
    {rowError && <p className="px-5 pb-1 text-[11px] font-medium text-red-600 dark:text-red-400">{rowError}</p>}
    </div>
  );
}

// Invoice tracking sub-row for the Cost Tracking view (Phase 4D): PO number,
// invoice status, invoiced amount (with a budget-variance flag), and an invoice
// PDF link. Editable while actuals are editable.
function InvoiceSubRow({
  line,
  canEdit,
  poNumber,
  setPoNumber,
  invoicedAmount,
  setInvoicedAmount,
  invoiceUrl,
  setInvoiceUrl,
  onUpdate,
}: {
  line: BudgetLineItem;
  canEdit: boolean;
  poNumber: string;
  setPoNumber: (v: string) => void;
  invoicedAmount: string;
  setInvoicedAmount: (v: string) => void;
  invoiceUrl: string;
  setInvoiceUrl: (v: string) => void;
  onUpdate: (patch: Partial<BudgetLineItem>) => void;
}) {
  const status: InvoiceStatus = line.invoiceStatus ?? "NOT_INVOICED";
  const meta = invoiceStatusMeta(status);
  const budgeted = lineTotal(line);
  const invNum = line.invoicedAmount ?? null;
  const overage = invNum != null ? invNum - budgeted : null;
  const cellCls =
    "text-[11px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md px-1.5 py-0.5 outline-none focus:border-[#9C7C2E] disabled:bg-transparent disabled:border-transparent disabled:text-gray-400";

  return (
    <div className="grid grid-cols-12 gap-1.5 px-5 pb-1.5 items-center">
      <div className="col-span-3 flex items-center gap-1 pl-1">
        <span className="text-[9px] font-bold uppercase tracking-wide text-gray-400">PO</span>
        <input
          type="text"
          value={poNumber}
          onChange={(e) => setPoNumber(e.target.value)}
          onBlur={() => {
            if (poNumber !== (line.poNumber ?? "")) onUpdate({ poNumber: poNumber || null });
          }}
          disabled={!canEdit}
          placeholder="PO number"
          className={`flex-1 ${cellCls}`}
        />
      </div>
      <div className="col-span-3">
        <select
          value={status}
          onChange={(e) => onUpdate({ invoiceStatus: e.target.value as InvoiceStatus })}
          disabled={!canEdit}
          className={`w-full text-[11px] font-semibold rounded-full px-2 py-1 cursor-pointer focus:outline-none disabled:cursor-default ${meta.bg} ${meta.text}`}
        >
          {INVOICE_STATUSES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div className="col-span-2 flex items-center gap-1">
        <span className="text-[9px] font-bold uppercase tracking-wide text-gray-400">Inv £</span>
        <input
          type="number"
          value={invoicedAmount}
          onChange={(e) => setInvoicedAmount(e.target.value)}
          onBlur={() => {
            const next = invoicedAmount === "" ? null : Number(invoicedAmount);
            if (next !== (line.invoicedAmount ?? null)) onUpdate({ invoicedAmount: next });
          }}
          disabled={!canEdit}
          placeholder="0"
          className={`flex-1 text-right tabular-nums ${cellCls}`}
        />
      </div>
      <div className="col-span-2 text-right">
        {overage != null && overage > 0.5 ? (
          <span className="text-[10px] font-semibold text-red-600 dark:text-red-400" title="Invoiced over budget">
            +{gbp(overage)} over
          </span>
        ) : overage != null && overage < -0.5 ? (
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400" title="Invoiced under budget">
            {gbp(Math.abs(overage))} under
          </span>
        ) : null}
      </div>
      <div className="col-span-2 flex items-center justify-end gap-2 pr-1">
        <input
          type="url"
          value={invoiceUrl}
          onChange={(e) => setInvoiceUrl(e.target.value)}
          onBlur={() => {
            if (invoiceUrl !== (line.invoiceUrl ?? "")) onUpdate({ invoiceUrl: invoiceUrl || null });
          }}
          disabled={!canEdit}
          placeholder="Invoice PDF URL"
          className={`min-w-0 flex-1 ${cellCls}`}
        />
        {line.invoiceUrl && (
          <a
            href={line.invoiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-[#9C7C2E] shrink-0"
            title="Open invoice"
          >
            <ExternalLink size={12} />
          </a>
        )}
        <Link
          href="/finance"
          className="text-gray-400 hover:text-[#9C7C2E] shrink-0"
          title="Open Finance for Quinn's approval"
        >
          <Link2 size={12} />
        </Link>
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
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">{label}</p>
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
              className="w-14 text-right bg-gray-50 border border-gray-200 rounded-md px-1.5 py-0.5 text-xs tabular-nums outline-none focus:border-[#9C7C2E] disabled:opacity-60"
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
