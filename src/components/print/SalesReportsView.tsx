"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Shopify sales reporting.
//
// Not a sales dashboard — Shopify Analytics already does that better. Every
// panel here exists to answer one question: what should the next rollout's
// numbers be? So each one is shown against the plan's current assumption, and
// the delta is the point.
//
// The store drops once a year. That means small n, and the UI says so rather
// than dressing one observation up as a trend.
// ─────────────────────────────────────────────────────────────────────────────

interface Band { items: number; orders: number; share: number; units: number; revenue: number }
interface CoverSale {
  sku: string; title: string; units: number; revenue: number; orders: number;
  soldSharePct: number; plannedSharePct: number | null; deltaPct: number | null;
}
interface TerritoryDemand {
  territory: string; orders: number; units: number; revenue: number; soldSharePct: number;
  plannedUnits: number | null; plannedSharePct: number | null; deltaPct: number | null;
}
interface Recommendation {
  input: string; current: string; observed: string; suggestion: string;
  confidence: "directional" | "indicative"; rationale: string;
}
interface Payload {
  configured: boolean;
  connected: boolean;
  neverSynced?: boolean;
  sync?: { lastSuccessAt: string | null; state: string; lastError: string | null; recordsSynced: number } | null;
  plan: { issueNumber: number | null; issueName: string | null; eastCoastShare: number } | null;
  data: {
    headline: {
      orders: number; units: number; revenue: number; shippingCollected: number;
      averageOrderValue: number; averageBasket: number; currency: string;
      firstOrderAt: string | null; lastOrderAt: string | null; excludedOrders: number;
    };
    basket: {
      totalOrders: number; totalUnits: number; averageBasket: number; bands: Band[];
      fullSetShare: number | null; multiCoverShare: number;
    };
    covers: CoverSale[];
    territories: TerritoryDemand[];
    coast: {
      usOrders: number; east: number; west: number; unknown: number;
      eastSharePct: number | null; assumedEastSharePct: number | null; deltaPct: number | null;
    };
    curve: { day: number; date: string; orders: number; units: number; cumulativeUnits: number }[];
    repeat: { identifiedCustomers: number; repeat: number; repeatSharePct: number | null; guestOrders: number };
    dropsObserved: number;
    recommendations: Recommendation[];
  } | null;
}

const n = (v: number) => v.toLocaleString("en-GB");
const pct = (v: number | null) => (v == null ? "—" : `${v.toFixed(1)}%`);

function money(v: number, ccy: string) {
  const s = ccy === "USD" ? "$" : ccy === "EUR" ? "€" : "£";
  return `${s}${v.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
const money0 = (v: number, ccy: string) => {
  const s = ccy === "USD" ? "$" : ccy === "EUR" ? "€" : "£";
  return `${s}${Math.round(v).toLocaleString("en-GB")}`;
};

export default function SalesReportsView() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string[] | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/shopify/sales", { cache: "no-store" });
      const d = await res.json();
      if (d.error) setError(d.error);
      else { setPayload(d); setError(null); }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function sync() {
    setSyncing(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/shopify/sync", { method: "POST" });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? "The sync failed."); return; }
      setNotice(d.result?.warnings?.length ? d.result.warnings : [`Synced ${n(d.result.orders)} orders.`]);
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setSyncing(false);
    }
  }

  const ccy = payload?.data?.headline.currency ?? "GBP";

  // The curve is drawn as an inline SVG rather than pulling in a chart library —
  // it's one series and the shape is the whole message.
  const curvePath = useMemo(() => {
    const pts = payload?.data?.curve ?? [];
    if (pts.length < 2) return null;
    const maxUnits = Math.max(...pts.map((p) => p.units), 1);
    const maxDay = Math.max(...pts.map((p) => p.day), 1);
    const x = (d: number) => (d / maxDay) * 100;
    const y = (u: number) => 100 - (u / maxUnits) * 100;
    return {
      line: pts.map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.day).toFixed(2)} ${y(p.units).toFixed(2)}`).join(" "),
      maxUnits,
      maxDay,
    };
  }, [payload]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={22} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Not configured ──
  if (payload && !payload.configured) {
    return (
      <div className="rounded-2xl border border-border bg-card px-6 py-12 text-center">
        <h2 className="text-base font-semibold text-foreground">Shopify isn&rsquo;t connected yet</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
          This tab reads the store&rsquo;s order history and reads it back against the rollout plan — cover
          shares, territory split and the basket the fulfilment economics assume.
        </p>
        <p className="mx-auto mt-3 max-w-lg text-xs text-muted-foreground">
          Set <code className="rounded bg-muted px-1 py-0.5">SHOPIFY_SHOP_DOMAIN</code>,{" "}
          <code className="rounded bg-muted px-1 py-0.5">SHOPIFY_CLIENT_ID</code> and{" "}
          <code className="rounded bg-muted px-1 py-0.5">SHOPIFY_CLIENT_SECRET</code> on the server. See{" "}
          <code className="rounded bg-muted px-1 py-0.5">docs/SHOPIFY.md</code>.
        </p>
      </div>
    );
  }

  const d = payload?.data ?? null;

  return (
    <div className="space-y-6">
      {/* ══ Status bar ══ */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {payload?.sync?.lastSuccessAt
              ? `Last synced ${new Date(payload.sync.lastSuccessAt).toLocaleString("en-GB", {
                  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                })}`
              : "Never synced"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {d
              ? `${n(d.headline.orders)} orders · ${n(d.headline.units)} magazines${
                  d.headline.excludedOrders > 0
                    ? ` · ${n(d.headline.excludedOrders)} cancelled or test order(s) excluded`
                    : ""
                }`
              : "No orders synced yet."}
          </p>
        </div>
        <button
          onClick={sync}
          disabled={syncing}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {syncing ? "Syncing…" : "Sync from Shopify"}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/25 dark:text-red-200">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-900/25">
          {notice.map((w, i) => (
            <p key={i} className="text-sm text-amber-900 dark:text-amber-200">{w}</p>
          ))}
        </div>
      )}

      {!d ? (
        <div className="rounded-2xl border border-border bg-card px-6 py-12 text-center">
          <h2 className="text-base font-semibold text-foreground">No orders yet</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
            Press <strong>Sync from Shopify</strong> to pull the store&rsquo;s order history. If the app
            doesn&rsquo;t hold the <code className="rounded bg-muted px-1">read_all_orders</code> scope,
            Shopify only returns the last 60 days — which for an annual drop is usually nothing.
          </p>
        </div>
      ) : (
        <>
          {/* ══ Small-sample warning — stated before any number is read ══ */}
          {d.dropsObserved < 2 && (
            <div className="rounded-xl border border-border bg-muted px-4 py-3">
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground">One selling period in the data.</strong> Sell-through,
                attach rate and territory demand are all real signals, but with a single drop they point a
                direction rather than prove a trend. The second data point arrives after this year&rsquo;s
                rollout.
              </p>
            </div>
          )}

          {/* ══ Headline ══ */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Tile label="Revenue">{money0(d.headline.revenue, ccy)}</Tile>
            <Tile label="Orders">{n(d.headline.orders)}</Tile>
            <Tile label="Magazines sold">{n(d.headline.units)}</Tile>
            <Tile label="Average order value">{money(d.headline.averageOrderValue, ccy)}</Tile>
            <Tile label="Average basket" hint="magazines per order">
              {d.headline.averageBasket.toFixed(2)}
            </Tile>
          </div>

          {/* ══ Recommendations — the reason the tab exists ══ */}
          <Section
            title="What this says about the next drop"
            blurb="Each row is a number in the rollout plan, shown against what the store actually did."
          >
            {d.recommendations.length === 0 ? (
              <p className="px-4 py-4 text-sm text-muted-foreground">
                Nothing diverges enough from plan to be worth acting on. Covers within 3 points and
                territories within 5 points of their planned share are treated as noise.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {d.recommendations.map((r, i) => (
                  <div key={i} className="px-4 py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <span className="text-sm font-semibold text-foreground">{r.input}</span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        plan <strong className="text-foreground">{r.current}</strong> → actual{" "}
                        <strong className="text-foreground">{r.observed}</strong>
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-foreground">{r.suggestion}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {r.rationale}{" "}
                      <span className="italic">
                        {r.confidence === "directional" ? "Directional — one drop." : "Indicative."}
                      </span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* ══ Basket — the input the economics rest on ══ */}
          <Section
            title="Basket profile"
            blurb="The rollout's fulfilment economics price one-per-order against a basket of two and the Full Set. This is which one actually happens."
          >
            <div className="grid gap-3 px-4 py-3 sm:grid-cols-3">
              <Tile label="Average basket" flat>{d.basket.averageBasket.toFixed(2)}</Tile>
              <Tile label="Orders taking 2+ covers" flat>{pct(d.basket.multiCoverShare)}</Tile>
              <Tile label="Full Set attach rate" flat>{pct(d.basket.fullSetShare)}</Tile>
            </div>
            <Table head={["Magazines per order", "Orders", "Share of orders", "Units", "Revenue"]}>
              {d.basket.bands.map((b) => (
                <tr key={b.items} className="border-t border-border">
                  <Td>{b.items}</Td>
                  <Td right>{n(b.orders)}</Td>
                  <Td right>
                    <div className="flex items-center justify-end gap-2">
                      <Bar value={b.share} />
                      <span className="tabular-nums">{pct(b.share)}</span>
                    </div>
                  </Td>
                  <Td right>{n(b.units)}</Td>
                  <Td right>{money0(b.revenue, ccy)}</Td>
                </tr>
              ))}
            </Table>
          </Section>

          {/* ══ Covers ══ */}
          <Section
            title="Sell-through by cover"
            blurb="Share of units sold against the share of the run each cover was given. A positive delta means it was under-printed."
          >
            <Table head={["Cover", "SKU", "Units", "Revenue", "Share of sales", "Share of run", "Delta"]}>
              {d.covers.map((c) => (
                <tr key={c.sku} className="border-t border-border">
                  <Td>{c.title}</Td>
                  <Td mono>{c.sku}</Td>
                  <Td right>{n(c.units)}</Td>
                  <Td right>{money0(c.revenue, ccy)}</Td>
                  <Td right>{pct(c.soldSharePct)}</Td>
                  <Td right>{pct(c.plannedSharePct)}</Td>
                  <Td right><Delta value={c.deltaPct} /></Td>
                </tr>
              ))}
            </Table>
            {d.covers.some((c) => c.sku === "(no SKU)") && (
              <p className="px-4 py-2 text-xs text-amber-700 dark:text-amber-400">
                Some line items have no SKU, so they can&rsquo;t be attributed to a cover. Set SKUs on the
                Shopify variants to match the rollout plan and they&rsquo;ll join automatically.
              </p>
            )}
          </Section>

          {/* ══ Territories ══ */}
          <Section
            title="Demand by territory"
            blurb="Where orders actually shipped, against the planned B2C split. This is the input to the territory allocation."
          >
            <Table head={["Territory", "Orders", "Units", "Revenue", "Share of sales", "Planned share", "Delta"]}>
              {d.territories.map((t) => (
                <tr key={t.territory} className="border-t border-border">
                  <Td>{t.territory}</Td>
                  <Td right>{n(t.orders)}</Td>
                  <Td right>{n(t.units)}</Td>
                  <Td right>{money0(t.revenue, ccy)}</Td>
                  <Td right>{pct(t.soldSharePct)}</Td>
                  <Td right>{pct(t.plannedSharePct)}</Td>
                  <Td right><Delta value={t.deltaPct} /></Td>
                </tr>
              ))}
            </Table>
          </Section>

          {/* ══ Coast split + repeat buyers ══ */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Section
              title="US coast split"
              blurb="The rollout blends the New York and Los Angeles lane rates by an assumed East Coast share."
            >
              <div className="grid gap-3 px-4 py-3 sm:grid-cols-3">
                <Tile label="Shipped east" flat>{n(d.coast.east)}</Tile>
                <Tile label="Shipped west" flat>{n(d.coast.west)}</Tile>
                <Tile label="Actual east share" flat>{pct(d.coast.eastSharePct)}</Tile>
              </div>
              <p className="px-4 pb-3 text-xs text-muted-foreground">
                Plan assumes <strong className="text-foreground">{pct(d.coast.assumedEastSharePct)}</strong>.
                {d.coast.deltaPct != null && Math.abs(d.coast.deltaPct) >= 5
                  ? " Far enough out to be worth changing."
                  : " Close enough to leave alone."}{" "}
                Mountain and Pacific states count as western; the boundary is a proxy, but the coasts are
                where the volume is.
              </p>
            </Section>

            <Section title="Repeat buyers" blurb="Customers who bought in more than one order.">
              <div className="grid gap-3 px-4 py-3 sm:grid-cols-3">
                <Tile label="Identified customers" flat>{n(d.repeat.identifiedCustomers)}</Tile>
                <Tile label="Bought more than once" flat>{n(d.repeat.repeat)}</Tile>
                <Tile label="Repeat rate" flat>{pct(d.repeat.repeatSharePct)}</Tile>
              </div>
              {d.repeat.guestOrders > 0 && (
                <p className="px-4 pb-3 text-xs text-muted-foreground">
                  {n(d.repeat.guestOrders)} guest order(s) have no customer attached and can&rsquo;t be
                  counted either way.
                </p>
              )}
            </Section>
          </div>

          {/* ══ Sales curve ══ */}
          {curvePath && (
            <Section
              title="How fast it sold"
              blurb="Units per day from the first order. A drop that clears in days was under-printed; one still selling in week six was over-printed."
            >
              <div className="px-4 py-4">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-40 w-full" role="img"
                     aria-label={`Daily units sold, peaking at ${curvePath.maxUnits}`}>
                  <path d={curvePath.line} fill="none" stroke="#9C7C2E" strokeWidth="0.8"
                        vectorEffect="non-scaling-stroke" />
                </svg>
                <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                  <span>day 0</span>
                  <span>peak {n(curvePath.maxUnits)} units/day</span>
                  <span>day {curvePath.maxDay}</span>
                </div>
              </div>
            </Section>
          )}
        </>
      )}
    </div>
  );
}

// ── Bits ────────────────────────────────────────────────────────────────────

function Delta({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  if (Math.abs(value) < 0.05) return <span className="tabular-nums text-muted-foreground">—</span>;
  const up = value > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 tabular-nums ${
        up ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"
      }`}
    >
      {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {up ? "+" : ""}{value.toFixed(1)}pp
    </span>
  );
}

function Bar({ value }: { value: number }) {
  return (
    <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-muted sm:inline-block">
      <span className="block h-full rounded-full bg-[#9C7C2E]" style={{ width: `${Math.min(100, value)}%` }} />
    </span>
  );
}

function Tile({ label, children, hint, flat }: {
  label: string; children: React.ReactNode; hint?: string; flat?: boolean;
}) {
  return (
    <div className={flat ? "" : "rounded-xl border border-border bg-card px-4 py-3"}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{children}</p>
      {hint && <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Section({ title, blurb, children }: {
  title: string; blurb?: string; children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="bg-[#111] px-4 py-3 dark:bg-[#1a1a1a]">
        <h3 className="text-xs font-bold uppercase tracking-widest text-white">{title}</h3>
        {blurb && <p className="mt-0.5 text-xs text-white/60">{blurb}</p>}
      </div>
      {children}
    </section>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/60">
            {head.map((h, i) => (
              <th key={h}
                  className={`whitespace-nowrap px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground ${
                    i === 0 ? "text-left" : "text-right"
                  }`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Td({ children, right, mono }: { children: React.ReactNode; right?: boolean; mono?: boolean }) {
  return (
    <td className={`whitespace-nowrap px-3 py-2 text-foreground ${right ? "text-right tabular-nums" : ""} ${
      mono ? "font-mono text-xs" : ""
    }`}>
      {children}
    </td>
  );
}
