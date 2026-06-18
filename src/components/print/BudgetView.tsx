"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Link2, X, Loader2 } from "lucide-react";
import {
  groupBudgetRows,
  computeBudgetRow,
  computeBudgetTotals,
  type MagazinePage,
  type LinkedDeal,
  type LinkedProduction,
  type BudgetType,
} from "@/lib/magazine-plan";

interface DealOption extends LinkedDeal {
  jobType?: string;
  dealTypes?: string[];
}

// The Budget tab: a spreadsheet of the issue's financial picture. Rows are the
// flat plan's features; revenue/production cost auto-fill from linked Commercial
// deals / Production projects, print cost is always manual, margin is derived.
export default function BudgetView({
  issueId,
  pages,
  updatePage,
}: {
  issueId: string;
  pages: MagazinePage[];
  // Persist a financial edit onto a feature's anchor page (writes through the
  // shared plan saver, so it lands in the same MagazinePlan row as the tracker).
  updatePage: (index: number, patch: Partial<MagazinePage>) => void;
}) {
  const [deals, setDeals] = useState<DealOption[]>([]);
  const [productions, setProductions] = useState<LinkedProduction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch the resolved deal/production values once per issue. We recompute rows
  // locally from `pages` + these maps so link/print-cost edits reflect instantly.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/print-budget/${issueId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return;
        if (data.error) setError(data.error);
        setDeals(data.deals ?? []);
        setProductions(data.productions ?? []);
      })
      .catch((e) => alive && setError(String(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [issueId]);

  const dealMap = useMemo(() => new Map(deals.map((d) => [d.id, d])), [deals]);
  const prodMap = useMemo(() => new Map(productions.map((p) => [p.id, p])), [productions]);

  const rows = useMemo(() => {
    return groupBudgetRows(pages).map((g) => {
      const anchor = pages[g.anchorIndex];
      const deal = anchor?.campaignId ? dealMap.get(anchor.campaignId) ?? null : null;
      const production = anchor?.productionId ? prodMap.get(anchor.productionId) ?? null : null;
      return computeBudgetRow(g, anchor, deal, production);
    });
  }, [pages, dealMap, prodMap]);

  const totals = useMemo(() => computeBudgetTotals(rows), [rows]);

  return (
    <div className="h-full overflow-auto">
      {error && (
        <div className="m-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          Couldn&apos;t load linked deal / production values: {error}
        </div>
      )}
      <table className="w-full border-separate border-spacing-0 text-[11px]">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wider text-gray-500">
            <th className={th}>Page(s)</th>
            <th className={th}>Feature</th>
            <th className={th}>Type</th>
            <th className={th}>Source</th>
            <th className={`${th} text-right`}>Revenue</th>
            <th className={`${th} text-right`}>Prod. Cost</th>
            <th className={`${th} text-right`}>Print Cost</th>
            <th className={`${th} text-right`}>Margin</th>
            <th className={`${th} text-center`}>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <BudgetRowView
              key={r.anchorIndex}
              row={r}
              deals={deals}
              productions={productions}
              loading={loading}
              onLinkDeal={(id) => updatePage(r.anchorIndex, { campaignId: id || undefined })}
              onLinkProduction={(id) => updatePage(r.anchorIndex, { productionId: id || undefined })}
              onRevenue={(v) => updatePage(r.anchorIndex, { revenue: v })}
              onProductionCost={(v) => updatePage(r.anchorIndex, { productionCost: v })}
              onPrintCost={(v) => updatePage(r.anchorIndex, { printCost: v })}
            />
          ))}
        </tbody>
        <tfoot>
          <tr className="text-[12px] font-bold text-white">
            <td className={tdTotal} colSpan={4}>
              TOTALS · {totals.totalPages} pages
            </td>
            <td className={`${tdTotal} text-right`} style={{ color: "#34d399" }}>
              {money(totals.revenue)}
            </td>
            <td className={`${tdTotal} text-right`}>{money(totals.productionCost)}</td>
            <td className={`${tdTotal} text-right`}>{money(totals.printCost)}</td>
            <td className={`${tdTotal} text-right`} style={{ color: totals.margin >= 0 ? "#34d399" : "#f87171" }}>
              {money(totals.margin)}
            </td>
            <td className={tdTotal} />
          </tr>
          <tr className="text-[10px] text-gray-400">
            <td className={tdTotalSub} colSpan={4}>
              Revenue / page {money(totals.revenuePerPage)} · Cost / page {money(totals.costPerPage)}
            </td>
            <td className={tdTotalSub} colSpan={5} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

const th =
  "sticky top-0 z-20 border-b border-white/10 bg-[#0a0a0a] px-2 py-1.5 font-semibold whitespace-nowrap";
const td = "border-b border-white/5 px-2 py-0.5 align-middle";
const tdTotal = "sticky bottom-0 border-t border-white/15 bg-[#0d0d0d] px-2 py-2 align-middle font-mono";
const tdTotalSub = "border-t border-white/5 bg-[#0d0d0d] px-2 py-1 align-middle";

const TYPE_STYLE: Record<BudgetType, { text: string; bg: string }> = {
  "Supplied Ad": { text: "#60a5fa", bg: "rgba(96,165,250,0.14)" },
  Advertorial: { text: "#4ade80", bg: "rgba(74,222,128,0.14)" },
  Editorial: { text: "#c084fc", bg: "rgba(192,132,252,0.14)" },
  Space: { text: "#9ca3af", bg: "rgba(156,163,175,0.12)" },
};

function BudgetRowView({
  row,
  deals,
  productions,
  loading,
  onLinkDeal,
  onLinkProduction,
  onRevenue,
  onProductionCost,
  onPrintCost,
}: {
  row: ReturnType<typeof computeBudgetRow>;
  deals: DealOption[];
  productions: LinkedProduction[];
  loading: boolean;
  onLinkDeal: (id: string) => void;
  onLinkProduction: (id: string) => void;
  onRevenue: (v: number) => void;
  onProductionCost: (v: number) => void;
  onPrintCost: (v: number) => void;
}) {
  const isSpace = row.type === "Space";
  const ts = TYPE_STYLE[row.type];
  // Production cost is fixed at 0 for supplied ads (the brand prints their own page).
  const prodEditable = !isSpace && row.type !== "Supplied Ad" && !row.productionCostAuto;
  const revenueEditable = !isSpace && !row.revenueAuto;
  // Deals are relevant where a client pays (Supplied Ad / Advertorial); productions
  // where we produce content (Advertorial / Editorial).
  const allowDeal = row.type === "Supplied Ad" || row.type === "Advertorial";
  const allowProd = row.type === "Advertorial" || row.type === "Editorial";

  return (
    <tr className="group h-7 align-middle" style={{ background: isSpace ? "transparent" : undefined }}>
      <td className={td}>
        <span className="font-mono font-semibold text-white">{row.pageLabel}</span>
      </td>
      <td className={`${td} max-w-[220px]`}>
        <span className="block truncate text-gray-200" title={row.feature}>
          {row.feature || <span className="text-gray-600">—</span>}
        </span>
      </td>
      <td className={td}>
        <span
          className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
          style={{ color: ts.text, background: ts.bg }}
        >
          {row.type}
        </span>
      </td>

      {/* Source + link pickers */}
      <td className={`${td} min-w-[180px]`}>
        {isSpace ? (
          <span className="text-gray-600">N/A</span>
        ) : (
          <div className="flex flex-col gap-0.5">
            {row.sourceHref ? (
              <span className="flex items-center gap-1">
                <Link
                  href={row.sourceHref}
                  className="truncate text-[#4d9fff] hover:underline"
                  title={row.source}
                >
                  {row.source}
                </Link>
                <ExternalLink className="h-2.5 w-2.5 shrink-0 text-gray-500" />
              </span>
            ) : (
              <span className="text-gray-500">{row.source}</span>
            )}
            <div className="flex items-center gap-1">
              {allowDeal && (
                <LinkPicker
                  label="deal"
                  linkedId={row.campaignId}
                  loading={loading}
                  options={deals.map((d) => ({
                    id: d.id,
                    label: d.client ? `${d.title} · ${d.client}` : d.title,
                  }))}
                  onPick={onLinkDeal}
                />
              )}
              {allowProd && (
                <LinkPicker
                  label="prod"
                  linkedId={row.productionId}
                  loading={loading}
                  options={productions.map((p) => ({ id: p.id, label: p.title }))}
                  onPick={onLinkProduction}
                />
              )}
            </div>
          </div>
        )}
      </td>

      {/* Revenue — green tint for positive */}
      <td className={`${td} text-right`}>
        {isSpace ? (
          <span className="text-gray-600">—</span>
        ) : revenueEditable ? (
          <MoneyInput value={row.revenue} onChange={onRevenue} />
        ) : (
          <span
            className="font-mono"
            style={{ color: row.revenue > 0 ? "#34d399" : "#9ca3af" }}
            title={row.revenueAuto ? "From linked deal" : undefined}
          >
            {money(row.revenue)}
          </span>
        )}
      </td>

      {/* Production cost */}
      <td className={`${td} text-right`}>
        {isSpace || row.type === "Supplied Ad" ? (
          <span className="font-mono text-gray-500">{isSpace ? "—" : money(0)}</span>
        ) : prodEditable ? (
          <MoneyInput value={row.productionCost} onChange={onProductionCost} />
        ) : (
          <span className="font-mono text-gray-200" title="From linked production">
            {money(row.productionCost)}
          </span>
        )}
      </td>

      {/* Print cost — always manual */}
      <td className={`${td} text-right`}>
        {isSpace ? (
          <span className="font-mono text-gray-600">—</span>
        ) : (
          <MoneyInput value={row.printCost} onChange={onPrintCost} />
        )}
      </td>

      {/* Margin — green positive / red negative */}
      <td className={`${td} text-right`}>
        {isSpace ? (
          <span className="font-mono text-gray-600">—</span>
        ) : (
          <span className="font-mono font-semibold" style={{ color: row.margin >= 0 ? "#34d399" : "#f87171" }}>
            {money(row.margin)}
          </span>
        )}
      </td>

      <td className={`${td} text-center`}>
        <span className="text-[10px] uppercase tracking-wide text-gray-400">{statusShort(row.status)}</span>
      </td>
    </tr>
  );
}

// Compact link control: shows a subtle "+ deal" button that becomes a native
// select on focus; when already linked, offers an unlink ×.
function LinkPicker({
  label,
  linkedId,
  loading,
  options,
  onPick,
}: {
  label: string;
  linkedId?: string;
  loading: boolean;
  options: { id: string; label: string }[];
  onPick: (id: string) => void;
}) {
  if (loading) return <Loader2 className="h-3 w-3 animate-spin text-gray-600" />;
  if (linkedId) {
    return (
      <button
        onClick={() => onPick("")}
        title={`Unlink ${label}`}
        className="flex items-center gap-0.5 rounded bg-white/5 px-1 text-[9px] text-gray-400 hover:text-red-400"
      >
        <X className="h-2.5 w-2.5" /> {label}
      </button>
    );
  }
  return (
    <label className="flex cursor-pointer items-center gap-0.5 rounded bg-white/5 px-1 text-[9px] text-gray-400 hover:text-[#4d9fff]">
      <Link2 className="h-2.5 w-2.5" />
      <span>{label}</span>
      <select
        value=""
        onChange={(e) => e.target.value && onPick(e.target.value)}
        className="cursor-pointer bg-transparent text-[9px] focus:outline-none"
        style={{ width: 10, color: "transparent" }}
      >
        <option value="" className="bg-[#141414] text-white">
          Link {label}…
        </option>
        {options.map((o) => (
          <option key={o.id} value={o.id} className="bg-[#141414] text-white">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function MoneyInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <span className="inline-flex items-center justify-end">
      <span className="text-gray-500">£</span>
      <input
        type="number"
        value={value || ""}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
        placeholder="0"
        className="w-[68px] rounded bg-transparent px-1 py-0.5 text-right font-mono text-[11px] text-gray-100 placeholder-gray-600 focus:bg-white/5 focus:outline-none"
      />
    </span>
  );
}

function money(n: number): string {
  const neg = n < 0;
  const v = Math.abs(Math.round(n));
  return `${neg ? "−" : ""}£${v.toLocaleString("en-GB")}`;
}

function statusShort(status: string): string {
  const map: Record<string, string> = {
    NOT_STARTED: "—",
    CONTENT_RECEIVED: "Recd",
    READY_FOR_DESIGN: "Ready",
    IN_DESIGN: "Design",
    COMPLETE: "Done",
  };
  return map[status] ?? status;
}
