"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Loader2,
  TrendingUp,
  Film,
  CheckCircle2,
  Briefcase,
  Kanban,
  Activity as ActivityIcon,
  ArrowRightLeft,
  Banknote,
  Sparkles,
  PenLine,
  Rocket,
  PackageCheck,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Clock,
  User as UserIcon,
  CalendarDays,
} from "lucide-react";
import {
  format,
  parseISO,
  formatDistanceToNow,
  differenceInCalendarDays,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
} from "date-fns";
import {
  STAGE_ORDER,
  STAGE_STYLES,
  typeStyle,
  dealTypesOf,
  formatMoney,
  type Deal,
  type DealStage,
} from "./_components/deal-ui";
import NewDealModal from "./_components/NewDealModal";

const PRODUCTION_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Planning",
  BRIEFED: "Briefed",
  PRE_PRODUCTION: "Pre-Production",
  SHOOTING: "Shooting",
  POST_PRODUCTION: "Post-production",
  DELIVERED: "Delivered",
  ARCHIVED: "Archived",
};

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

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  created: <Sparkles size={13} />,
  stage_change: <ArrowRightLeft size={13} />,
  budget_update: <Banknote size={13} />,
  field_update: <PenLine size={13} />,
  note: <PenLine size={13} />,
  deliverable: <PackageCheck size={13} />,
  project_started: <Rocket size={13} />,
};

const EVENT_STYLES: Record<CalEvent["type"], { dot: string; label: string }> = {
  shoot: { dot: "bg-red-500", label: "Shoot" },
  live: { dot: "bg-emerald-400", label: "Content live" },
  brief: { dot: "bg-amber-400", label: "Brief deadline" },
  payment: { dot: "bg-blue-500", label: "Payment due" },
};

type SortMode = "stage" | "days";

export default function CommercialDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewDeal, setShowNewDeal] = useState(false);
  const [stageFilter, setStageFilter] = useState<DealStage | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("stage");
  const router = useRouter();

  useEffect(() => {
    fetch("/api/commercial/dashboard")
      .then((r) => r.json())
      .then((d) => {
        if (d && !d.error) setData(d);
      })
      .finally(() => setLoading(false));
  }, []);

  const deals = data?.activeDeals ?? [];

  const filteredSorted = useMemo(() => {
    let list = stageFilter ? deals.filter((d) => d.stage === stageFilter) : [...deals];
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

  return (
    <div className="min-h-screen bg-card">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Page header */}
        <div className="flex items-end justify-between mb-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--portal-commercial)]">
              OutlanderOS · Commercial
            </p>
            <h1 className="mt-1 text-3xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
              Operations Dashboard
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
              {data?.metrics.activeDeals ?? 0} active job
              {(data?.metrics.activeDeals ?? 0) !== 1 ? "s" : ""} across the pipeline
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/commercial/pipeline"
              className="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shadow-sm"
            >
              <Kanban size={16} className="text-[var(--portal-commercial)]" />
              Open Pipeline
            </Link>
            <button
              onClick={() => setShowNewDeal(true)}
              className="flex items-center gap-2 bg-[#ffd700] text-black px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-[#ffd700] transition-colors shadow-sm"
            >
              <Plus size={16} />
              New Deal
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={24} className="animate-spin text-gray-400 dark:text-gray-500" />
          </div>
        )}

        {!loading && data && (
          <>
            {/* Top metrics */}
            <section className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard
                label="Active Deals"
                value={String(data.metrics.activeDeals)}
                icon={<Briefcase size={15} />}
                tone="amber"
                subtitle="in flight"
              />
              <StatCard
                label="Pipeline Value"
                value={formatMoney(data.metrics.pipelineValue)}
                icon={<TrendingUp size={15} />}
                tone="green"
                subtitle="active deals"
              />
              <StatCard
                label="In Production"
                value={String(data.metrics.inProduction)}
                icon={<Film size={15} />}
                tone="red"
                subtitle="jobs shooting"
              />
              <StatCard
                label="Completed This Month"
                value={String(data.metrics.completedThisMonth)}
                icon={<CheckCircle2 size={15} />}
                tone="blue"
                subtitle="delivered / paid"
              />
            </section>

            {/* Active jobs + stage sidebar */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 mb-6">
              <div className="lg:col-span-3">
                <ActiveJobs
                  deals={filteredSorted}
                  total={deals.length}
                  stageFilter={stageFilter}
                  onClearFilter={() => setStageFilter(null)}
                  sortMode={sortMode}
                  onToggleSort={() => setSortMode((m) => (m === "stage" ? "days" : "stage"))}
                  onRowClick={(id) => router.push(`/commercial/deals/${id}`)}
                />
              </div>
              <div className="lg:col-span-1">
                <StageSummary
                  stageCounts={data.stageCounts}
                  active={stageFilter}
                  onPick={(s) => setStageFilter((cur) => (cur === s ? null : s))}
                />
              </div>
            </div>

            {/* Universal campaign calendar */}
            <section className="mb-6">
              <CampaignCalendar events={data.calendar} onPick={(id) => router.push(`/commercial/deals/${id}`)} />
            </section>

            {/* Recent activity */}
            <section>
              <RecentActivity items={data.recentActivity} />
            </section>
          </>
        )}
      </div>

      {showNewDeal && (
        <NewDealModal
          onClose={() => setShowNewDeal(false)}
          onCreated={(deal: Deal) => {
            setShowNewDeal(false);
            router.push(`/commercial/deals/${deal.id}`);
          }}
        />
      )}
    </div>
  );
}

function daysInStage(d: DashboardDeal): number {
  return differenceInCalendarDays(new Date(), parseISO(d.stageUpdatedAt));
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  tone,
  subtitle,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: "amber" | "red" | "blue" | "green";
  subtitle?: string;
}) {
  const TONE: Record<typeof tone, { bg: string; fg: string }> = {
    amber: { bg: "bg-amber-50 dark:bg-amber-900/30", fg: "text-[var(--portal-commercial)]" },
    red: { bg: "bg-red-50 dark:bg-red-900/30", fg: "text-red-600 dark:text-red-400" },
    blue: { bg: "bg-blue-50 dark:bg-blue-900/30", fg: "text-blue-600 dark:text-blue-400" },
    green: { bg: "bg-green-50 dark:bg-green-900/30", fg: "text-green-600 dark:text-green-400" },
  };
  const t = TONE[tone];
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
        <div className={`w-7 h-7 rounded-lg ${t.bg} ${t.fg} flex items-center justify-center`}>
          {icon}
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight">{value}</p>
        {subtitle && <p className="text-xs text-gray-400 dark:text-gray-500">{subtitle}</p>}
      </div>
    </div>
  );
}

// ─── Active jobs table ──────────────────────────────────────────────────────

function ActiveJobs({
  deals,
  total,
  stageFilter,
  onClearFilter,
  sortMode,
  onToggleSort,
  onRowClick,
}: {
  deals: DashboardDeal[];
  total: number;
  stageFilter: DealStage | null;
  onClearFilter: () => void;
  sortMode: SortMode;
  onToggleSort: () => void;
  onRowClick: (id: string) => void;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50 dark:border-gray-800 flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
          <Briefcase size={15} className="text-[var(--portal-commercial)]" />
          Active Jobs
          <span className="text-gray-400 dark:text-gray-500 font-normal">
            {deals.length}
            {stageFilter ? ` of ${total}` : ""}
          </span>
          {stageFilter && (
            <button
              onClick={onClearFilter}
              className="ml-1 text-[11px] font-medium text-[var(--portal-commercial)] hover:text-[var(--portal-commercial)]"
            >
              · {STAGE_STYLES[stageFilter]?.label} ✕
            </button>
          )}
        </h2>
        <button
          onClick={onToggleSort}
          className="inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5"
          title="Toggle sort"
        >
          {sortMode === "stage" ? <ArrowDown size={12} /> : <ArrowUp size={12} />}
          Sort: {sortMode === "stage" ? "Stage" : "Days in stage"}
        </button>
      </div>

      {deals.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">No active jobs</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {stageFilter ? "No deals in this stage." : "Create a deal to get started."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 border-b border-gray-50 dark:border-gray-800">
                <th className="px-5 py-2.5 font-semibold">Deal</th>
                <th className="px-3 py-2.5 font-semibold">Type</th>
                <th className="px-3 py-2.5 font-semibold">Stage</th>
                <th className="px-3 py-2.5 font-semibold text-right">Value</th>
                <th className="px-3 py-2.5 font-semibold text-right">In stage</th>
                <th className="px-3 py-2.5 font-semibold">Production</th>
                <th className="px-3 py-2.5 font-semibold">Owner</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {deals.map((d) => {
                const style = STAGE_STYLES[d.stage] ?? STAGE_STYLES.NEW_BRIEF;
                const days = daysInStage(d);
                const types = dealTypesOf(d);
                const primaryType = types[0];
                const stuck = days >= 14;
                return (
                  <tr
                    key={d.id}
                    onClick={() => onRowClick(d.id)}
                    className="cursor-pointer hover:bg-gray-50/60 dark:hover:bg-gray-800/60 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <p className="font-semibold text-gray-900 dark:text-gray-100 leading-tight truncate max-w-[220px]">
                        {d.title}
                      </p>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{d.client.name}</p>
                    </td>
                    <td className="px-3 py-3">
                      {primaryType ? (
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${typeStyle(primaryType).bg} ${typeStyle(primaryType).text}`}
                        >
                          {typeStyle(primaryType).label}
                        </span>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                        {style.label}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
                      {formatMoney(d.value)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span
                        className={`inline-flex items-center gap-1 tabular-nums ${stuck ? "text-red-500 font-semibold" : "text-gray-500 dark:text-gray-400"}`}
                        title={stuck ? "Stuck — over 2 weeks in this stage" : "Days in current stage"}
                      >
                        <Clock size={11} />
                        {days}d
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {d.production ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600">
                          <Film size={11} />
                          {PRODUCTION_STATUS_LABELS[d.production.status] ?? d.production.status}
                          {d.production.nextShoot && (
                            <span className="text-gray-400 dark:text-gray-500">
                              · {format(parseISO(d.production.nextShoot), "d MMM")}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {d.assignedTo ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 truncate max-w-[90px]">
                          <UserIcon size={11} />
                          {d.assignedTo.name.split(" ")[0]}
                        </span>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600 text-xs">Unassigned</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Stage summary sidebar ──────────────────────────────────────────────────

function StageSummary({
  stageCounts,
  active,
  onPick,
}: {
  stageCounts: { stage: DealStage; count: number; value: number }[];
  active: DealStage | null;
  onPick: (s: DealStage) => void;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm h-full overflow-hidden">
      <div className="px-4 py-4 border-b border-gray-50 dark:border-gray-800">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
          <Kanban size={15} className="text-[var(--portal-commercial)]" />
          By Stage
        </h2>
      </div>
      <div className="p-2 space-y-0.5">
        {stageCounts.map((s) => {
          const style = STAGE_STYLES[s.stage];
          const isActive = active === s.stage;
          return (
            <button
              key={s.stage}
              onClick={() => onPick(s.stage)}
              className={`w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left transition-colors ${
                isActive ? "bg-[#ffd700]/10" : "hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              <span className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300 min-w-0">
                <span className={`w-2 h-2 rounded-full ${style.dot} shrink-0`} />
                <span className="truncate">{style.label}</span>
              </span>
              <span
                className={`text-xs font-semibold tabular-nums shrink-0 ${isActive ? "text-[var(--portal-commercial)]" : "text-gray-500 dark:text-gray-400"}`}
              >
                {s.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Universal campaign calendar ──────────────────────────────────────────────

function CampaignCalendar({
  events,
  onPick,
}: {
  events: CalEvent[];
  onPick: (dealId: string) => void;
}) {
  const [month, setMonth] = useState<Date>(() => startOfMonth(new Date()));

  const days = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [month]);

  const byDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const e of events) {
      const key = format(parseISO(e.date), "yyyy-MM-dd");
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    }
    return map;
  }, [events]);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
          <CalendarDays size={15} className="text-[var(--portal-commercial)]" />
          Campaign Calendar
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMonth((m) => subMonths(m, 1))}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-32 text-center">
            {format(month, "MMMM yyyy")}
          </span>
          <button
            onClick={() => setMonth((m) => addMonths(m, 1))}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-3 flex-wrap">
        {(Object.keys(EVENT_STYLES) as CalEvent["type"][]).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
            <span className={`w-2 h-2 rounded-full ${EVENT_STYLES[k].dot}`} /> {EVENT_STYLES[k].label}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayEvents = byDay.get(key) ?? [];
          const inMonth = isSameMonth(day, month);
          const today = isSameDay(day, new Date());
          return (
            <div
              key={key}
              className={`min-h-[84px] rounded-lg border p-1.5 ${
                inMonth ? "border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900" : "border-gray-50 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50"
              } ${today ? "ring-1 ring-[#ffd700]" : ""}`}
            >
              <p className={`text-[10px] font-semibold ${inMonth ? "text-gray-500 dark:text-gray-400" : "text-gray-300 dark:text-gray-600"}`}>
                {format(day, "d")}
              </p>
              <div className="space-y-1 mt-0.5">
                {dayEvents.slice(0, 4).map((ev, i) => (
                  <button
                    key={i}
                    onClick={() => onPick(ev.dealId)}
                    title={ev.label}
                    className="w-full text-[10px] leading-tight px-1.5 py-0.5 rounded bg-gray-50 dark:bg-gray-800 flex items-center gap-1 truncate hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${EVENT_STYLES[ev.type].dot} shrink-0`} />
                    <span className="truncate text-gray-600 dark:text-gray-400">{ev.dealTitle}</span>
                  </button>
                ))}
                {dayEvents.length > 4 && (
                  <p className="text-[9px] text-gray-400 dark:text-gray-500 pl-1">+{dayEvents.length - 4} more</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Recent activity ──────────────────────────────────────────────────────────

function RecentActivity({ items }: { items: ActivityItem[] }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50 dark:border-gray-800">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
          <ActivityIcon size={15} className="text-[var(--portal-commercial)]" />
          Recent Activity
        </h2>
      </div>
      {items.length === 0 ? (
        <div className="px-5 py-10 text-center text-xs text-gray-400 dark:text-gray-500">
          Deal and production updates will appear here.
        </div>
      ) : (
        <div className="divide-y divide-gray-50 dark:divide-gray-800">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/commercial/deals/${item.campaign.id}`}
              className="flex items-start gap-3 px-5 py-3 hover:bg-gray-50/60 dark:hover:bg-gray-800/60 transition-colors group"
            >
              <div className="mt-0.5 w-6 h-6 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-[var(--portal-commercial)] flex items-center justify-center shrink-0">
                {ACTIVITY_ICONS[item.type] ?? <ActivityIcon size={13} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-700 dark:text-gray-300 leading-snug group-hover:text-gray-900 dark:group-hover:text-gray-100">
                  {item.message}
                </p>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                  {item.userName ? `${item.userName} · ` : ""}
                  {formatDistanceToNow(parseISO(item.createdAt), { addSuffix: true })}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
