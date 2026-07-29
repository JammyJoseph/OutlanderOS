"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2, AlertTriangle, Check } from "lucide-react";
import {
  coverUnits,
  channelCoverGrid,
  stockistCoverSplit,
  stockistCoverTotals,
  hubTotals,
  usEconomics,
  reconcile,
  daysBetween,
  MILESTONE_STATUSES,
  MILESTONE_STATUS_LABEL,
  CHANNEL_KINDS,
  type PlanInput,
} from "@/lib/rollout";

// ─────────────────────────────────────────────────────────────────────────────
// Rollout & distribution — the fulfilment plan for one issue.
//
// Mirrors the spreadsheet's discipline: only inputs are editable, everything
// derived is rendered as text and recomputed from lib/rollout.ts on every
// keystroke. The reconciliation strip sits at the top and stays visible, because
// the single most important question here is "does it still tie to the print
// run?" and burying that at the bottom of a long page is how it stops getting
// looked at.
// ─────────────────────────────────────────────────────────────────────────────

type Row = Record<string, unknown> & { id: string };

// Milestones aren't part of PlanInput — they feed the calendar, not the
// allocation maths — so the payload type adds them alongside it.
interface MilestoneRow {
  id: string;
  seq: number;
  window: string | null;
  date: string | null;
  action: string;
  owner: string | null;
  criticalPath: boolean;
  status: string;
}

type LoadedPlan = PlanInput & {
  id: string;
  assumptions: string | null;
  milestones: MilestoneRow[];
};

interface Payload {
  issue: { id: string; issueNumber: number; issueName: string };
  plan: LoadedPlan | null;
}

const n = (v: number) => v.toLocaleString("en-GB");
const pct = (v: number) => `${v.toFixed(1)}%`;

function money(v: number | null, ccy: string) {
  if (v == null) return "—";
  const symbol = ccy === "USD" ? "$" : ccy === "EUR" ? "€" : "£";
  return `${symbol}${v.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function RolloutView({ issueId }: { issueId: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // `today` is captured once on mount rather than read per render, so the
  // countdown can't shift mid-session or differ between server and client.
  const [today] = useState(() => new Date());

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/rollout/${issueId}`, { cache: "no-store" });
      const d = await res.json();
      if (d.error) {
        setError(d.error);
        return;
      }
      setData(d);
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

  const plan = data?.plan ?? null;

  async function patchPlan(patch: Record<string, unknown>) {
    if (!plan) return;
    setData((prev) => (prev?.plan ? { ...prev, plan: { ...prev.plan, ...patch } as typeof prev.plan } : prev));
    await fetch(`/api/rollout/${issueId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    void load();
  }

  async function addRow(entity: string) {
    setBusy(true);
    try {
      await fetch(`/api/rollout/${issueId}/${entity}`, { method: "POST" });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function patchRow(entity: string, rowId: string, patch: Record<string, unknown>) {
    await fetch(`/api/rollout/${issueId}/${entity}?rowId=${rowId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    void load();
  }

  async function deleteRow(entity: string, rowId: string) {
    await fetch(`/api/rollout/${issueId}/${entity}?rowId=${rowId}`, { method: "DELETE" });
    void load();
  }

  async function createPlan() {
    setBusy(true);
    try {
      await fetch(`/api/rollout/${issueId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ totalPrintRun: 10000 }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  // ── Derived ──
  const derived = useMemo(() => {
    if (!plan) return null;
    return {
      covers: coverUnits(plan),
      grid: channelCoverGrid(plan),
      hubs: hubTotals(plan),
      stockCovers: stockistCoverTotals(plan),
      checks: reconcile(plan),
      us: usEconomics(plan, {
        nyLaneId: plan.lanes.find((l) => /new york/i.test(l.name))?.id,
        laLaneId: plan.lanes.find((l) => /los angeles/i.test(l.name))?.id,
        usTerritoryNames: ["US"],
      }),
    };
  }, [plan]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={22} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/25 dark:text-red-300">
        {error}
      </div>
    );
  }

  if (!plan || !derived) {
    return (
      <div className="rounded-2xl border border-border bg-card px-6 py-16 text-center">
        <h2 className="text-base font-semibold text-foreground">No rollout plan yet</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          Set one up to plan the print run across covers, channels, warehouses, stockists and the
          launch calendar — with every allocation reconciled back to the run.
        </p>
        <button
          onClick={createPlan}
          disabled={busy}
          className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Create rollout plan
        </button>
      </div>
    );
  }

  const toDeadline = daysBetween(today, plan.warehouseDeadline);
  const toLaunch = daysBetween(today, plan.launchDate);
  const failing = derived.checks.filter((c) => !c.ok);
  const nextMilestone = [...plan.milestones]
    .filter((m) => m.status !== "DONE" && m.date)
    .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime())[0];

  return (
    <div className="space-y-6">
      {/* ══ Reconciliation — always first ══ */}
      <div
        className={`rounded-xl border px-4 py-3 ${
          failing.length === 0
            ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/25"
            : "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-900/25"
        }`}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {failing.length === 0 ? (
            <Check size={15} className="text-emerald-700 dark:text-emerald-300" />
          ) : (
            <AlertTriangle size={15} className="text-red-700 dark:text-red-300" />
          )}
          <span
            className={`text-sm font-semibold ${
              failing.length === 0
                ? "text-emerald-800 dark:text-emerald-200"
                : "text-red-800 dark:text-red-200"
            }`}
          >
            {failing.length === 0
              ? "Every allocation reconciles to the print run"
              : `${failing.length} check${failing.length === 1 ? "" : "s"} out of balance`}
          </span>
        </div>
        <div className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {derived.checks.map((c) => (
            <div key={c.label} className="flex items-baseline justify-between gap-3 text-xs">
              <span className={c.ok ? "text-muted-foreground" : "font-medium text-red-700 dark:text-red-300"}>
                {c.ok ? "✓" : "✗"} {c.label}
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {n(c.result)} / {n(c.target)}
                {c.variance !== 0 && (
                  <span className={c.ok ? "" : "font-semibold text-red-700 dark:text-red-300"}>
                    {" "}
                    ({c.variance > 0 ? "+" : ""}
                    {n(c.variance)})
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ══ At a glance ══ */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Total print run">
          <NumberInput
            value={plan.totalPrintRun}
            onCommit={(v) => patchPlan({ totalPrintRun: v ?? 0 })}
            className="text-2xl font-semibold"
          />
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {plan.covers.length} covers · {plan.covers.length} SKUs
          </p>
        </Tile>
        <Tile label="Warehouse deadline">
          <DateInput
            value={plan.warehouseDeadline}
            onCommit={(v) => patchPlan({ warehouseDeadline: v })}
          />
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {toDeadline == null
              ? "not set"
              : toDeadline >= 0
                ? `${toDeadline} days to go · the hard one`
                : `${Math.abs(toDeadline)} days ago`}
          </p>
        </Tile>
        <Tile label="Launch date">
          <DateInput value={plan.launchDate} onCommit={(v) => patchPlan({ launchDate: v })} />
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {toLaunch == null ? "not set" : toLaunch >= 0 ? `${toLaunch} days to go` : `${Math.abs(toLaunch)} days ago`}
          </p>
        </Tile>
        <Tile label="Next milestone">
          <p className="truncate text-sm font-semibold text-foreground">
            {nextMilestone
              ? new Date(nextMilestone.date!).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
              : "—"}
          </p>
          <p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">
            {nextMilestone?.action ?? "Nothing outstanding"}
          </p>
        </Tile>
      </div>

      {/* ══ Covers ══ */}
      <Section
        title="Cover master"
        blurb="One cover, one SKU, one factory-printed barcode. Units are derived from the share of the run; the balancer absorbs rounding."
        onAdd={() => addRow("covers")}
      >
        <Table head={["Cover", "SKU", "Share %", "Balancer", "Units", ""]}>
          {plan.covers.map((c) => {
            const units = derived.covers.find((x) => x.cover.id === c.id)?.units ?? 0;
            return (
              <tr key={c.id} className="border-t border-border">
                <Td><TextInput value={c.name} onCommit={(v) => patchRow("covers", c.id, { name: v })} /></Td>
                <Td><TextInput value={c.sku} onCommit={(v) => patchRow("covers", c.id, { sku: v })} mono /></Td>
                <Td right><NumberInput value={c.sharePct} onCommit={(v) => patchRow("covers", c.id, { sharePct: v })} /></Td>
                <Td center>
                  <input
                    type="radio"
                    name="cover-balancer"
                    checked={c.isBalancer}
                    onChange={() => {
                      // Exactly one balancer: setting one clears the rest.
                      plan.covers.forEach((o) =>
                        patchRow("covers", o.id, { isBalancer: o.id === c.id })
                      );
                    }}
                    title="Absorbs rounding so every split ties exactly"
                  />
                </Td>
                <Td right><span className="font-medium tabular-nums">{n(units)}</span></Td>
                <Td right><DeleteBtn onClick={() => deleteRow("covers", c.id)} /></Td>
              </tr>
            );
          })}
          <TotalRow cells={["Total", "", "", "", n(derived.covers.reduce((s, c) => s + c.units, 0)), ""]} />
        </Table>
      </Section>

      {/* ══ Channels ══ */}
      <Section
        title="Stock allocation by channel"
        blurb="How the run divides by purpose. Cover columns are derived from the cover master."
        onAdd={() => addRow("channels")}
      >
        <Table head={["Channel", "Kind", "Held at", "Units", ...plan.covers.map((c) => c.name), ""]}>
          {plan.channels.map((ch) => {
            const row = derived.grid.find((g) => g.channel.id === ch.id);
            return (
              <tr key={ch.id} className="border-t border-border">
                <Td><TextInput value={ch.name} onCommit={(v) => patchRow("channels", ch.id, { name: v })} /></Td>
                <Td>
                  <Select
                    value={ch.kind}
                    options={CHANNEL_KINDS.map((k) => ({ value: k, label: k }))}
                    onCommit={(v) => patchRow("channels", ch.id, { kind: v })}
                  />
                </Td>
                <Td>
                  <Select
                    value={ch.hubId ?? ""}
                    options={[{ value: "", label: "—" }, ...plan.hubs.map((h) => ({ value: h.id, label: h.name }))]}
                    onCommit={(v) => patchRow("channels", ch.id, { hubId: v })}
                  />
                </Td>
                <Td right><NumberInput value={ch.units} onCommit={(v) => patchRow("channels", ch.id, { units: v })} /></Td>
                {plan.covers.map((c) => (
                  <Td key={c.id} right>
                    <span className="tabular-nums text-muted-foreground">{n(row?.byCover[c.id] ?? 0)}</span>
                  </Td>
                ))}
                <Td right><DeleteBtn onClick={() => deleteRow("channels", ch.id)} /></Td>
              </tr>
            );
          })}
          <TotalRow
            cells={[
              "Total",
              "",
              "",
              n(plan.channels.reduce((s, c) => s + c.units, 0)),
              ...plan.covers.map((c) =>
                n(derived.grid.reduce((s, g) => s + (g.byCover[c.id] ?? 0), 0))
              ),
              "",
            ]}
          />
        </Table>
      </Section>

      {/* ══ Warehouse model — fully derived ══ */}
      <Section
        title="Regional warehouse model"
        blurb="Entirely derived: a hub holds whatever routes to it from territories, events, stockists and pinned reserve."
        onAdd={() => addRow("hubs")}
      >
        <Table head={["Hub", "Location", "B2C & gifting", "Events", "Stockists", "Reserve", "Total", "% of run", ""]}>
          {derived.hubs.map((h) => (
            <tr key={h.hub.id} className="border-t border-border">
              <Td><TextInput value={h.hub.name} onCommit={(v) => patchRow("hubs", h.hub.id, { name: v })} /></Td>
              <Td><TextInput value={h.hub.location ?? ""} onCommit={(v) => patchRow("hubs", h.hub.id, { location: v })} /></Td>
              <Td right><Derived>{n(h.b2cAndGifting)}</Derived></Td>
              <Td right><Derived>{n(h.events)}</Derived></Td>
              <Td right><Derived>{n(h.stockists)}</Derived></Td>
              <Td right><Derived>{n(h.reserveAndBuffer)}</Derived></Td>
              <Td right><span className="font-semibold tabular-nums">{n(h.total)}</span></Td>
              <Td right><Derived>{pct(h.sharePct)}</Derived></Td>
              <Td right><DeleteBtn onClick={() => deleteRow("hubs", h.hub.id)} /></Td>
            </tr>
          ))}
          <TotalRow
            cells={[
              "Total",
              "",
              n(derived.hubs.reduce((s, h) => s + h.b2cAndGifting, 0)),
              n(derived.hubs.reduce((s, h) => s + h.events, 0)),
              n(derived.hubs.reduce((s, h) => s + h.stockists, 0)),
              n(derived.hubs.reduce((s, h) => s + h.reserveAndBuffer, 0)),
              n(derived.hubs.reduce((s, h) => s + h.total, 0)),
              "100%",
              "",
            ]}
          />
        </Table>
      </Section>

      {/* ══ Territories ══ */}
      <Section
        title="B2C and gifting by territory"
        blurb="Individual-order demand and which hub serves it. This is the volume to quote for fulfilment."
        onAdd={() => addRow("territories")}
      >
        <Table head={["Territory", "Hub", "Phase 1", "Phase 2", "Seeding & VIP", "Total", "Share", ""]}>
          {plan.territories.map((t) => {
            const total = t.phase1 + t.phase2 + t.seedingVip;
            const grand = plan.territories.reduce((s, x) => s + x.phase1 + x.phase2 + x.seedingVip, 0);
            return (
              <tr key={t.id} className="border-t border-border">
                <Td><TextInput value={t.name} onCommit={(v) => patchRow("territories", t.id, { name: v })} /></Td>
                <Td>
                  <Select
                    value={t.hubId ?? ""}
                    options={[{ value: "", label: "—" }, ...plan.hubs.map((h) => ({ value: h.id, label: h.name }))]}
                    onCommit={(v) => patchRow("territories", t.id, { hubId: v })}
                  />
                </Td>
                <Td right><NumberInput value={t.phase1} onCommit={(v) => patchRow("territories", t.id, { phase1: v })} /></Td>
                <Td right><NumberInput value={t.phase2} onCommit={(v) => patchRow("territories", t.id, { phase2: v })} /></Td>
                <Td right><NumberInput value={t.seedingVip} onCommit={(v) => patchRow("territories", t.id, { seedingVip: v })} /></Td>
                <Td right><span className="font-medium tabular-nums">{n(total)}</span></Td>
                <Td right><Derived>{grand > 0 ? pct((total / grand) * 100) : "—"}</Derived></Td>
                <Td right><DeleteBtn onClick={() => deleteRow("territories", t.id)} /></Td>
              </tr>
            );
          })}
          <TotalRow
            cells={[
              "Total",
              "",
              n(plan.territories.reduce((s, t) => s + t.phase1, 0)),
              n(plan.territories.reduce((s, t) => s + t.phase2, 0)),
              n(plan.territories.reduce((s, t) => s + t.seedingVip, 0)),
              n(plan.territories.reduce((s, t) => s + t.phase1 + t.phase2 + t.seedingVip, 0)),
              "100%",
              "",
            ]}
          />
        </Table>
      </Section>

      {/* ══ Events ══ */}
      <Section title="Launch event stock" blurb="Sent to event cities where practical." onAdd={() => addRow("events")}>
        <Table head={["City", "Hub", "Units", "Share", "Notes", ""]}>
          {plan.events.map((e) => {
            const grand = plan.events.reduce((s, x) => s + x.units, 0);
            return (
              <tr key={e.id} className="border-t border-border">
                <Td><TextInput value={e.city} onCommit={(v) => patchRow("events", e.id, { city: v })} /></Td>
                <Td>
                  <Select
                    value={e.hubId ?? ""}
                    options={[{ value: "", label: "—" }, ...plan.hubs.map((h) => ({ value: h.id, label: h.name }))]}
                    onCommit={(v) => patchRow("events", e.id, { hubId: v })}
                  />
                </Td>
                <Td right><NumberInput value={e.units} onCommit={(v) => patchRow("events", e.id, { units: v })} /></Td>
                <Td right><Derived>{grand > 0 ? pct((e.units / grand) * 100) : "—"}</Derived></Td>
                <Td><TextInput value={(e as unknown as Row).notes as string ?? ""} onCommit={(v) => patchRow("events", e.id, { notes: v })} /></Td>
                <Td right><DeleteBtn onClick={() => deleteRow("events", e.id)} /></Td>
              </tr>
            );
          })}
          <TotalRow cells={["Total", "", n(plan.events.reduce((s, e) => s + e.units, 0)), "100%", "", ""]} />
        </Table>
      </Section>

      {/* ══ Stockists ══ */}
      <Section
        title={`Stockists · ${plan.stockists.length} outlets`}
        blurb="Edit units or the cover profile and every cover split, hub total and reconciliation check updates."
        onAdd={() => addRow("stockists")}
      >
        <Table head={["Store", "City", "Market", "Ships from", "Profile", "Units", ...plan.covers.map((c) => c.name), ""]}>
          {plan.stockists.map((s) => {
            const split = stockistCoverSplit(s, plan);
            return (
              <tr key={s.id} className="border-t border-border">
                <Td><TextInput value={s.name} onCommit={(v) => patchRow("stockists", s.id, { name: v })} /></Td>
                <Td><TextInput value={s.city ?? ""} onCommit={(v) => patchRow("stockists", s.id, { city: v })} /></Td>
                <Td><TextInput value={s.market ?? ""} onCommit={(v) => patchRow("stockists", s.id, { market: v })} /></Td>
                <Td>
                  <Select
                    value={s.hubId ?? ""}
                    options={[{ value: "", label: "—" }, ...plan.hubs.map((h) => ({ value: h.id, label: h.name }))]}
                    onCommit={(v) => patchRow("stockists", s.id, { hubId: v })}
                  />
                </Td>
                <Td>
                  <Select
                    value={s.profileId ?? ""}
                    options={[{ value: "", label: "—" }, ...plan.profiles.map((p) => ({ value: p.id, label: p.name }))]}
                    onCommit={(v) => patchRow("stockists", s.id, { profileId: v })}
                  />
                </Td>
                <Td right><NumberInput value={s.units} onCommit={(v) => patchRow("stockists", s.id, { units: v })} /></Td>
                {plan.covers.map((c) => (
                  <Td key={c.id} right><Derived>{n(split[c.id] ?? 0)}</Derived></Td>
                ))}
                <Td right><DeleteBtn onClick={() => deleteRow("stockists", s.id)} /></Td>
              </tr>
            );
          })}
          <TotalRow
            cells={[
              "Total",
              "",
              "",
              "",
              "",
              n(plan.stockists.reduce((s, x) => s + x.units, 0)),
              ...plan.covers.map((c) => n(derived.stockCovers[c.id] ?? 0)),
              "",
            ]}
          />
        </Table>
      </Section>

      {/* ══ Cover profiles ══ */}
      <Section
        title="Cover profiles"
        blurb="Named mixes applied to stockists. The balancer cover absorbs rounding on every row."
        onAdd={() => addRow("profiles")}
      >
        <Table head={["Profile", ...plan.covers.map((c) => `${c.name} %`), "Default", ""]}>
          {plan.profiles.map((p) => (
            <tr key={p.id} className="border-t border-border">
              <Td><TextInput value={p.name} onCommit={(v) => patchRow("profiles", p.id, { name: v })} /></Td>
              {plan.covers.map((c) => (
                <Td key={c.id} right>
                  <NumberInput
                    value={p.splits?.[c.name] ?? 0}
                    onCommit={(v) =>
                      patchRow("profiles", p.id, { splits: { ...p.splits, [c.name]: v ?? 0 } })
                    }
                  />
                </Td>
              ))}
              <Td center>
                <input
                  type="radio"
                  name="profile-default"
                  checked={p.isDefault}
                  onChange={() =>
                    plan.profiles.forEach((o) =>
                      patchRow("profiles", o.id, { isDefault: o.id === p.id })
                    )
                  }
                />
              </Td>
              <Td right><DeleteBtn onClick={() => deleteRow("profiles", p.id)} /></Td>
            </tr>
          ))}
        </Table>
      </Section>

      {/* ══ US economics ══ */}
      <Section title="US shipping economics" blurb="Salt Lake City domestic rates against last year's UK lane.">
        <div className="grid gap-3 px-4 py-3 sm:grid-cols-4">
          <Field label="GBP → USD">
            <NumberInput value={plan.gbpToUsd} onCommit={(v) => patchPlan({ gbpToUsd: v ?? 0 })} step="0.01" />
          </Field>
          <Field label="East Coast share %">
            <NumberInput value={plan.eastCoastShare} onCommit={(v) => patchPlan({ eastCoastShare: v ?? 0 })} />
          </Field>
          <Field label="Blended domestic rate">
            <Derived>{money(derived.us.blendedUsd, "USD")}</Derived>
          </Field>
          <Field label="Saving per order">
            <Derived>{money(derived.us.savingPerOrderUsd, "USD")}</Derived>
          </Field>
        </div>
        <div className="border-t border-border bg-muted px-4 py-3">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Total estimated saving
            </span>
            <span className="text-xl font-semibold tabular-nums text-foreground">
              {money(derived.us.totalSavingUsd, "USD")}
            </span>
            <span className="text-sm tabular-nums text-muted-foreground">
              {money(derived.us.totalSavingGbp, "GBP")}
            </span>
            <span className="text-[11px] text-muted-foreground">
              on {n(derived.us.usVolume)} US orders · assumes one magazine per order
            </span>
          </div>
        </div>
      </Section>

      {/* ══ Lanes ══ */}
      <Section
        title="Fulfilment lanes"
        blurb="Rates arrive from different partners at different times — a blank rate is an outstanding quote, not a zero."
        onAdd={() => addRow("lanes")}
      >
        <Table head={["Lane", "Rate / order", "Currency", "Volume", "Total", "Quote status", ""]}>
          {plan.lanes.map((l) => (
            <tr key={l.id} className={`border-t border-border ${l.isBaseline ? "bg-muted" : ""}`}>
              <Td><TextInput value={l.name} onCommit={(v) => patchRow("lanes", l.id, { name: v })} /></Td>
              <Td right><NumberInput value={l.ratePerOrder} onCommit={(v) => patchRow("lanes", l.id, { ratePerOrder: v })} step="0.01" placeholder="—" /></Td>
              <Td>
                <Select
                  value={l.currency}
                  options={["GBP", "USD", "EUR"].map((c) => ({ value: c, label: c }))}
                  onCommit={(v) => patchRow("lanes", l.id, { currency: v })}
                />
              </Td>
              <Td right><NumberInput value={l.volume} onCommit={(v) => patchRow("lanes", l.id, { volume: v })} /></Td>
              <Td right>
                <Derived>
                  {l.ratePerOrder == null ? "awaiting quote" : money(l.ratePerOrder * l.volume, l.currency)}
                </Derived>
              </Td>
              <Td><TextInput value={l.quoteStatus ?? ""} onCommit={(v) => patchRow("lanes", l.id, { quoteStatus: v })} /></Td>
              <Td right><DeleteBtn onClick={() => deleteRow("lanes", l.id)} /></Td>
            </tr>
          ))}
        </Table>
        <p className="px-4 py-2 text-[11px] text-muted-foreground">
          Lane costs are in mixed currencies and deliberately not totalled.
        </p>
      </Section>

      {/* ══ Milestones ══ */}
      <Section
        title="Rollout calendar"
        blurb="Every date counts back from the warehouse deadline. Critical path means slipping it moves the launch."
        onAdd={() => addRow("milestones")}
      >
        <Table head={["#", "Window", "Date", "Milestone", "Owner", "Days", "Critical", "Status", ""]}>
          {plan.milestones.map((m) => {
            const days = daysBetween(today, m.date);
            return (
              <tr key={m.id} className={`border-t border-border ${m.criticalPath ? "bg-muted" : ""}`}>
                <Td><span className="tabular-nums text-muted-foreground">{m.seq}</span></Td>
                <Td><TextInput value={m.window ?? ""} onCommit={(v) => patchRow("milestones", m.id, { window: v })} /></Td>
                <Td><DateInput value={m.date} onCommit={(v) => patchRow("milestones", m.id, { date: v })} small /></Td>
                <Td><TextInput value={m.action} onCommit={(v) => patchRow("milestones", m.id, { action: v })} /></Td>
                <Td><TextInput value={m.owner ?? ""} onCommit={(v) => patchRow("milestones", m.id, { owner: v })} /></Td>
                <Td right>
                  <span
                    className={`tabular-nums ${
                      days != null && days < 0 && m.status !== "DONE"
                        ? "font-semibold text-red-600 dark:text-red-400"
                        : "text-muted-foreground"
                    }`}
                  >
                    {days ?? "—"}
                  </span>
                </Td>
                <Td center>
                  <input
                    type="checkbox"
                    checked={m.criticalPath}
                    onChange={(e) => patchRow("milestones", m.id, { criticalPath: e.target.checked })}
                  />
                </Td>
                <Td>
                  <Select
                    value={m.status}
                    options={MILESTONE_STATUSES.map((s) => ({ value: s, label: MILESTONE_STATUS_LABEL[s] }))}
                    onCommit={(v) => patchRow("milestones", m.id, { status: v })}
                  />
                </Td>
                <Td right><DeleteBtn onClick={() => deleteRow("milestones", m.id)} /></Td>
              </tr>
            );
          })}
        </Table>
      </Section>

      {/* ══ Assumptions ══ */}
      <Section title="Assumptions and open items">
        <textarea
          defaultValue={plan.assumptions ?? ""}
          onBlur={(e) => patchPlan({ assumptions: e.target.value })}
          rows={8}
          placeholder="What this plan assumes, and what's still unknown…"
          className="w-full resize-y border-none bg-transparent px-4 py-3 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
        />
      </Section>
    </div>
  );
}

// ── Presentational bits ─────────────────────────────────────────────────────

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm font-medium text-foreground">{children}</div>
    </div>
  );
}

function Section({
  title,
  blurb,
  onAdd,
  children,
}: {
  title: string;
  blurb?: string;
  onAdd?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {/* Solid bar, same ink as the print budget — sections have to be findable
          by eye in a page this long. */}
      <div className="flex items-center justify-between gap-3 bg-foreground px-4 py-2.5">
        <div className="min-w-0">
          <h2 className="text-xs font-bold uppercase tracking-widest text-background">{title}</h2>
          {blurb && <p className="mt-0.5 truncate text-[11px] text-background/70">{blurb}</p>}
        </div>
        {onAdd && (
          <button
            onClick={onAdd}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-background px-2 py-1 text-[11px] font-medium text-foreground transition-opacity hover:opacity-90"
          >
            <Plus size={11} /> Add
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="bg-muted text-[10px] uppercase tracking-widest text-muted-foreground">
            {head.map((h, i) => (
              <th
                key={i}
                className={`px-3 py-2 font-semibold ${i === 0 ? "text-left" : "text-right"} ${
                  h === "" ? "w-8" : ""
                }`}
              >
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

function Td({
  children,
  right,
  center,
}: {
  children: React.ReactNode;
  right?: boolean;
  center?: boolean;
}) {
  return (
    <td className={`px-3 py-1.5 ${right ? "text-right" : center ? "text-center" : "text-left"}`}>
      {children}
    </td>
  );
}

function TotalRow({ cells }: { cells: string[] }) {
  return (
    <tr className="border-t-2 border-foreground bg-muted font-semibold">
      {cells.map((c, i) => (
        <td key={i} className={`px-3 py-2 tabular-nums ${i === 0 ? "text-left" : "text-right"}`}>
          {c}
        </td>
      ))}
    </tr>
  );
}

// Derived values are rendered, never edited — visually distinct so it's obvious
// which cells you can type into and which follow from something else.
function Derived({ children }: { children: React.ReactNode }) {
  return <span className="tabular-nums text-muted-foreground">{children}</span>;
}

function DeleteBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-muted-foreground/40 transition-colors hover:text-red-500"
      title="Remove"
    >
      <Trash2 size={12} />
    </button>
  );
}

function TextInput({
  value,
  onCommit,
  mono,
}: {
  value: string;
  onCommit: (v: string) => void;
  mono?: boolean;
}) {
  // Adjusting state during render rather than in an effect — React's documented
  // pattern for re-syncing to a changed prop, and it avoids a second paint.
  const [v, setV] = useState(value);
  const [lastProp, setLastProp] = useState(value);
  if (lastProp !== value) {
    setLastProp(value);
    setV(value);
  }
  return (
    <input
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== value && onCommit(v)}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      className={`w-full min-w-[6rem] rounded border border-transparent bg-transparent px-1 py-0.5 text-sm text-foreground outline-none hover:border-border focus:border-[#9C7C2E] ${
        mono ? "font-mono text-xs" : ""
      }`}
    />
  );
}

function NumberInput({
  value,
  onCommit,
  step,
  placeholder,
  className,
}: {
  value: number | null;
  onCommit: (v: number | null) => void;
  step?: string;
  placeholder?: string;
  className?: string;
}) {
  const asText = value == null ? "" : String(value);
  const [v, setV] = useState(asText);
  const [lastProp, setLastProp] = useState(asText);
  if (lastProp !== asText) {
    setLastProp(asText);
    setV(asText);
  }
  return (
    <input
      type="number"
      step={step}
      value={v}
      placeholder={placeholder}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        const next = v === "" ? null : Number(v);
        if (next !== value) onCommit(next);
      }}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      className={`w-full min-w-[4rem] rounded border border-transparent bg-transparent px-1 py-0.5 text-right text-sm tabular-nums text-foreground outline-none hover:border-border focus:border-[#9C7C2E] ${className ?? ""}`}
    />
  );
}

function DateInput({
  value,
  onCommit,
  small,
}: {
  value: Date | string | null;
  onCommit: (v: string | null) => void;
  small?: boolean;
}) {
  const iso = value ? new Date(value).toISOString().slice(0, 10) : "";
  return (
    <input
      type="date"
      defaultValue={iso}
      onBlur={(e) => e.target.value !== iso && onCommit(e.target.value || null)}
      className={`rounded border border-transparent bg-transparent px-1 py-0.5 text-foreground outline-none hover:border-border focus:border-[#9C7C2E] ${
        small ? "text-xs" : "text-lg font-semibold"
      }`}
    />
  );
}

function Select({
  value,
  options,
  onCommit,
}: {
  value: string;
  options: { value: string; label: string }[];
  onCommit: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onCommit(e.target.value)}
      className="w-full min-w-[5rem] rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-foreground outline-none hover:border-border focus:border-[#9C7C2E]"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
