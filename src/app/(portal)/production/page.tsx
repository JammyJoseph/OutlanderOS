"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Film,
  Plus,
  Calendar as CalendarIcon,
  ClipboardList,
  ChevronRight,
  ChevronLeft,
  X,
  Loader2,
  MapPin,
  Users,
  Sparkles,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import {
  format,
  parseISO,
  isFuture,
  isToday,
  isTomorrow,
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
  addDays,
  isBefore,
  isAfter,
  startOfDay,
} from "date-fns";

type ProductionStatus =
  | "DRAFT"
  | "BRIEFED"
  | "PRE_PRODUCTION"
  | "SHOOTING"
  | "POST_PRODUCTION"
  | "DELIVERED"
  | "ARCHIVED";

type CallSheetStatus = "DRAFT" | "SAVED" | "PUBLISHED";

const STATUS_STYLES: Record<
  ProductionStatus,
  { bg: string; text: string; dot: string; label: string }
> = {
  DRAFT: { bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400", label: "Planning" },
  BRIEFED: { bg: "bg-blue-100", text: "text-blue-700", dot: "bg-blue-400", label: "Briefed" },
  PRE_PRODUCTION: {
    bg: "bg-purple-100",
    text: "text-purple-700",
    dot: "bg-purple-400",
    label: "Pre-Production",
  },
  SHOOTING: {
    bg: "bg-amber-100",
    text: "text-amber-700",
    dot: "bg-[#D4A853]",
    label: "Shooting",
  },
  POST_PRODUCTION: {
    bg: "bg-orange-100",
    text: "text-orange-700",
    dot: "bg-orange-400",
    label: "Wrap",
  },
  DELIVERED: {
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    dot: "bg-emerald-400",
    label: "Complete",
  },
  ARCHIVED: { bg: "bg-gray-100", text: "text-gray-400", dot: "bg-gray-300", label: "Archived" },
};

const STATUS_OPTIONS: ProductionStatus[] = [
  "DRAFT",
  "PRE_PRODUCTION",
  "SHOOTING",
  "POST_PRODUCTION",
  "DELIVERED",
];

interface CallSheetSummary {
  id: string;
  shootDate: string;
  status?: CallSheetStatus;
  callTime?: string | null;
  location?: { address?: string } | null;
}

interface Production {
  id: string;
  title: string;
  brief: string | null;
  description?: string | null;
  figmaUrl?: string | null;
  clientName?: string | null;
  status: ProductionStatus;
  budgetTotal?: number | null;
  shootDates: string[];
  campaign: { title: string; client: { name: string } } | null;
  crew: { id: string; role?: string }[];
  callSheets: CallSheetSummary[];
  createdAt?: string;
  updatedAt?: string;
}

function getClientName(p: Production): string | null {
  return p.clientName || p.campaign?.client?.name || null;
}

function getAllShootDates(p: Production): Date[] {
  const dates = [
    ...(p.callSheets ?? []).map((cs) => parseISO(cs.shootDate)),
    ...(p.shootDates ?? []).map((d) => parseISO(d)),
  ];
  // Dedupe by day
  const seen = new Set<string>();
  return dates.filter((d) => {
    const key = format(d, "yyyy-MM-dd");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getNextShoot(p: Production): { date: Date; callSheet?: CallSheetSummary } | null {
  const today = startOfDay(new Date());
  const future = (p.callSheets ?? [])
    .map((cs) => ({ cs, date: parseISO(cs.shootDate) }))
    .filter((x) => !isBefore(x.date, today));
  const fromDates = (p.shootDates ?? [])
    .map((d) => ({ date: parseISO(d) }))
    .filter((x) => !isBefore(x.date, today));
  const all: { date: Date; callSheet?: CallSheetSummary }[] = [
    ...future.map((x) => ({ date: x.date, callSheet: x.cs })),
    ...fromDates,
  ];
  if (!all.length) return null;
  all.sort((a, b) => a.date.getTime() - b.date.getTime());
  return all[0];
}

function countdownLabel(date: Date): string {
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  const days = differenceInCalendarDays(date, new Date());
  if (days < 0) return `${Math.abs(days)}d ago`;
  return `in ${days} day${days !== 1 ? "s" : ""}`;
}

function countdownTone(date: Date): { bg: string; text: string } {
  if (isToday(date)) return { bg: "bg-[#D4A853]", text: "text-white" };
  if (isTomorrow(date)) return { bg: "bg-amber-100", text: "text-amber-800" };
  const days = differenceInCalendarDays(date, new Date());
  if (days <= 7) return { bg: "bg-amber-50", text: "text-amber-700" };
  return { bg: "bg-gray-100", text: "text-gray-600" };
}

export default function ProductionDashboard() {
  const [productions, setProductions] = useState<Production[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    fetch("/api/productions")
      .then((r) => r.json())
      .then((d) => setProductions(d.productions ?? []))
      .finally(() => setLoading(false));
  }, []);

  const today = startOfDay(new Date());

  // Hot seat — next upcoming shoot across all productions
  const hotSeat = useMemo(() => {
    type Hot = { production: Production; date: Date; callSheet?: CallSheetSummary };
    const all: Hot[] = [];
    for (const p of productions ?? []) {
      const next = getNextShoot(p);
      if (next) all.push({ production: p, date: next.date, callSheet: next.callSheet });
    }
    if (!all.length) return null;
    all.sort((a, b) => a.date.getTime() - b.date.getTime());
    return all[0];
  }, [productions]);

  // Dashboard stats
  const stats = useMemo(() => {
    const list = productions ?? [];
    const active = list.filter(
      (p) => !["DELIVERED", "ARCHIVED"].includes(p.status)
    ).length;
    const horizon = addDays(today, 30);
    let upcoming = 0;
    let drafts = 0;
    for (const p of list) {
      for (const cs of p.callSheets ?? []) {
        const d = parseISO(cs.shootDate);
        if (!isBefore(d, today) && isBefore(d, horizon)) upcoming += 1;
        if (cs.status === "DRAFT") drafts += 1;
      }
      for (const d of p.shootDates ?? []) {
        const dd = parseISO(d);
        if (!isBefore(dd, today) && isBefore(dd, horizon)) upcoming += 1;
      }
    }
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);
    const completed = list.filter((p) => {
      if (!["DELIVERED", "ARCHIVED"].includes(p.status)) return false;
      const u = p.updatedAt ? parseISO(p.updatedAt) : null;
      return u ? !isBefore(u, monthStart) && !isAfter(u, monthEnd) : false;
    }).length;
    return { active, upcoming, drafts, completed };
  }, [productions, today]);

  // Calendar shoot data — list of {date, productions}
  const calendarShoots = useMemo(() => {
    const map = new Map<string, { date: Date; entries: { production: Production; cs?: CallSheetSummary }[] }>();
    for (const p of productions ?? []) {
      for (const cs of p.callSheets ?? []) {
        const d = parseISO(cs.shootDate);
        const key = format(d, "yyyy-MM-dd");
        if (!map.has(key)) map.set(key, { date: d, entries: [] });
        map.get(key)!.entries.push({ production: p, cs });
      }
      for (const sd of p.shootDates ?? []) {
        const d = parseISO(sd);
        const key = format(d, "yyyy-MM-dd");
        if (!map.has(key)) map.set(key, { date: d, entries: [] });
        // avoid double-add if already represented by call sheet on same day
        const exists = map.get(key)!.entries.some(
          (e) => e.production.id === p.id
        );
        if (!exists) map.get(key)!.entries.push({ production: p });
      }
    }
    return map;
  }, [productions]);

  const list = productions ?? [];
  const active = list.filter((p) => !["DELIVERED", "ARCHIVED"].includes(p.status));
  const archived = list.filter((p) => ["DELIVERED", "ARCHIVED"].includes(p.status));

  return (
    <div className="min-h-screen bg-[#F9F9F7]">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Page header */}
        <div className="flex items-end justify-between mb-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#E24B4A]">
              OutlanderOS · Production
            </p>
            <h1 className="mt-1 text-3xl font-semibold text-gray-900 tracking-tight">
              Production Studio
            </h1>
            <p className="text-gray-500 mt-1 text-sm">
              {list.length} project{list.length !== 1 ? "s" : ""} · live overview
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-[#D4A853] text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-[#c49843] transition-colors shadow-sm"
          >
            <Plus size={16} />
            New Editorial Project
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={24} className="animate-spin text-gray-400" />
          </div>
        )}

        {!loading && (
          <>
            {/* Hot seat */}
            <section className="mb-6">
              <HotSeatBanner hot={hotSeat} onCreate={() => setShowCreate(true)} />
            </section>

            {/* Stats */}
            <section className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard
                label="Active Projects"
                value={stats.active}
                icon={<Film size={15} />}
                tone="amber"
              />
              <StatCard
                label="Upcoming Shoots"
                value={stats.upcoming}
                icon={<CalendarIcon size={15} />}
                tone="emerald"
                subtitle="next 30 days"
              />
              <StatCard
                label="Draft Call Sheets"
                value={stats.drafts}
                icon={<AlertCircle size={15} />}
                tone="orange"
                subtitle={stats.drafts > 0 ? "needs attention" : "all sorted"}
              />
              <StatCard
                label="Completed"
                value={stats.completed}
                icon={<CheckCircle2 size={15} />}
                tone="blue"
                subtitle="this month"
              />
            </section>

            {/* Calendar + projects */}
            <div id="calendar" className="grid grid-cols-1 lg:grid-cols-5 gap-5 mb-8">
              <div className="lg:col-span-3">
                <OverviewCalendar shootMap={calendarShoots} />
              </div>
              <div className="lg:col-span-2">
                <UpcomingList productions={list} />
              </div>
            </div>

            {/* Projects */}
            <section id="projects">
              {list.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mb-4">
                    <Film size={28} className="text-[#D4A853]" />
                  </div>
                  <h2 className="text-lg font-semibold text-gray-800 mb-1">No projects yet</h2>
                  <p className="text-gray-500 text-sm mb-6 max-w-sm">
                    Productions you create will land here with their shoot dates, call sheets, and crew.
                  </p>
                  <button
                    onClick={() => setShowCreate(true)}
                    className="flex items-center gap-2 bg-[#D4A853] text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-[#c49843] transition-colors"
                  >
                    <Plus size={16} />
                    Create your first project
                  </button>
                </div>
              ) : (
                <>
                  {active.length > 0 && (
                    <div className="mb-8">
                      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
                        Active — {active.length}
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {active.map((p) => (
                          <ProjectCard key={p.id} production={p} />
                        ))}
                      </div>
                    </div>
                  )}

                  {archived.length > 0 && (
                    <div>
                      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
                        Completed — {archived.length}
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {archived.map((p) => (
                          <ProjectCard key={p.id} production={p} />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>
          </>
        )}
      </div>

      {showCreate && (
        <CreateProjectModal
          onClose={() => setShowCreate(false)}
          onCreated={(p) => {
            setProductions((prev) => [p, ...prev]);
            setShowCreate(false);
          }}
        />
      )}
    </div>
  );
}

// ─── Hot seat banner ──────────────────────────────────────────────────────────

function HotSeatBanner({
  hot,
  onCreate,
}: {
  hot: { production: Production; date: Date; callSheet?: CallSheetSummary } | null;
  onCreate: () => void;
}) {
  if (!hot) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center">
            <Sparkles size={20} className="text-gray-300" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-700">No upcoming shoots</p>
            <p className="text-xs text-gray-400 mt-0.5">
              When you schedule a shoot it will appear here.
            </p>
          </div>
        </div>
        <button
          onClick={onCreate}
          className="text-xs font-medium text-[#D4A853] hover:text-[#c49843] flex items-center gap-1"
        >
          <Plus size={13} /> New project
        </button>
      </div>
    );
  }

  const client = getClientName(hot.production);
  const callTime = hot.callSheet?.callTime;
  const locationAddr = (hot.callSheet?.location as { address?: string } | undefined)?.address;
  const crewCount = hot.production.crew?.length ?? 0;

  return (
    <Link
      href={`/production/${hot.production.id}${hot.callSheet ? `/call-sheets/${hot.callSheet.id}` : ""}`}
      className="block group"
    >
      <div className="relative overflow-hidden bg-gradient-to-br from-[#E24B4A] via-[#D03B3A] to-[#A82E2D] text-white rounded-2xl shadow-lg p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl">
        {/* Decorative gradient */}
        <div className="absolute right-0 top-0 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex items-start justify-between gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/90">
                Hot Seat — Next Shoot
              </span>
              <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white backdrop-blur-sm">
                {countdownLabel(hot.date)}
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight truncate">
              {hot.production.title}
            </h2>
            {client && (
              <p className="text-sm text-white/70 mt-0.5 truncate">{client}</p>
            )}

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 text-sm">
              <span className="flex items-center gap-1.5 text-white/90">
                <CalendarIcon size={14} className="text-white/70" />
                {format(hot.date, "EEE d MMM yyyy")}
              </span>
              {callTime && (
                <span className="flex items-center gap-1.5 text-white/90">
                  <Clock size={14} className="text-white/70" />
                  {callTime} call
                </span>
              )}
              {locationAddr && (
                <span className="flex items-center gap-1.5 text-white/90 max-w-xs truncate">
                  <MapPin size={14} className="text-white/70" />
                  <span className="truncate">{locationAddr}</span>
                </span>
              )}
              {crewCount > 0 && (
                <span className="flex items-center gap-1.5 text-white/90">
                  <Users size={14} className="text-white/70" />
                  {crewCount} crew
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end shrink-0">
            <div className="flex items-center gap-1 text-xs text-white/80 group-hover:text-white transition-colors">
              Open project
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
  value: number;
  icon: React.ReactNode;
  tone: "amber" | "emerald" | "blue" | "orange";
  subtitle?: string;
}) {
  const TONE: Record<typeof tone, { bg: string; fg: string }> = {
    amber: { bg: "bg-amber-50", fg: "text-[#D4A853]" },
    emerald: { bg: "bg-emerald-50", fg: "text-emerald-600" },
    blue: { bg: "bg-blue-50", fg: "text-blue-600" },
    orange: { bg: "bg-orange-50", fg: "text-orange-600" },
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
        <p className="text-3xl font-semibold text-gray-900 tracking-tight">{value}</p>
        {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
      </div>
    </div>
  );
}

// ─── Overview Calendar ────────────────────────────────────────────────────────

function OverviewCalendar({
  shootMap,
}: {
  shootMap: Map<
    string,
    { date: Date; entries: { production: Production; cs?: CallSheetSummary }[] }
  >;
}) {
  const [month, setMonth] = useState(new Date());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });
  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const today = new Date();

  const selected = selectedKey ? shootMap.get(selectedKey) : null;

  return (
    <div id="overview" className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarIcon size={15} className="text-[#D4A853]" />
          <h2 className="text-sm font-semibold text-gray-800">
            {format(month, "MMMM yyyy")}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMonth(new Date())}
            className="text-xs font-medium text-gray-500 hover:text-gray-800 px-2 py-1 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => setMonth((m) => subMonths(m, 1))}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
            aria-label="Previous month"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            onClick={() => setMonth((m) => addMonths(m, 1))}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
            aria-label="Next month"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      <div className="px-5 pt-3 pb-2">
        <div className="grid grid-cols-7 mb-1">
          {dayLabels.map((d) => (
            <div
              key={d}
              className="text-center text-[10px] font-semibold text-gray-400 py-1 uppercase tracking-wide"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-1">
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const has = shootMap.get(key);
            const inMonth = isSameMonth(day, month);
            const isCurrentDay = isSameDay(day, today);
            const isSelected = selectedKey === key;
            return (
              <button
                key={key}
                onClick={() => has && setSelectedKey(isSelected ? null : key)}
                className={`group flex flex-col items-center justify-start min-h-[58px] rounded-lg py-1.5 transition-all duration-150 ${
                  has ? "cursor-pointer" : "cursor-default"
                } ${
                  isSelected
                    ? "bg-amber-50/80 ring-1 ring-[#D4A853]/30"
                    : has
                    ? "hover:bg-gray-50"
                    : ""
                }`}
              >
                <span
                  className={`text-xs font-semibold leading-none ${
                    !inMonth
                      ? "text-gray-300"
                      : isCurrentDay
                      ? "text-[#D4A853]"
                      : "text-gray-700"
                  }`}
                >
                  {format(day, "d")}
                </span>
                {has && inMonth && (
                  <div className="mt-1.5 flex flex-col items-center gap-0.5 w-full px-1">
                    {has.entries.slice(0, 2).map((e, i) => (
                      <span
                        key={i}
                        className="block w-full text-[9px] font-medium text-amber-800 bg-amber-100 rounded px-1 py-0.5 truncate text-center"
                        title={e.production.title}
                      >
                        {e.production.title}
                      </span>
                    ))}
                    {has.entries.length > 2 && (
                      <span className="text-[9px] font-medium text-gray-500">
                        +{has.entries.length - 2}
                      </span>
                    )}
                  </div>
                )}
                {has && inMonth && has.entries.length === 0 && (
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[#D4A853]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {selected && (
        <div className="px-5 py-4 border-t border-gray-50 bg-gray-50/50">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            {format(selected.date, "EEEE d MMMM")}
          </p>
          <div className="space-y-1.5">
            {selected.entries.map((e, i) => (
              <Link
                key={i}
                href={
                  e.cs
                    ? `/production/${e.production.id}/call-sheets/${e.cs.id}`
                    : `/production/${e.production.id}`
                }
                className="flex items-center justify-between text-sm bg-white rounded-lg px-3 py-2 hover:bg-amber-50/50 transition-colors group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Film size={13} className="text-[#D4A853] shrink-0" />
                  <span className="font-medium text-gray-800 truncate">
                    {e.production.title}
                  </span>
                  {getClientName(e.production) && (
                    <span className="text-xs text-gray-400 truncate">
                      · {getClientName(e.production)}
                    </span>
                  )}
                </div>
                <ChevronRight
                  size={13}
                  className="text-gray-300 group-hover:text-[#D4A853] transition-colors shrink-0"
                />
              </Link>
            ))}
          </div>
        </div>
      )}

      {!selected && shootMap.size === 0 && (
        <div className="px-5 py-6 border-t border-gray-50 text-center text-xs text-gray-400">
          No shoots scheduled yet — add shoot dates to a project to see them here.
        </div>
      )}
    </div>
  );
}

// ─── Upcoming list ─────────────────────────────────────────────────────────────

function UpcomingList({ productions }: { productions: Production[] }) {
  type Up = { production: Production; date: Date; cs?: CallSheetSummary };
  const today = startOfDay(new Date());
  const items: Up[] = [];
  for (const p of productions ?? []) {
    for (const cs of p.callSheets ?? []) {
      const d = parseISO(cs.shootDate);
      if (!isBefore(d, today)) items.push({ production: p, date: d, cs });
    }
    for (const sd of p.shootDates ?? []) {
      const d = parseISO(sd);
      if (!isBefore(d, today)) {
        const exists = items.some(
          (it) => it.production.id === p.id && isSameDay(it.date, d)
        );
        if (!exists) items.push({ production: p, date: d });
      }
    }
  }
  items.sort((a, b) => a.date.getTime() - b.date.getTime());
  const top = items.slice(0, 6);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm h-full overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50">
        <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <Clock size={15} className="text-[#D4A853]" />
          Upcoming
        </h2>
      </div>
      {top.length === 0 ? (
        <div className="px-5 py-10 text-center text-xs text-gray-400">
          No upcoming shoots
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {top.map((it, i) => {
            const tone = countdownTone(it.date);
            return (
              <Link
                key={i}
                href={
                  it.cs
                    ? `/production/${it.production.id}/call-sheets/${it.cs.id}`
                    : `/production/${it.production.id}`
                }
                className="flex items-center justify-between px-5 py-3 hover:bg-gray-50/60 transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="text-center w-10 shrink-0">
                    <div className="text-[9px] font-bold text-[#D4A853] uppercase leading-none">
                      {format(it.date, "MMM")}
                    </div>
                    <div className="text-base font-bold text-gray-800 leading-tight mt-0.5">
                      {format(it.date, "d")}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate group-hover:text-[#D4A853] transition-colors">
                      {it.production.title}
                    </p>
                    <p className="text-[11px] text-gray-400 truncate">
                      {getClientName(it.production) || "—"}
                      {it.cs?.callTime ? ` · ${it.cs.callTime}` : ""}
                    </p>
                  </div>
                </div>
                <span
                  className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${tone.bg} ${tone.text}`}
                >
                  {countdownLabel(it.date)}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Project card ──────────────────────────────────────────────────────────────

function ProjectCard({ production: p }: { production: Production }) {
  const next = getNextShoot(p);
  const style = STATUS_STYLES[p.status] || STATUS_STYLES.DRAFT;
  const client = getClientName(p);
  const sheetCount = (p.callSheets ?? []).length;
  const crewCount = (p.crew ?? []).length;

  // Progress: based on status order
  const statusIdx: Record<ProductionStatus, number> = {
    DRAFT: 0,
    BRIEFED: 1,
    PRE_PRODUCTION: 2,
    SHOOTING: 3,
    POST_PRODUCTION: 4,
    DELIVERED: 5,
    ARCHIVED: 5,
  };
  const progress = (statusIdx[p.status] / 5) * 100;

  return (
    <Link href={`/production/${p.id}`}>
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 p-5 group cursor-pointer h-full flex flex-col">
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 bg-[#E24B4A]/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <Film size={18} className="text-[#E24B4A]" />
          </div>
          <span
            className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full ${style.bg} ${style.text}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
            {style.label}
          </span>
        </div>

        <div className="flex-1 mb-3">
          <h3 className="font-semibold text-gray-900 text-base leading-snug group-hover:text-[#D4A853] transition-colors line-clamp-2">
            {p.title}
          </h3>
          {client && (
            <p className="text-gray-500 text-sm mt-0.5 truncate">{client}</p>
          )}
        </div>

        {/* Progress */}
        <div className="mb-3">
          <div className="h-1 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full bg-[#D4A853] rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1" title="Call sheets">
              <ClipboardList size={12} />
              {sheetCount}
            </span>
            <span className="flex items-center gap-1" title="Crew">
              <Users size={12} />
              {crewCount}
            </span>
          </div>
          {next ? (
            <span className="flex items-center gap-1 text-gray-700 font-medium">
              <CalendarIcon size={12} className="text-[#D4A853]" />
              {format(next.date, "d MMM")}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-gray-400">
              <CalendarIcon size={12} />
              No date
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

// ─── Create project modal ────────────────────────────────────────────────────

function CreateProjectModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (p: Production) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [client, setClient] = useState("");
  const [description, setDescription] = useState("");
  const [shootDates, setShootDates] = useState<string[]>([""]);
  const [status, setStatus] = useState<ProductionStatus>("DRAFT");
  const [figmaUrl, setFigmaUrl] = useState("");
  const [budget, setBudget] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    try {
      const dates = shootDates.filter(Boolean);
      const res = await fetch("/api/productions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          clientName: client.trim() || null,
          description: description.trim() || null,
          shootDates: dates,
          status,
          figmaUrl: figmaUrl.trim() || null,
          budgetTotal: budget ? Number(budget) : null,
          type: "EDITORIAL",
        }),
      });
      const data = await res.json();
      if (data.production) {
        onCreated(data.production);
      }
    } finally {
      setCreating(false);
    }
  }

  function updateDate(i: number, value: string) {
    setShootDates((prev) => {
      const next = [...prev];
      next[i] = value;
      return next;
    });
  }

  function addDate() {
    setShootDates((prev) => [...prev, ""]);
  }

  function removeDate(i: number) {
    setShootDates((prev) => prev.filter((_, j) => j !== i));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-50 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-lg font-semibold text-gray-900">New Project</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleCreate} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
              Project Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Summer Campaign 2026"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853]"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
              Client
            </label>
            <input
              type="text"
              value={client}
              onChange={(e) => setClient(e.target.value)}
              placeholder="e.g. Aston Martin"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Concept, deliverables, anything worth remembering…"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
              Shoot Dates
            </label>
            <div className="space-y-2">
              {(shootDates ?? []).map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="date"
                    value={d}
                    onChange={(e) => updateDate(i, e.target.value)}
                    className="flex-1 px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853]"
                  />
                  {shootDates.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeDate(i)}
                      className="p-2 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addDate}
                className="flex items-center gap-1.5 text-xs font-medium text-[#D4A853] hover:text-[#c49843] transition-colors"
              >
                <Plus size={13} /> Add another date
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ProductionStatus)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853] bg-white"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_STYLES[s].label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                Budget (£)
              </label>
              <input
                type="number"
                min="0"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="0"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853]"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
              Figma Link
            </label>
            <input
              type="url"
              value={figmaUrl}
              onChange={(e) => setFigmaUrl(e.target.value)}
              placeholder="https://figma.com/file/…"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853]"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || creating}
              className="flex-1 flex items-center justify-center gap-2 bg-[#D4A853] text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-[#c49843] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? <Loader2 size={15} className="animate-spin" /> : null}
              Create Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
