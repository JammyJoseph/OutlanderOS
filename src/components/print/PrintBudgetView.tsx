"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Loader2,
  Link2,
  X,
  ExternalLink,
  Wand2,
  RefreshCw,
} from "lucide-react";
import {
  PRINT_BUDGET_SECTIONS,
  grandTotals,
  type PrintBudgetLine,
  type PrintBudgetSection,
} from "@/lib/print-budget";

interface ProductionOption {
  id: string;
  title: string;
  client: string | null;
}
interface FlatPlanLink {
  productionId: string;
  feature: string;
  photographer: string;
  shootDate: string;
}
interface BudgetPayload {
  issue: {
    id: string;
    issueNumber: number;
    issueName: string;
    /** Manual "other income" — anything not coming from a linked deal. */
    totalRevenue: number | null;
    otherIncome: number;
    /** Sum of the distinct deals linked on this issue's flat plan. */
    dealRevenue: number;
    revenue: number;
    deals: { id: string; title: string; client: string | null; value: number }[];
  };
  lines: PrintBudgetLine[];
  productions: ProductionOption[];
  flatPlanLinks: FlatPlanLink[];
}

// The section-based issue budget (Quinn's spreadsheet structure). A flat list of
// PrintBudgetLine rows grouped into fixed collapsible sections. Costs only —
// budget vs actual vs variance, with headroom against the issue revenue. Mirrors
// the production Budget tab's monochrome design and auto-save-on-blur.
export default function PrintBudgetView({ issueId }: { issueId: string }) {
  const [lines, setLines] = useState<PrintBudgetLine[]>([]);
  const [productions, setProductions] = useState<ProductionOption[]>([]);
  const [flatPlanLinks, setFlatPlanLinks] = useState<FlatPlanLink[]>([]);
  // `revenue` is the editable OTHER income. Deal revenue is derived from the
  // flat plan and is not editable here — it comes from the deals themselves.
  const [revenue, setRevenue] = useState<number | null>(null);
  const [dealRevenue, setDealRevenue] = useState(0);
  const [linkedDeals, setLinkedDeals] = useState<{ id: string; title: string; client: string | null; value: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "template" | "sync">(null);

  // Collapsed sections, remembered per-issue in sessionStorage (matches the
  // production budget's behaviour).
  const collapseKey = `printBudgetCollapse:${issueId}`;
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(collapseKey);
      if (raw) setCollapsed(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, [collapseKey]);
  const toggleSection = useCallback(
    (key: string) => {
      setCollapsed((prev) => {
        const next = { ...prev, [key]: !prev[key] };
        try {
          sessionStorage.setItem(collapseKey, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [collapseKey]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/print-budget/${issueId}/lines`, { cache: "no-store" });
      const data = (await res.json()) as BudgetPayload & { error?: string };
      if (data.error) {
        setError(data.error);
        return;
      }
      setLines(data.lines ?? []);
      setProductions(data.productions ?? []);
      setFlatPlanLinks(data.flatPlanLinks ?? []);
      setRevenue(data.issue?.totalRevenue ?? null);
      setDealRevenue(data.issue?.dealRevenue ?? 0);
      setLinkedDeals(data.issue?.deals ?? []);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [issueId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Per-line save chain so two PUTs for one row never race (same rationale as the
  // production budget tab).
  const saveChain = useRef(new Map<string, Promise<void>>());

  const patchLine = useCallback(
    (id: string, patch: Partial<PrintBudgetLine>) => {
      // Optimistic local update so typing feels instant.
      setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
      const body = {
        description: patch.description,
        amount: patch.amount,
        actual: patch.actual,
        notes: patch.notes,
        productionId: patch.productionId,
        section: patch.section,
      };
      const prev = saveChain.current.get(id) ?? Promise.resolve();
      const next = prev
        .catch(() => {})
        .then(async () => {
          const res = await fetch(`/api/print-budget/lines/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          if (!res.ok) {
            const d = await res.json().catch(() => ({}));
            setError(d.error || "Failed to save");
            setTimeout(() => setError(null), 4000);
            return;
          }
          // Reconcile server-computed fields (actual / production title) so a newly
          // linked production shows its ledger actual immediately.
          const d = (await res.json()) as { line?: PrintBudgetLine };
          if (d.line) setLines((cur) => cur.map((l) => (l.id === id ? d.line! : l)));
        });
      saveChain.current.set(id, next);
      void next.finally(() => {
        if (saveChain.current.get(id) === next) saveChain.current.delete(id);
      });
    },
    []
  );

  const addLine = useCallback(
    async (section: PrintBudgetSection) => {
      const res = await fetch(`/api/print-budget/${issueId}/lines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, description: "", amount: 0 }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Failed to add line");
        setTimeout(() => setError(null), 4000);
        return;
      }
      const d = (await res.json()) as { line: PrintBudgetLine };
      setLines((prev) => [...prev, d.line]);
    },
    [issueId]
  );

  const deleteLine = useCallback(async (id: string) => {
    setLines((prev) => prev.filter((l) => l.id !== id));
    await fetch(`/api/print-budget/lines/${id}`, { method: "DELETE" });
  }, []);

  const runAction = useCallback(
    async (action: "template" | "syncProductions") => {
      setBusy(action === "template" ? "template" : "sync");
      try {
        const res = await fetch(`/api/print-budget/${issueId}/lines`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setError(d.error || "Action failed");
          setTimeout(() => setError(null), 4000);
          return;
        }
        await load();
      } finally {
        setBusy(null);
      }
    },
    [issueId, load]
  );

  const saveRevenue = useCallback(
    async (v: number | null) => {
      setRevenue(v);
      await fetch(`/api/print-budget/${issueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ totalRevenue: v }),
      });
    },
    [issueId]
  );

  // Headroom is measured against everything coming in: deals linked on the flat
  // plan plus any other income typed here.
  const totalRevenue = dealRevenue + (revenue ?? 0);
  const totals = useMemo(
    () => grandTotals(lines, dealRevenue > 0 || revenue != null ? totalRevenue : null),
    [lines, totalRevenue, dealRevenue, revenue]
  );

  // productionIds already represented as lines in the Productions section — used
  // to decide whether "Sync from flat plan" has anything left to do.
  const syncedProdIds = useMemo(
    () => new Set(lines.filter((l) => l.section === "PRODUCTIONS" && l.productionId).map((l) => l.productionId)),
    [lines]
  );
  const unsyncedCount = flatPlanLinks.filter((f) => !syncedProdIds.has(f.productionId)).length;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto px-4 py-4 sm:px-6">
      {error && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      )}

      {/* ===== Headroom strip ===== */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Issue revenue</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{gbp(totalRevenue)}</p>
          <div className="mt-1 space-y-0.5 text-[10px] text-muted-foreground">
            <p title={linkedDeals.map((d) => `${d.client ?? d.title}: ${gbp(d.value)}`).join("\n")}>
              {gbp(dealRevenue)} from {linkedDeals.length} deal{linkedDeals.length === 1 ? "" : "s"} on the flat plan
            </p>
            <div className="flex items-center gap-1">
              <span>other income £</span>
              <RevenueInput value={revenue} onCommit={saveRevenue} />
            </div>
          </div>
          {linkedDeals.length === 0 && (
            <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-400">
              No deals linked on the flat plan yet — link them there and revenue fills itself in.
            </p>
          )}
        </div>
        <Stat label="Total budget" value={gbp(totals.budget)} hint="exc. VAT" />
        <Stat label="Total actual" value={gbp(totals.actual)} hint="spent / committed" />
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Headroom</p>
          {totals.headroom == null ? (
            <p className="mt-1 text-lg font-semibold tabular-nums text-muted-foreground">—</p>
          ) : (
            <p
              className={`mt-1 text-lg font-semibold tabular-nums ${
                totals.headroom >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
              }`}
            >
              {totals.headroom < 0 ? "−" : ""}
              {gbp(Math.abs(totals.headroom))}
            </p>
          )}
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {totals.headroom == null
              ? "set revenue to see headroom"
              : totals.headroomPct != null
                ? `${totals.headroomPct >= 0 ? "" : "−"}${Math.abs(totals.headroomPct).toFixed(1)}% of revenue`
                : "revenue − budget"}
          </p>
        </div>
      </div>

      {/* ===== Column header ===== */}
      <div className="grid grid-cols-12 gap-2 rounded-t-md border border-b-0 border-border bg-muted px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-foreground">
        <div className="col-span-5">Description</div>
        <div className="col-span-2">Link</div>
        <div className="col-span-1 text-right">Budget</div>
        <div className="col-span-2 text-right">Actual</div>
        <div className="col-span-2 text-right pr-6">Variance</div>
      </div>

      <div className="rounded-b-md border border-border">
        {PRINT_BUDGET_SECTIONS.map((sec) => {
          const secLines = lines
            .filter((l) => l.section === sec.key)
            .sort((a, b) => a.sortOrder - b.sortOrder);
          const secBudget = secLines.reduce((s, l) => s + (l.amount || 0), 0);
          const secActual = secLines.reduce((s, l) => s + (l.actual || 0), 0);
          const secVar = secBudget - secActual;
          const isCollapsed = !!collapsed[sec.key];
          return (
            <div key={sec.key} className="border-b border-border last:border-b-0">
              <button
                onClick={() => toggleSection(sec.key)}
                className="flex w-full items-center justify-between bg-foreground px-4 py-2.5 text-left text-background transition-opacity hover:opacity-90"
              >
                <div className="flex items-center gap-2">
                  {isCollapsed ? (
                    <ChevronRight size={14} className="text-background" />
                  ) : (
                    <ChevronDown size={14} className="text-background" />
                  )}
                  <span className="text-xs font-bold uppercase tracking-widest text-background">{sec.label}</span>
                  {secLines.length > 0 && (
                    <span className="rounded-full bg-background px-1.5 py-px text-[10px] font-semibold text-foreground">
                      {secLines.length}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-5 text-xs tabular-nums">
                  <span className="text-background" title="Budget">
                    {gbp(secBudget)}
                  </span>
                  <span className="text-background" title="Actual">
                    {gbp(secActual)}
                  </span>
                  <span
                    // The bar is bg-foreground, so it flips black→white between
                    // themes and the variance colour has to flip with it: light
                    // green on the black bar, dark green on the white one.
                    // Without the dark: variant this was emerald-300 on white.
                    className={`w-24 text-right font-semibold ${
                      secVar >= 0
                        ? "text-emerald-300 dark:text-emerald-700"
                        : "text-red-300 dark:text-red-700"
                    }`}
                    title="Variance"
                  >
                    {secVar < 0 ? "−" : ""}
                    {gbp(Math.abs(secVar))}
                  </span>
                </div>
              </button>

              {!isCollapsed && (
                <>
                  {sec.key === "PRODUCTIONS" && secLines.length === 0 && flatPlanLinks.length === 0 && (
                    <p className="px-4 py-2 text-[11px] text-muted-foreground">
                      Link a flat-plan feature to a Production to auto-import its costs here.
                    </p>
                  )}
                  {secLines.map((line) => (
                    <BudgetRow
                      key={line.id}
                      line={line}
                      productions={productions}
                      onPatch={(patch) => patchLine(line.id, patch)}
                      onDelete={() => deleteLine(line.id)}
                    />
                  ))}
                  <div className="flex flex-wrap items-center gap-3 border-t border-border/60 px-4 py-1.5">
                    <button
                      onClick={() => addLine(sec.key)}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                    >
                      <Plus size={12} /> Add line
                    </button>
                    {sec.key === "MAGAZINE_PRODUCTION" && (
                      <button
                        onClick={() => runAction("template")}
                        disabled={busy === "template"}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-[#2E5E44] hover:underline disabled:opacity-50"
                      >
                        {busy === "template" ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                        Set up from template
                      </button>
                    )}
                    {sec.key === "PRODUCTIONS" && unsyncedCount > 0 && (
                      <button
                        onClick={() => runAction("syncProductions")}
                        disabled={busy === "sync"}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-[#2E5E44] hover:underline disabled:opacity-50"
                      >
                        {busy === "sync" ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                        Sync {unsyncedCount} from flat plan
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* ===== Grand total ===== */}
      <div className="mt-3 grid grid-cols-12 gap-2 rounded-md border border-border bg-card px-4 py-3 text-sm font-bold tabular-nums text-foreground">
        <div className="col-span-5 uppercase tracking-wide">Grand total</div>
        <div className="col-span-2" />
        <div className="col-span-1 text-right">{gbp(totals.budget)}</div>
        <div className="col-span-2 text-right">{gbp(totals.actual)}</div>
        <div
          className={`col-span-2 pr-6 text-right ${
            totals.variance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
          }`}
        >
          {totals.variance < 0 ? "−" : ""}
          {gbp(Math.abs(totals.variance))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{value}</p>
      {hint && <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

// A single budget line. Budget is always editable; actual is editable only for
// unlinked lines — a production link makes the actual live (read-only).
function BudgetRow({
  line,
  productions,
  onPatch,
  onDelete,
}: {
  line: PrintBudgetLine;
  productions: ProductionOption[];
  onPatch: (patch: Partial<PrintBudgetLine>) => void;
  onDelete: () => void;
}) {
  const linked = !!line.productionId;
  const actual = line.actual || 0;
  const variance = (line.amount || 0) - actual;
  const hasActual = actual !== 0;

  return (
    <div className="group grid grid-cols-12 items-center gap-2 border-t border-border bg-card px-4 py-1.5 transition-colors hover:bg-muted">
      {/* Description + notes */}
      <div className="col-span-5 min-w-0">
        <TextInput
          value={line.description}
          placeholder="Description…"
          onCommit={(v) => onPatch({ description: v })}
          className="w-full font-medium text-foreground"
        />
        <TextInput
          value={line.notes ?? ""}
          placeholder="Notes"
          onCommit={(v) => onPatch({ notes: v || null })}
          className="w-full text-[10px] text-muted-foreground"
        />
      </div>

      {/* Production link */}
      <div className="col-span-2 min-w-0">
        {linked ? (
          <span className="inline-flex max-w-full items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-[10px] text-foreground">
            <Link
              href={`/production/${line.productionId}`}
              className="truncate text-[#2F4B8F] hover:underline"
              title={line.productionTitle ?? "Production"}
            >
              {line.productionTitle ?? "Production"}
            </Link>
            <ExternalLink className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
            <button
              onClick={() => onPatch({ productionId: null })}
              title="Unlink"
              className="shrink-0 text-muted-foreground hover:text-red-500"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ) : (
          <label className="inline-flex cursor-pointer items-center gap-0.5 text-[10px] text-muted-foreground hover:text-[#2F4B8F]">
            <Link2 className="h-2.5 w-2.5" />
            <span>link</span>
            <select
              value=""
              onChange={(e) => e.target.value && onPatch({ productionId: e.target.value })}
              className="cursor-pointer bg-transparent text-[10px] focus:outline-none"
              style={{ width: 10, color: "transparent" }}
            >
              <option value="">Link production…</option>
              {productions.map((p) => (
                <option key={p.id} value={p.id} className="text-foreground">
                  {p.client ? `${p.title} · ${p.client}` : p.title}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {/* Budget */}
      <div className="col-span-1 text-right">
        <MoneyInput value={line.amount} onCommit={(v) => onPatch({ amount: v ?? 0 })} />
      </div>

      {/* Actual — live for linked lines, editable otherwise */}
      <div className="col-span-2 text-right">
        {linked ? (
          <span className="font-mono text-[11px] text-foreground" title="Live from linked production">
            {gbp(actual ?? 0)}
          </span>
        ) : (
          <MoneyInput
            // Clearing the field means "nothing spent" — 0 tells the API to drop
            // the manual ACTUAL ledger row rather than store a zero.
            value={line.actual || null}
            onCommit={(v) => onPatch({ actual: v ?? 0 })}
            allowEmpty
            placeholder="—"
          />
        )}
      </div>

      {/* Variance + delete */}
      <div className="col-span-2 flex items-center justify-end gap-2 pr-1">
        <span
          className={`font-mono text-[11px] font-semibold ${
            !hasActual
              ? "text-muted-foreground"
              : variance >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400"
          }`}
        >
          {hasActual ? `${variance < 0 ? "−" : ""}${gbp(Math.abs(variance))}` : "—"}
        </span>
        <button
          onClick={onDelete}
          title="Delete line"
          className="text-muted-foreground opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ===== Inputs (commit on blur / Enter) =====

function TextInput({
  value,
  placeholder,
  onCommit,
  className = "",
}: {
  value: string;
  placeholder?: string;
  onCommit: (v: string) => void;
  className?: string;
}) {
  // Sync the external value into local state without an effect: track the prev
  // prop and reconcile during render (React's recommended pattern).
  const [local, setLocal] = useState(value);
  const [prev, setPrev] = useState(value);
  if (value !== prev) {
    setPrev(value);
    setLocal(value);
  }
  return (
    <input
      value={local}
      placeholder={placeholder}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => local !== value && onCommit(local)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className={`rounded bg-transparent px-1 py-0.5 outline-none placeholder-muted-foreground/60 focus:bg-muted/60 dark:focus:bg-white/[0.06] ${className}`}
    />
  );
}

function MoneyInput({
  value,
  onCommit,
  allowEmpty = false,
  placeholder = "0",
}: {
  value: number | null;
  onCommit: (v: number | null) => void;
  allowEmpty?: boolean;
  placeholder?: string;
}) {
  const [local, setLocal] = useState(value == null ? "" : String(value));
  const [prev, setPrev] = useState(value);
  if (value !== prev) {
    setPrev(value);
    setLocal(value == null ? "" : String(value));
  }
  return (
    <span className="inline-flex items-center justify-end">
      <span className="text-[10px] text-muted-foreground">£</span>
      <input
        type="number"
        value={local}
        placeholder={placeholder}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => {
          const parsed = local === "" ? (allowEmpty ? null : 0) : Number(local);
          if (parsed !== value) onCommit(Number.isNaN(parsed as number) ? (allowEmpty ? null : 0) : parsed);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className="w-[72px] rounded bg-transparent px-1 py-0.5 text-right font-mono text-[11px] text-foreground outline-none placeholder-muted-foreground/50 focus:bg-muted/60 dark:focus:bg-white/[0.06]"
      />
    </span>
  );
}

function RevenueInput({ value, onCommit }: { value: number | null; onCommit: (v: number | null) => void }) {
  const [local, setLocal] = useState(value == null ? "" : String(value));
  const [prev, setPrev] = useState(value);
  if (value !== prev) {
    setPrev(value);
    setLocal(value == null ? "" : String(value));
  }
  return (
    <input
      type="number"
      value={local}
      placeholder="0"
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        const parsed = local === "" ? null : Number(local);
        if (parsed !== value) onCommit(Number.isNaN(parsed as number) ? null : parsed);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className="w-full min-w-0 flex-1 rounded bg-transparent text-lg font-semibold tabular-nums text-foreground outline-none focus:bg-muted/60 dark:focus:bg-white/[0.06]"
    />
  );
}

function gbp(n: number): string {
  const neg = n < 0;
  const v = Math.abs(Math.round(n));
  return `${neg ? "−" : ""}£${v.toLocaleString("en-GB")}`;
}
