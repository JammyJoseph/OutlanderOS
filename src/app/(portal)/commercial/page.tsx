"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getJson, isSessionExpired } from "@/lib/session-fetch";
import { Plus } from "lucide-react";
import { format, parseISO, formatDistanceToNow, differenceInCalendarDays, isSameMonth } from "date-fns";
import { STAGE_ORDER, STAGE_STYLES, formatMoney, type Deal, type DealStage } from "./_components/deal-ui";
import NewDealModal from "./_components/NewDealModal";
import { Avatar, Chips, Dot, Empty, Page, PageHead, Panel, Rows, SectionHead, Stat, StatGrid, Table, Tag, TextLink, pill } from "@/components/os";

interface DashboardDeal {
  id: string;
  title: string;
  client: { id: string; name: string };
  stage: DealStage;
  jobType: string | null;
  workflowType: string;
  type: string;
  dealTypes: string[];
  value: number | null;
  dueDate: string | null;
  briefDueDate: string | null;
  stageUpdatedAt: string;
  updatedAt: string;
  assignedTo: { id: string; name: string } | null;
  production: {
    id: string;
    status: string;
    nextShoot: string | null;
    budgetTotal: number | null;
    budgetActual: number | null;
    updatedAt: string;
  } | null;
}

interface CalEvent {
  date: string;
  type: "shoot" | "live" | "brief" | "payment";
  dealId: string;
  dealTitle: string;
  label: string;
}

interface ActivityItem {
  id: string;
  type: string;
  message: string;
  userName: string | null;
  createdAt: string;
  campaign: { id: string; title: string; stage: DealStage; client: { id: string; name: string } };
}

interface DashboardData {
  metrics: { activeDeals: number; pipelineValue: number; inProduction: number; completedThisMonth: number };
  activeDeals: DashboardDeal[];
  stageCounts: { stage: DealStage; count: number; value: number }[];
  calendar: CalEvent[];
  recentActivity: ActivityItem[];
}

// Event markers follow the workspace dots: shoots are Production, content
// going live is Print-green, briefs are Commercial, payments Finance.
const EVENT_STYLES: Record<CalEvent["type"], { dot: string; label: string }> = {
  shoot: { dot: "#A93B2E", label: "Shoot" },
  live: { dot: "#2E5E44", label: "Content live" },
  brief: { dot: "#9C7C2E", label: "Brief due" },
  payment: { dot: "#2F4B8F", label: "Payment due" },
};

// Stage tags carry meaning only where it matters: live and paid work is
// green, work in production is blue, everything else is neutral.
function stageTone(stage: DealStage): "ok" | "info" | "neutral" {
  if (stage === "LIVE" || stage === "COMPLETED" || stage === "PAID") return "ok";
  if (stage === "IN_PRODUCTION") return "info";
  return "neutral";
}

type SortMode = "stage" | "days";

export default function CommercialDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [showNewDeal, setShowNewDeal] = useState(false);
  const [stageFilter, setStageFilter] = useState<DealStage | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("stage");
  const router = useRouter();

  useEffect(() => {
    // A failed load must never fall through to `data = null` → "0 deals": an
    // empty pipeline for what is really an expired session or a 500 makes live
    // deals look deleted.
    let leaving = false;
    getJson<DashboardData>("/api/commercial/dashboard")
      .then((d) => setData(d))
      .catch((e) => {
        // Expired session: already navigating to /login, so hold the spinner
        // rather than flashing an error on the way out.
        if (isSessionExpired(e)) {
          leaving = true;
          return;
        }
        setLoadFailed(true);
      })
      .finally(() => {
        if (!leaving) setLoading(false);
      });
  }, []);

  const deals = useMemo(() => data?.activeDeals ?? [], [data]);

  const filteredSorted = useMemo(() => {
    const list = stageFilter ? deals.filter((d) => d.stage === stageFilter) : [...deals];
    if (sortMode === "stage") {
      list.sort(
        (a, b) =>
          STAGE_ORDER.indexOf(b.stage) - STAGE_ORDER.indexOf(a.stage) ||
          daysInStage(b) - daysInStage(a)
      );
    } else {
      list.sort((a, b) => daysInStage(b) - daysInStage(a));
    }
    return list;
  }, [deals, stageFilter, sortMode]);

  // Each deal's next dated event (shoot, brief, payment…) for the "Next date" column.
  const nextEvent = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const map = new Map<string, CalEvent>();
    for (const e of data?.calendar ?? []) {
      const d = parseISO(e.date);
      if (d < today) continue;
      const cur = map.get(e.dealId);
      if (!cur || parseISO(cur.date) > d) map.set(e.dealId, e);
    }
    return map;
  }, [data]);

  const upcoming = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return (data?.calendar ?? [])
      .filter((e) => parseISO(e.date) >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 6);
  }, [data]);

  const signOff = data?.stageCounts.find((s) => s.stage === "SIGN_OFF");
  const inProd = data?.stageCounts.find((s) => s.stage === "IN_PRODUCTION");

  return (
    <Page>
      <PageHead
        eyebrow="Total pipeline value"
        figure={data ? formatMoney(data.metrics.pipelineValue) : " "}
        actions={
          <>
            <button type="button" onClick={() => setShowNewDeal(true)} className={pill("primary")}>
              <Plus strokeWidth={1.75} /> New deal
            </button>
            <Link href="/commercial/pipeline" className={pill("secondary")}>
              Open pipeline
            </Link>
            <Link href="/commercial/media-plans/new" className={pill("secondary")}>
              New media plan
            </Link>
          </>
        }
      />

      {loading && (
        <StatGrid>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-[132px] animate-pulse rounded-2xl bg-surface" />
          ))}
        </StatGrid>
      )}

      {/* Load failure — explicitly *not* an empty state. */}
      {!loading && loadFailed && (
        <Panel>
          <Empty
            title="Couldn't load the dashboard"
            action={
              <button type="button" onClick={() => window.location.reload()} className={pill("primary")}>
                Try again
              </button>
            }
          >
            Your deals are safe. This is a loading problem, not missing data.
          </Empty>
        </Panel>
      )}

      {!loading && data && (
        <>
          <StatGrid aria-label="Commercial at a glance">
            <Stat label="Active deals" value={data.metrics.activeDeals} note="In flight now" />
            <Stat
              label="In production"
              value={data.metrics.inProduction}
              note={inProd ? `${formatMoney(inProd.value)} of value` : "Jobs shooting"}
            />
            <Stat
              label="Awaiting signature"
              value={signOff?.count ?? 0}
              note={signOff?.count ? `${formatMoney(signOff.value)} at sign-off` : "Nothing out to sign"}
            />
            <Stat label={`Completed in ${format(new Date(), "MMMM")}`} value={data.metrics.completedThisMonth} note="Delivered or paid" />
          </StatGrid>

          <Panel
            title="Deals by stage"
            action={<TextLink href="/commercial/pipeline">Open as board</TextLink>}
          >
            <div className="mt-1 grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2">
              {STAGE_ORDER.filter((st) => data.stageCounts.some((c) => c.stage === st)).map((st) => {
                const c = data.stageCounts.find((x) => x.stage === st)!;
                const on = stageFilter === st;
                return (
                  <button
                    key={st}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setStageFilter((cur) => (cur === st ? null : st))}
                    className={`flex min-h-[104px] flex-col rounded-xl p-3.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground ${
                      on ? "bg-accent" : "bg-background hover:brightness-[0.98]"
                    }`}
                  >
                    <span className="text-[13px] leading-tight text-muted-foreground">{STAGE_STYLES[st]?.label ?? st}</span>
                    <span className="mt-auto text-[22px] font-semibold tabular-nums">{c.count}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">{formatMoney(c.value)}</span>
                  </button>
                );
              })}
            </div>
          </Panel>

          <section className="flex flex-col gap-3">
            <SectionHead
              title={
                <>
                  Active deals
                  {stageFilter && (
                    <button type="button" onClick={() => setStageFilter(null)} className="ml-3 align-middle text-sm font-semibold text-brand underline underline-offset-4">
                      {STAGE_STYLES[stageFilter]?.label} · clear
                    </button>
                  )}
                </>
              }
              action={
                <Chips
                  label="Sort deals"
                  value={sortMode}
                  onChange={setSortMode}
                  options={[
                    { value: "stage", label: "By stage" },
                    { value: "days", label: "By days in stage" },
                  ]}
                />
              }
            />
            {filteredSorted.length === 0 ? (
              <Panel>
                <Empty title="No active deals">{stageFilter ? "Nothing in this stage." : "Create a deal to get started."}</Empty>
              </Panel>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>Deal</th>
                    <th>Stage</th>
                    <th className="!text-right">Value</th>
                    <th>Next date</th>
                    <th className="!text-right">Days in stage</th>
                    <th>Owner</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSorted.map((d) => {
                    const days = daysInStage(d);
                    const ev = nextEvent.get(d.id);
                    return (
                      <tr key={d.id} onClick={() => router.push(`/commercial/deals/${d.id}`)} className="cursor-pointer hover:bg-surface">
                        <td>
                          <Link href={`/commercial/deals/${d.id}`} onClick={(e) => e.stopPropagation()} className="block max-w-[260px] truncate font-semibold hover:underline">
                            {d.title}
                          </Link>
                          <span className="block truncate text-sm text-muted-foreground">{d.client.name}</span>
                        </td>
                        <td>
                          <Tag tone={stageTone(d.stage)}>{STAGE_STYLES[d.stage]?.label ?? d.stage}</Tag>
                        </td>
                        <td className="text-right font-medium tabular-nums">{formatMoney(d.value)}</td>
                        <td className="whitespace-nowrap text-ink-2">
                          {ev ? `${EVENT_STYLES[ev.type].label} · ${format(parseISO(ev.date), "EEE d MMM")}` : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className={`text-right tabular-nums ${days >= 14 ? "font-semibold text-warn" : ""}`} title={days >= 14 ? "Over two weeks in this stage" : undefined}>
                          {days}
                        </td>
                        <td>{d.assignedTo ? <Avatar name={d.assignedTo.name} size={32} /> : <span className="text-sm text-muted-foreground">—</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Coming up" action={<TextLink href="/commercial/calendar">Calendar</TextLink>}>
              {upcoming.length === 0 ? (
                <p className="py-2 text-[15px] text-muted-foreground">Nothing scheduled.</p>
              ) : (
                <Rows>
                  {upcoming.map((e, i) => (
                    <Link key={i} href={`/commercial/deals/${e.dealId}`} className="flex items-start gap-3.5 py-3.5 hover:[&_.t]:underline">
                      <Dot color={EVENT_STYLES[e.type].dot} className="mt-[7px]" />
                      <span className="min-w-0">
                        <span className="t block font-semibold">
                          {EVENT_STYLES[e.type].label} · {e.dealTitle}
                        </span>
                        <span className="block text-sm text-muted-foreground">
                          {format(parseISO(e.date), isSameMonth(parseISO(e.date), new Date()) ? "EEE d MMM" : "d MMM yyyy")}
                          {e.label && e.label !== EVENT_STYLES[e.type].label ? ` · ${e.label}` : ""}
                        </span>
                      </span>
                    </Link>
                  ))}
                </Rows>
              )}
            </Panel>

            <Panel title="Recent activity">
              {data.recentActivity.length === 0 ? (
                <p className="py-2 text-[15px] text-muted-foreground">Deal and production updates appear here.</p>
              ) : (
                <Rows>
                  {data.recentActivity.slice(0, 6).map((item) => (
                    <Link key={item.id} href={`/commercial/deals/${item.campaign.id}`} className="flex items-start gap-3.5 py-3.5 hover:[&_.t]:underline">
                      <Avatar name={item.userName ?? item.campaign.client.name} size={32} tone="card" />
                      <span className="min-w-0">
                        <span className="t block leading-snug">
                          {item.userName && <strong className="font-semibold">{item.userName.split(" ")[0]} </strong>}
                          {item.message}
                        </span>
                        <span className="block text-sm text-muted-foreground">{formatDistanceToNow(parseISO(item.createdAt), { addSuffix: true })}</span>
                      </span>
                    </Link>
                  ))}
                </Rows>
              )}
            </Panel>
          </div>
        </>
      )}

      {showNewDeal && (
        <NewDealModal
          onClose={() => setShowNewDeal(false)}
          onCreated={(deal: Deal) => {
            setShowNewDeal(false);
            router.push(`/commercial/deals/${deal.id}`);
          }}
        />
      )}
    </Page>
  );
}

function daysInStage(d: DashboardDeal): number {
  return differenceInCalendarDays(new Date(), parseISO(d.stageUpdatedAt));
}
