"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Loader2,
  TrendingUp,
  CalendarDays,
  Trophy,
  Banknote,
  ArrowUpRight,
  Kanban,
  Flame,
  Activity as ActivityIcon,
  ArrowRightLeft,
  Sparkles,
  PenLine,
  Rocket,
  PackageCheck,
} from "lucide-react";
import {
  format,
  parseISO,
  formatDistanceToNow,
  differenceInCalendarDays,
} from "date-fns";
import {
  STAGE_ORDER,
  STAGE_STYLES,
  typeStyle,
  formatMoney,
  type Deal,
  type DealStage,
} from "./_components/deal-ui";
import NewDealModal from "./_components/NewDealModal";

interface Stats {
  totalPipelineValue: number;
  dealsThisMonth: number;
  wonThisQuarter: number;
  revenueBooked: number;
  stages: { stage: DealStage; count: number; value: number }[];
  hotDeal: {
    id: string;
    title: string;
    stage: DealStage;
    value: number | null;
    type: string;
    dueDate: string | null;
    client: { id: string; name: string };
  } | null;
}

interface ActivityItem {
  id: string;
  type: string;
  message: string;
  userName: string | null;
  createdAt: string;
  campaign: {
    id: string;
    title: string;
    stage: DealStage;
    client: { id: string; name: string };
  };
}

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  created: <Sparkles size={13} />,
  stage_change: <ArrowRightLeft size={13} />,
  budget_update: <Banknote size={13} />,
  note: <PenLine size={13} />,
  deliverable: <PackageCheck size={13} />,
  project_started: <Rocket size={13} />,
};

export default function CommercialDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewDeal, setShowNewDeal] = useState(false);
  const router = useRouter();

  useEffect(() => {
    Promise.all([
      fetch("/api/commercial/stats").then((r) => r.json()),
      fetch("/api/commercial/activity").then((r) => r.json()),
    ])
      .then(([s, a]) => {
        if (s && !s.error) setStats(s);
        setActivity(a?.activities ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  const totalDeals = stats?.stages.reduce((sum, s) => sum + s.count, 0) ?? 0;

  return (
    <div className="min-h-screen bg-[#141414]">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Page header */}
        <div className="flex items-end justify-between mb-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#ffd700]">
              OutlanderOS · Commercial
            </p>
            <h1 className="mt-1 text-3xl font-semibold text-gray-900 tracking-tight">
              Deal Pipeline
            </h1>
            <p className="text-gray-500 mt-1 text-sm">
              {totalDeals} deal{totalDeals !== 1 ? "s" : ""} · live overview
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/commercial/pipeline"
              className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm"
            >
              <Kanban size={16} className="text-[#ffd700]" />
              Open Pipeline
            </Link>
            <button
              onClick={() => setShowNewDeal(true)}
              className="flex items-center gap-2 bg-[#ffd700] text-black px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-[#e6c200] transition-colors shadow-sm"
            >
              <Plus size={16} />
              New Deal
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={24} className="animate-spin text-gray-400" />
          </div>
        )}

        {!loading && (
          <>
            {/* Hot deal banner */}
            <section className="mb-6">
              <HotDealBanner hot={stats?.hotDeal ?? null} onCreate={() => setShowNewDeal(true)} />
            </section>

            {/* Stats row */}
            <section className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard
                label="Total Pipeline Value"
                value={formatMoney(stats?.totalPipelineValue ?? 0)}
                icon={<TrendingUp size={15} />}
                tone="amber"
                subtitle="active deals"
              />
              <StatCard
                label="Deals This Month"
                value={String(stats?.dealsThisMonth ?? 0)}
                icon={<CalendarDays size={15} />}
                tone="blue"
                subtitle="created"
              />
              <StatCard
                label="Won This Quarter"
                value={String(stats?.wonThisQuarter ?? 0)}
                icon={<Trophy size={15} />}
                tone="emerald"
                subtitle="contracted+"
              />
              <StatCard
                label="Revenue Booked"
                value={formatMoney(stats?.revenueBooked ?? 0)}
                icon={<Banknote size={15} />}
                tone="green"
                subtitle="contracted → paid"
              />
            </section>

            {/* Pipeline summary + activity */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
              <div className="lg:col-span-3">
                <PipelineSummary
                  stages={stats?.stages ?? []}
                  onStageClick={(stage) => router.push(`/commercial/pipeline?stage=${stage}`)}
                />
              </div>
              <div className="lg:col-span-2">
                <RecentActivity items={activity.slice(0, 10)} />
              </div>
            </div>
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

// ─── Hot deal banner ──────────────────────────────────────────────────────────

function HotDealBanner({
  hot,
  onCreate,
}: {
  hot: Stats["hotDeal"];
  onCreate: () => void;
}) {
  if (!hot) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center">
            <Flame size={20} className="text-gray-300" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-700">No active deals</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Your most urgent deal will appear here once the pipeline has deals.
            </p>
          </div>
        </div>
        <button
          onClick={onCreate}
          className="text-xs font-medium text-[#ffd700] hover:text-[#e6c200] flex items-center gap-1"
        >
          <Plus size={13} /> New deal
        </button>
      </div>
    );
  }

  const stage = STAGE_STYLES[hot.stage] ?? STAGE_STYLES.LEAD;
  const type = typeStyle(hot.type);
  const due = hot.dueDate ? parseISO(hot.dueDate) : null;
  const daysLeft = due ? differenceInCalendarDays(due, new Date()) : null;
  const deadlineLabel =
    daysLeft === null
      ? null
      : daysLeft < 0
        ? `${Math.abs(daysLeft)}d overdue`
        : daysLeft === 0
          ? "Due today"
          : `${daysLeft}d until deadline`;

  return (
    <Link href={`/commercial/deals/${hot.id}`} className="block group">
      <div className="relative overflow-hidden bg-gradient-to-br from-[#ffd700] via-[#e6c200] to-[#e6c200] text-white rounded-2xl shadow-lg p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl">
        <div className="absolute right-0 top-0 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex items-start justify-between gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/90">
                Hot Deal — Most Urgent
              </span>
              {deadlineLabel && (
                <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white backdrop-blur-sm">
                  {deadlineLabel}
                </span>
              )}
            </div>
            <h2 className="text-2xl font-bold tracking-tight truncate">{hot.title}</h2>
            <p className="text-sm text-white/70 mt-0.5 truncate">{hot.client.name}</p>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 text-sm">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/20 text-white backdrop-blur-sm">
                {stage.label}
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/20 text-white backdrop-blur-sm">
                {type.label}
              </span>
              <span className="flex items-center gap-1.5 text-white/90 font-semibold">
                {formatMoney(hot.value)}
              </span>
              {due && (
                <span className="flex items-center gap-1.5 text-white/90">
                  <CalendarDays size={14} className="text-white/70" />
                  {format(due, "EEE d MMM yyyy")}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end shrink-0">
            <div className="flex items-center gap-1 text-xs text-white/80 group-hover:text-white transition-colors">
              Open deal
              <ArrowUpRight size={14} />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
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
  tone: "amber" | "emerald" | "blue" | "green";
  subtitle?: string;
}) {
  const TONE: Record<typeof tone, { bg: string; fg: string }> = {
    amber: { bg: "bg-amber-50", fg: "text-[#ffd700]" },
    emerald: { bg: "bg-emerald-50", fg: "text-emerald-600" },
    blue: { bg: "bg-blue-50", fg: "text-blue-600" },
    green: { bg: "bg-green-50", fg: "text-green-600" },
  };
  const t = TONE[tone];
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-gray-500">{label}</p>
        <div className={`w-7 h-7 rounded-lg ${t.bg} ${t.fg} flex items-center justify-center`}>
          {icon}
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <p className="text-2xl font-semibold text-gray-900 tracking-tight">{value}</p>
        {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
      </div>
    </div>
  );
}

// ─── Pipeline summary ─────────────────────────────────────────────────────────

function PipelineSummary({
  stages,
  onStageClick,
}: {
  stages: { stage: DealStage; count: number; value: number }[];
  onStageClick: (stage: DealStage) => void;
}) {
  const maxValue = Math.max(1, ...stages.map((s) => s.value));
  const empty = stages.every((s) => s.count === 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm h-full overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <Kanban size={15} className="text-[#ffd700]" />
          Pipeline Summary
        </h2>
        <Link
          href="/commercial/pipeline"
          className="text-xs font-medium text-[#ffd700] hover:text-[#e6c200] flex items-center gap-1"
        >
          Open board <ArrowUpRight size={12} />
        </Link>
      </div>

      {empty ? (
        <div className="px-5 py-12 text-center">
          <p className="text-sm text-gray-500 font-medium">No deals in the pipeline yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Create your first deal and it will show up across these stages.
          </p>
        </div>
      ) : (
        <div className="px-5 py-4 space-y-2.5">
          {STAGE_ORDER.map((stage) => {
            const s = stages.find((x) => x.stage === stage) ?? { stage, count: 0, value: 0 };
            const style = STAGE_STYLES[stage];
            const pct = s.value > 0 ? Math.max(4, (s.value / maxValue) * 100) : 0;
            return (
              <button
                key={stage}
                onClick={() => onStageClick(stage)}
                className="w-full text-left group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-2 text-xs font-medium text-gray-700 group-hover:text-gray-900">
                    <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                    {style.label}
                    <span className="text-gray-400 font-normal">
                      {s.count} deal{s.count !== 1 ? "s" : ""}
                    </span>
                  </span>
                  <span className="text-xs font-semibold text-gray-800 tabular-nums">
                    {formatMoney(s.value)}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${style.bar} transition-all duration-300 group-hover:opacity-80`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Recent activity ──────────────────────────────────────────────────────────

function RecentActivity({ items }: { items: ActivityItem[] }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm h-full overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50">
        <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <ActivityIcon size={15} className="text-[#ffd700]" />
          Recent Activity
        </h2>
      </div>
      {items.length === 0 ? (
        <div className="px-5 py-10 text-center text-xs text-gray-400">
          Deal updates will appear here.
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/commercial/deals/${item.campaign.id}`}
              className="flex items-start gap-3 px-5 py-3 hover:bg-gray-50/60 transition-colors group"
            >
              <div className="mt-0.5 w-6 h-6 rounded-lg bg-amber-50 text-[#ffd700] flex items-center justify-center shrink-0">
                {ACTIVITY_ICONS[item.type] ?? <ActivityIcon size={13} />}
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-700 leading-snug group-hover:text-gray-900">
                  {item.message}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
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
