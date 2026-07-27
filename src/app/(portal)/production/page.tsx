"use client";

import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useConfirm } from "@/components/ui/confirm-provider";
import {
  Film,
  Plus,
  Calendar as CalendarIcon,
  X,
  Loader2,
  Sparkles,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  Archive,
  ArchiveRestore,
  Search,
} from "lucide-react";
import Link from "next/link";
import { STRANDS, strandOf, strandIsDerived, type Strand } from "@/lib/production-strand";
import { useSearchParams, useRouter } from "next/navigation";
import { isValidUrl } from "@/lib/validation";
import {
  format,
  parseISO,
  isToday,
  isTomorrow,
  differenceInCalendarDays,
  startOfMonth,
  endOfMonth,
  isSameDay,
  addDays,
  isBefore,
  isAfter,
  startOfDay,
} from "date-fns";
import DashboardCalendar from "./_components/DashboardCalendar";

type ProductionStatus =
  | "DRAFT"
  | "BRIEFED"
  | "PRE_PRODUCTION"
  | "SHOOTING"
  | "POST_PRODUCTION"
  | "DELIVERED"
  | "ARCHIVED";

type CallSheetStatus = "DRAFT" | "SAVED" | "PUBLISHED";

// Creative-brief deals in flight before they're cleared for production.
interface CreativeDeal {
  id: string;
  title: string;
  stage: string;
  clientName: string | null;
  assignedTo: string | null;
  creativeStatus: string | null;
  sentToCreativeAt: string | null;
  figmaUrl: string | null;
  briefExcerpt: string;
  updatedAt: string;
}

const CREATIVE_STATUS_META: Record<string, { label: string; cls: string }> = {
  AWAITING_RESPONSE: { label: "Awaiting Response", cls: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300" },
  RESPONSE_SENT: { label: "Response Sent", cls: "bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300" },
  IN_REVIEW: { label: "In Review", cls: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" },
  REVISIONS_REQUESTED: { label: "Revisions Requested", cls: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300" },
  APPROVED: { label: "Creative Approved", cls: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300" },
};

const STATUS_STYLES: Record<
  ProductionStatus,
  { bg: string; text: string; dot: string; label: string }
> = {
  DRAFT: { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-600 dark:text-gray-400", dot: "bg-gray-400", label: "Planning" },
  BRIEFED: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300", dot: "bg-blue-400", label: "Briefed" },
  PRE_PRODUCTION: {
    bg: "bg-purple-100 dark:bg-purple-900/30",
    text: "text-purple-700 dark:text-purple-300",
    dot: "bg-purple-400",
    label: "Pre-Production",
  },
  SHOOTING: {
    bg: "bg-amber-100 dark:bg-amber-900/30",
    text: "text-amber-700 dark:text-amber-300",
    dot: "bg-[#9C7C2E]",
    label: "Shooting",
  },
  POST_PRODUCTION: {
    bg: "bg-orange-100 dark:bg-orange-900/30",
    text: "text-orange-700 dark:text-orange-300",
    dot: "bg-orange-400",
    label: "Post-Production",
  },
  DELIVERED: {
    bg: "bg-emerald-100 dark:bg-emerald-900/30",
    text: "text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-400",
    label: "Complete",
  },
  ARCHIVED: { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-400 dark:text-gray-500", dot: "bg-gray-300 dark:bg-gray-600", label: "Archived" },
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
  shootTitle?: string | null;
}

// Roll a production's call sheets up to one chip: any published sheet wins,
// otherwise any sheet at all counts as a draft in progress.

interface Production {
  id: string;
  title: string;
  brief: string | null;
  description?: string | null;
  figmaUrl?: string | null;
  clientName?: string | null;
  status: ProductionStatus;
  type?: string | null;
  billingType?: string | null;
  strand?: string | null;
  budgetTotal?: number | null;
  budgetedTotal?: number;
  actualTotal?: number;
  inIssueBudget?: boolean;
  campaignId?: string | null;
  lead?: { id: string; name: string } | null;
  archived?: boolean;
  archivedAt?: string | null;
  shootDates: string[];
  campaign: { title: string; client: { name: string } } | null;
  crew: { id: string; role?: string }[];
  callSheets: CallSheetSummary[];
  milestones?: {
    id: string;
    phase: string;
    date: string;
    title: string;
    done: boolean;
    isMilestone: boolean;
  }[];
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
  if (isToday(date)) return { bg: "bg-[#111111] dark:bg-white", text: "text-white dark:text-black" };
  if (isTomorrow(date)) return { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-800 dark:text-amber-300" };
  const days = differenceInCalendarDays(date, new Date());
  if (days <= 7) return { bg: "bg-amber-50 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-300" };
  return { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-600 dark:text-gray-400" };
}

// The Production portal is a single route (/production) that swaps its main
// content off the `view` query param, driven by the sidebar:
//   • (none)          → Overview dashboard (includes the calendar)
//   • ?view=projects  → projects grouped by client
// useSearchParams() requires a Suspense boundary, hence the thin wrapper.
export default function ProductionPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ProductionInner />
    </Suspense>
  );
}

function PageLoading() {
  return (
    <div className="min-h-screen bg-card">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-center py-24">
          <Loader2 size={24} className="animate-spin text-gray-400 dark:text-gray-500" />
        </div>
      </div>
    </div>
  );
}

function ProductionInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const view = searchParams.get("view"); // null → overview | "projects"
  const isOverview = view !== "projects";

  const [allProductions, setAllProductions] = useState<Production[]>([]);
  const [creativeDeals, setCreativeDeals] = useState<CreativeDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const loadProductions = useCallback(async () => {
    try {
      const r = await fetch("/api/productions?includeArchived=true");
      if (r.status === 401) {
        router.push("/login");
        return;
      }
      if (!r.ok) throw new Error(`GET /api/productions → ${r.status}`);
      const d = await r.json();
      setAllProductions(d.productions ?? []);
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    // Always pull archived rows: the Projects list has its own Archived filter
    // tab, and the Overview reveals them behind a toggle — no refetch needed.
    //
    // A failed load must never fall through to an empty array: rendering "0
    // projects" for what is really an expired session or a 500 makes healthy
    // data look permanently deleted.
    void loadProductions();
  }, [loadProductions]);

  useEffect(() => {
    fetch("/api/production/creative-pipeline")
      .then((r) => r.json())
      .then((d) => setCreativeDeals(d.deals ?? []))
      .catch(() => {});
  }, []);

  // Everything except the dedicated archived section works off live projects.
  const productions = useMemo(
    () => allProductions.filter((p) => !p.archived),
    [allProductions]
  );
  const archivedProjects = useMemo(
    () => allProductions.filter((p) => p.archived),
    [allProductions]
  );

  // Quick-complete a milestone/task from the calendar. Optimistic local update,
  // then persist. On failure the next dashboard load re-syncs.
  async function toggleMilestoneDone(
    productionId: string,
    milestoneId: string,
    done: boolean
  ) {
    setAllProductions((prev) =>
      prev.map((p) =>
        p.id === productionId
          ? {
              ...p,
              milestones: (p.milestones ?? []).map((m) =>
                m.id === milestoneId ? { ...m, done } : m
              ),
            }
          : p
      )
    );
    try {
      await fetch(
        `/api/productions/${productionId}/milestones?milestoneId=${milestoneId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ done }),
        }
      );
    } catch {
      // ignore — optimistic; refetch on next mount corrects any drift
    }
  }

  const subtitle = view === "projects" ? "all projects" : "live overview";

  return (
    <div className="min-h-screen bg-card">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Page header */}
        <div className="flex items-end justify-between mb-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#A93B2E]">
              OutlanderOS · Production
            </p>
            <h1 className="mt-1 text-3xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
              Production Studio
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
              {productions.length} project{productions.length !== 1 ? "s" : ""} · {subtitle}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isOverview && (
              <button
                onClick={() => setShowArchived((v) => !v)}
                className={`flex items-center gap-1.5 rounded-xl border bg-white dark:bg-gray-900 px-3 py-2.5 text-sm transition-colors ${
                  showArchived
                    ? "border-gray-400 dark:border-gray-500 text-gray-700 dark:text-gray-300 font-medium"
                    : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400"
                }`}
                title={showArchived ? "Hide archived projects" : "Show archived projects"}
              >
                <Archive size={14} className="text-gray-400 dark:text-gray-500" />
                {showArchived ? "Showing archived" : "Archived"}
              </button>
            )}
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 bg-[#111111] dark:bg-white text-white dark:text-black px-4 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-colors shadow-sm"
            >
              <Plus size={16} />
              New Project
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={24} className="animate-spin text-gray-400 dark:text-gray-500" />
          </div>
        )}

        {/* Load failure — explicitly *not* an empty state. */}
        {!loading && loadFailed && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-6 text-center">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Couldn&apos;t load projects
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Your projects are safe — this is a loading problem, not missing data.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 rounded-xl bg-[#111111] dark:bg-white px-4 py-2 text-sm font-medium text-white dark:text-black hover:opacity-90"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !loadFailed && view === "projects" && (
          <ProjectsListView productions={allProductions} onChanged={loadProductions} />
        )}

        {!loading && !loadFailed && isOverview && (
          <OverviewView
            productions={productions}
            archivedProjects={archivedProjects}
            creativeDeals={creativeDeals}
            showArchived={showArchived}
            onToggleDone={toggleMilestoneDone}
            onCreate={() => setShowCreate(true)}
          />
        )}
      </div>

      {showCreate && (
        <CreateProjectModal
          onClose={() => setShowCreate(false)}
          onCreated={(p) => {
            setAllProductions((prev) => [p, ...prev]);
            setShowCreate(false);
          }}
        />
      )}
    </div>
  );
}

// ─── Overview view — the default dashboard ──────────────────────────────────

function OverviewView({
  productions,
  archivedProjects,
  creativeDeals,
  showArchived,
  onToggleDone,
  onCreate,
}: {
  productions: Production[];
  archivedProjects: Production[];
  creativeDeals: CreativeDeal[];
  showArchived: boolean;
  onToggleDone: (productionId: string, milestoneId: string, done: boolean) => void;
  onCreate: () => void;
}) {
  const today = startOfDay(new Date());

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
      // A call sheet and a freeform shootDate on the SAME day are one shoot,
      // not two. getAllShootDates dedupes both sources by day, so count off
      // that instead of iterating callSheets + shootDates separately (which
      // double-counted a day covered by both).
      for (const d of getAllShootDates(p)) {
        if (!isBefore(d, today) && isBefore(d, horizon)) upcoming += 1;
      }
      for (const cs of p.callSheets ?? []) {
        if (cs.status === "DRAFT") drafts += 1;
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

  const list = productions ?? [];
  const active = list.filter((p) => !["DELIVERED", "ARCHIVED"].includes(p.status));
  const archived = list.filter((p) => ["DELIVERED", "ARCHIVED"].includes(p.status));

  return (
    <>
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

      {/* Brief → production conversion (Phase 4F win-rate metric).
          Converted = commercial productions cleared from a brief;
          in-flight = creative-brief deals not yet cleared. */}
      {(() => {
        const converted = list.filter((p) => (p.type ?? "") === "COMMERCIAL").length;
        const inFlight = creativeDeals.length;
        const total = converted + inFlight;
        if (total === 0) return null;
        const rate = Math.round((converted / total) * 100);
        return (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-5 py-3 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Brief conversion
            </span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
              <div className="h-full rounded-full bg-[#A93B2E]" style={{ width: `${rate}%` }} />
            </div>
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
              {rate}%
            </span>
            <span className="text-xs text-gray-400">
              {converted} cleared · {inFlight} brief{inFlight === 1 ? "" : "s"} in flight
            </span>
          </div>
        );
      })()}

      {/* Hero calendar — the main dashboard view */}
      <div id="calendar" className="mb-5">
        <DashboardCalendar productions={list} onToggleDone={onToggleDone} />
      </div>

      {/* Upcoming shoots */}
      <div className="mb-8">
        <UpcomingList productions={list} />
      </div>

      {/* Creative in progress — incoming work still in the creative loop */}
      {creativeDeals.length > 0 && <CreativeInProgress deals={creativeDeals} />}

      {/* Projects */}
      <section id="projects">
        {list.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-12 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-amber-50 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center mb-4">
              <Film size={28} className="text-[#9C7C2E]" />
            </div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-1">No projects yet</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 max-w-sm">
              Productions you create will land here with their shoot dates, call sheets, and crew.
            </p>
            <button
              onClick={onCreate}
              className="flex items-center gap-2 bg-[#111111] dark:bg-white text-white dark:text-black px-4 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-colors"
            >
              <Plus size={16} />
              Create your first project
            </button>
          </div>
        ) : (
          <>
            <ProjectTable rows={active} />
            {archived.length > 0 && (
              <div className="mt-8">
                <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">
                  Completed — {archived.length}
                </h2>
                <ProjectTable rows={archived} flat />
              </div>
            )}
          </>
        )}

        {/* Archived projects — visible only via the toggle, shown muted.
            Commercial projects are unarchived from the parent deal. */}
        {showArchived && archivedProjects.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Archive size={12} /> Archived — {archivedProjects.length}
            </h2>
            <div className="opacity-60 grayscale">
              <ProjectTable rows={archivedProjects} flat />
            </div>
          </div>
        )}
        {showArchived && archivedProjects.length === 0 && (
          <p className="mt-8 text-xs text-gray-400 dark:text-gray-500">No archived projects.</p>
        )}
      </section>
    </>
  );
}

// ─── Projects list view — grouped by client ─────────────────────────────────

type ProjectFilter = "all" | "active" | "completed" | "archived";

function formatBudget(n?: number | null): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(n);
}

// Earliest upcoming shoot, or earliest shoot overall, as a sortable timestamp.
function firstShootTime(p: Production): number | null {
  const next = getNextShoot(p);
  if (next) return next.date.getTime();
  const all = getAllShootDates(p).sort((a, b) => a.getTime() - b.getTime());
  return all.length ? all[0].getTime() : null;
}


// Human "last updated" label — Today / Yesterday / N days/weeks/months ago,
// falling back to an absolute date for anything older than a year.


function ProjectsListView({ productions, onChanged }: { productions: Production[]; onChanged: () => void }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ProjectFilter>("all");

  const counts = useMemo(() => {
    let all = 0,
      activeC = 0,
      completedC = 0,
      archivedC = 0;
    for (const p of productions) {
      all += 1;
      const isArch = p.archived === true;
      const isComplete = ["DELIVERED", "ARCHIVED"].includes(p.status);
      if (isArch) archivedC += 1;
      else if (isComplete) completedC += 1;
      else activeC += 1;
    }
    return { all, active: activeC, completed: completedC, archived: archivedC };
  }, [productions]);

  // Tab + search filter. Grouping and ordering happen in ProjectTable, which
  // buckets by strand and runs soonest-shoot-first within each.
  const visible = useMemo<Production[]>(() => {
    const q = query.trim().toLowerCase();
    let list = productions.filter((p) => {
      const isArch = p.archived === true;
      const isComplete = ["DELIVERED", "ARCHIVED"].includes(p.status);
      if (filter === "archived") return isArch;
      if (filter === "active") return !isArch && !isComplete;
      if (filter === "completed") return !isArch && isComplete;
      return true; // all
    });
    if (q) {
      list = list.filter((p) => {
        const name = p.title.toLowerCase();
        const client = (getClientName(p) ?? "").toLowerCase();
        return name.includes(q) || client.includes(q);
      });
    }
    return list;
  }, [productions, query, filter]);

  const totalRows = visible.length;

  const FILTER_TABS: { key: ProjectFilter; label: string; count: number }[] = [
    { key: "all", label: "All", count: counts.all },
    { key: "active", label: "Active", count: counts.active },
    { key: "completed", label: "Completed", count: counts.completed },
    { key: "archived", label: "Archived", count: counts.archived },
  ];

  return (
    <div>
      {/* Search */}
      <div className="relative mb-4">
        <Search
          size={16}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search projects or clients…"
          className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 pl-10 pr-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#9C7C2E]/30 focus:border-[#9C7C2E]"
        />
      </div>

      {/* Filter tabs */}
      <div className="mb-4 flex items-center gap-1.5 flex-wrap">
        {FILTER_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              filter === t.key
                ? "bg-[#111111] dark:bg-white text-white dark:text-black"
                : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            }`}
          >
            {t.label}
            <span
              className={`tabular-nums ${
                filter === t.key ? "opacity-70" : "text-gray-400 dark:text-gray-500"
              }`}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Grouped by strand — Print / Digital Editorial / White Label / Paid.
          Was grouped by client, which buried the thing you actually plan by. */}
      {totalRows === 0 ? (
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm px-4 py-12 text-center text-sm text-gray-400 dark:text-gray-500">
          No projects match.
        </div>
      ) : (
        <ProjectTable rows={visible} onChanged={onChanged} />
      )}
    </div>
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
    amber: { bg: "bg-amber-50 dark:bg-amber-900/30", fg: "text-[#9C7C2E]" },
    emerald: { bg: "bg-emerald-50 dark:bg-emerald-900/30", fg: "text-emerald-600 dark:text-emerald-400" },
    blue: { bg: "bg-blue-50 dark:bg-blue-900/30", fg: "text-blue-600 dark:text-blue-400" },
    orange: { bg: "bg-orange-50 dark:bg-orange-900/30", fg: "text-orange-600 dark:text-orange-400" },
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
        <p className="text-3xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight">{value}</p>
        {subtitle && <p className="text-xs text-gray-400 dark:text-gray-500">{subtitle}</p>}
      </div>
    </div>
  );
}


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
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm h-full overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50 dark:border-gray-800">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
          <Clock size={15} className="text-[#9C7C2E]" />
          Upcoming
        </h2>
      </div>
      {top.length === 0 ? (
        <div className="px-5 py-10 text-center text-xs text-gray-400 dark:text-gray-500">
          No upcoming shoots
        </div>
      ) : (
        <div className="divide-y divide-gray-50 dark:divide-gray-800">
          {top.map((it, i) => {
            const tone = countdownTone(it.date);
            const budget = it.production.budgetedTotal ?? 0;
            const headroom = budget - (it.production.actualTotal ?? 0);
            return (
              <Link
                key={i}
                href={
                  it.cs
                    ? `/production/${it.production.id}/call-sheets/${it.cs.id}`
                    : `/production/${it.production.id}`
                }
                className="flex items-center justify-between px-5 py-3 hover:bg-gray-50/60 dark:hover:bg-gray-800/60 transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="text-center w-10 shrink-0">
                    <div className="text-[9px] font-bold text-[#9C7C2E] uppercase leading-none">
                      {format(it.date, "MMM")}
                    </div>
                    <div className="text-base font-bold text-gray-800 dark:text-gray-200 leading-tight mt-0.5">
                      {format(it.date, "d")}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate group-hover:text-[#9C7C2E] transition-colors">
                      {it.production.title}
                    </p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">
                      {getClientName(it.production) || "—"}
                      {it.cs?.callTime ? ` · ${it.cs.callTime}` : ""}
                      {it.production.lead?.name ? ` · ${it.production.lead.name}` : ""}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-2.5">
                  {/* Budget and headroom on the row — you shouldn't have to open
                      a project to see whether the shoot you're about to run has
                      money left. */}
                  {budget > 0 && (
                    <span className="hidden sm:block text-right leading-tight">
                      <span className="block text-[11px] tabular-nums text-gray-600 dark:text-gray-300">
                        {formatBudget(budget)}
                      </span>
                      <span
                        className={`block text-[10px] tabular-nums ${
                          headroom < 0
                            ? "text-red-600 dark:text-red-400"
                            : "text-gray-400 dark:text-gray-500"
                        }`}
                      >
                        {headroom < 0 ? "over by " : ""}
                        {formatBudget(Math.abs(headroom))}
                        {headroom >= 0 ? " left" : ""}
                      </span>
                    </span>
                  )}
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tone.bg} ${tone.text}`}
                  >
                    {countdownLabel(it.date)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Creative in progress ───────────────────────────────────────────────────

function CreativeInProgress({ deals }: { deals: CreativeDeal[] }) {
  return (
    <section className="mb-8">
      <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
        <Sparkles size={13} className="text-purple-500 dark:text-purple-400" />
        Creative in Progress — {deals.length}
        <span className="font-normal normal-case tracking-normal text-gray-400 dark:text-gray-500">· incoming work, not yet cleared for production</span>
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {deals.map((d) => {
          const meta = CREATIVE_STATUS_META[d.creativeStatus ?? ""] ?? {
            label: d.creativeStatus ?? "In Progress",
            cls: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
          };
          const approved = d.creativeStatus === "APPROVED";
          return (
            <Link
              key={d.id}
              href={`/commercial/deals/${d.id}`}
              className={`block rounded-2xl border bg-white dark:bg-gray-900 p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
                approved ? "border-emerald-200 dark:border-emerald-800" : "border-purple-100 dark:border-purple-800"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${meta.cls}`}>
                  {meta.label}
                </span>
                <ArrowUpRight size={14} className="text-gray-300 dark:text-gray-600" />
              </div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{d.title}</p>
              {d.clientName && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{d.clientName}</p>}
              {d.briefExcerpt && (
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-2 line-clamp-2">{d.briefExcerpt}</p>
              )}
              <div className="mt-3 flex items-center gap-3 flex-wrap">
                {approved && d.figmaUrl && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-600 dark:text-purple-400">
                    <CheckCircle2 size={12} /> Approved deck attached
                  </span>
                )}
                {d.assignedTo && <span className="text-[11px] text-gray-400 dark:text-gray-500">{d.assignedTo}</span>}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

// ─── Project card ──────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Projects list. Replaces the old card grid: cards gave each project a lot of
// chrome and very little information, and you couldn't scan budgets across a
// dozen of them. A row per project, grouped by strand, with the numbers aligned
// so the eye can run down a column.
//
// Order within a strand: anything with a shoot date comes first, soonest first —
// that's what "urgent" means here. Everything else falls back to most recently
// touched.
// ─────────────────────────────────────────────────────────────────────────────
function ProjectTable({ rows, flat = false, onChanged }: { rows: Production[]; flat?: boolean; onChanged?: () => void }) {
  const groups = useMemo(() => {
    const byStrand = new Map<Strand, Production[]>();
    for (const p of rows) {
      const key = strandOf({
        strand: p.strand,
        billingType: p.billingType,
        type: p.type,
        campaignId: p.campaignId,
        inIssueBudget: p.inIssueBudget,
      });
      const list = byStrand.get(key);
      if (list) list.push(p);
      else byStrand.set(key, [p]);
    }
    for (const list of byStrand.values()) {
      list.sort((a, b) => {
        const sa = firstShootTime(a);
        const sb = firstShootTime(b);
        if (sa != null && sb != null) return sa - sb;
        if (sa != null) return -1;
        if (sb != null) return 1;
        const ua = a.updatedAt ? parseISO(a.updatedAt).getTime() : 0;
        const ub = b.updatedAt ? parseISO(b.updatedAt).getTime() : 0;
        return ub - ua;
      });
    }
    return STRANDS.map((s) => ({ ...s, rows: byStrand.get(s.key) ?? [] })).filter(
      (g) => g.rows.length > 0
    );
  }, [rows]);

  if (rows.length === 0) return null;

  // `flat` skips the strand headings — used for the Completed and Archived
  // blocks, which are already grouped by something else.
  if (flat) {
    return (
      <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
        <ProjectRows rows={rows} onChanged={onChanged} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <div key={g.key}>
          <div className="flex items-baseline gap-2 mb-2">
            <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
              {g.label}
            </h2>
            <span className="text-xs text-gray-400 dark:text-gray-500">{g.rows.length}</span>
            <span className="text-[11px] text-gray-400 dark:text-gray-500 hidden sm:inline">
              · {g.blurb}
            </span>
          </div>
          <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
            <ProjectRows rows={g.rows} onChanged={onChanged} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ProjectRows({ rows, onChanged }: { rows: Production[]; onChanged?: () => void }) {
  const confirm = useConfirm();
  const [busy, setBusy] = useState<string | null>(null);

  // Archive from the list. Mirrors the project page exactly: editorial projects
  // are archivable by anyone, deal-linked ones explain that Commercial owns them
  // and only an admin may go ahead. The button is always shown — hiding it is
  // what made people think the feature had gone.
  async function archive(p: Production) {
    const commercial = Boolean(p.campaignId);
    const ok = await confirm({
      title: commercial ? "Archive this commercial project?" : "Archive this project?",
      message: commercial
        ? "This project is bound by a commercial agreement. Archiving hides it from Production — the deal stays live in Commercial and nothing is deleted. Only an admin can do this."
        : "It disappears from the Production dashboard but nothing is deleted — it can be unarchived later.",
      confirmLabel: "Archive",
      confirmVariant: "danger",
    });
    if (!ok) return;
    setBusy(p.id);
    try {
      const res = await fetch(`/api/productions/${p.id}/archive`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: !p.archived }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        await confirm({
          title: "Couldn't archive",
          message: data.error || "Something went wrong.",
          confirmLabel: "OK",
          cancelLabel: "",
        });
        return;
      }
      onChanged?.();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-gray-500">
            <th className="text-left font-semibold px-4 py-2.5">Project</th>
            <th className="text-left font-semibold px-3 py-2.5">Status</th>
            <th className="text-left font-semibold px-3 py-2.5">Shoot</th>
            <th className="text-right font-semibold px-3 py-2.5">Budget</th>
            <th className="text-right font-semibold px-3 py-2.5">Spent</th>
            <th className="text-right font-semibold px-3 py-2.5">Headroom</th>
            <th className="text-left font-semibold px-4 py-2.5">Lead</th>
            <th className="px-3 py-2.5 w-10"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const style = STATUS_STYLES[p.status] || STATUS_STYLES.DRAFT;
            const next = getNextShoot(p);
            const budget = p.budgetedTotal ?? 0;
            const spent = p.actualTotal ?? 0;
            const headroom = budget - spent;
            const derived = strandIsDerived({
              strand: p.strand,
              billingType: p.billingType,
              type: p.type,
              campaignId: p.campaignId,
              inIssueBudget: p.inIssueBudget,
            });
            return (
              <tr
                key={p.id}
                className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition-colors"
              >
                <td className="px-4 py-3">
                  <Link href={`/production/${p.id}`} className="block group">
                    <span className="font-medium text-gray-900 dark:text-gray-100 group-hover:underline">
                      {p.title || "Untitled project"}
                    </span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">
                      {getClientName(p) || "—"}
                      {derived && (
                        <span
                          className="ml-1.5 text-gray-300 dark:text-gray-600"
                          title="Strand worked out from the project's data — open the project to set it explicitly"
                        >
                          ·&nbsp;auto
                        </span>
                      )}
                    </span>
                  </Link>
                </td>
                <td className="px-3 py-3">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${style.bg} ${style.text}`}>
                    {style.label}
                  </span>
                </td>
                <td className="px-3 py-3 text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">
                  {next?.date
                    ? next.date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                    : <span className="text-gray-400 dark:text-gray-600">—</span>}
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-gray-700 dark:text-gray-200 whitespace-nowrap">
                  {budget ? formatBudget(budget) : <span className="text-gray-400 dark:text-gray-600">—</span>}
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-gray-700 dark:text-gray-200 whitespace-nowrap">
                  {spent ? formatBudget(spent) : <span className="text-gray-400 dark:text-gray-600">—</span>}
                </td>
                <td
                  className={`px-3 py-3 text-right tabular-nums whitespace-nowrap ${
                    budget && headroom < 0
                      ? "text-red-600 dark:text-red-400"
                      : "text-gray-700 dark:text-gray-200"
                  }`}
                >
                  {budget ? formatBudget(headroom) : <span className="text-gray-400 dark:text-gray-600">—</span>}
                </td>
                <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">
                  {p.lead?.name ?? <span className="text-gray-400 dark:text-gray-600">Unassigned</span>}
                </td>
                <td className="px-3 py-3 text-right">
                  <button
                    onClick={() => archive(p)}
                    disabled={busy === p.id}
                    title={p.archived ? "Unarchive this project" : "Archive this project"}
                    className="text-gray-300 hover:text-gray-600 dark:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-40"
                  >
                    {busy === p.id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : p.archived ? (
                      <ArchiveRestore size={13} />
                    ) : (
                      <Archive size={13} />
                    )}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

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
  const [billing, setBilling] = useState<"EDITORIAL" | "PAID">("EDITORIAL");
  const [figmaUrl, setFigmaUrl] = useState("");
  const [budget, setBudget] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) return;
    if (budget && (Number.isNaN(Number(budget)) || Number(budget) < 0)) {
      setError("Budget must be a number of 0 or more.");
      return;
    }
    if (figmaUrl.trim() && !isValidUrl(figmaUrl)) {
      setError("Please enter a valid Figma URL, or leave it blank.");
      return;
    }
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
          billingType: billing,
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
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-50 dark:border-gray-800 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">New Project</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleCreate} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">
              Project Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Summer Campaign 2026"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-[#9C7C2E]/30 focus:border-[#9C7C2E]"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">
              Client
            </label>
            <input
              type="text"
              value={client}
              onChange={(e) => setClient(e.target.value)}
              placeholder="e.g. Aston Martin"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-[#9C7C2E]/30 focus:border-[#9C7C2E]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Concept, deliverables, anything worth remembering…"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#9C7C2E]/30 focus:border-[#9C7C2E]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">
              Shoot Dates
            </label>
            <div className="space-y-2">
              {(shootDates ?? []).map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="date"
                    value={d}
                    onChange={(e) => updateDate(i, e.target.value)}
                    className="flex-1 px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-[#9C7C2E]/30 focus:border-[#9C7C2E]"
                  />
                  {shootDates.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeDate(i)}
                      className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addDate}
                className="flex items-center gap-1.5 text-xs font-medium text-[#9C7C2E] hover:text-[#9C7C2E] transition-colors"
              >
                <Plus size={13} /> Add another date
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">
              Project Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { key: "EDITORIAL", label: "Editorial", hex: "#2E5E44" },
                  { key: "PAID", label: "Paid / Commercial", hex: "#9C7C2E" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setBilling(opt.key)}
                  className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                    billing === opt.key
                      ? "border-[#9C7C2E] bg-amber-50/60 dark:bg-amber-900/20 text-gray-900 dark:text-gray-100"
                      : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: opt.hex }} />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ProductionStatus)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-[#9C7C2E]/30 focus:border-[#9C7C2E] bg-white dark:bg-gray-900"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_STYLES[s].label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                Budget (£)
              </label>
              <input
                type="number"
                min="0"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="0"
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 ${
                  budget && Number(budget) < 0
                    ? "border-red-400 focus:ring-red-200 dark:border-red-500"
                    : "border-gray-200 dark:border-gray-700 focus:ring-[#9C7C2E]/30 focus:border-[#9C7C2E]"
                }`}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">
              Figma Link
            </label>
            <input
              type="url"
              value={figmaUrl}
              onChange={(e) => setFigmaUrl(e.target.value)}
              placeholder="https://figma.com/file/…"
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 ${
                figmaUrl.trim() && !isValidUrl(figmaUrl)
                  ? "border-red-400 focus:ring-red-200 dark:border-red-500"
                  : "border-gray-200 dark:border-gray-700 focus:ring-[#9C7C2E]/30 focus:border-[#9C7C2E]"
              }`}
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || creating}
              className="flex-1 flex items-center justify-center gap-2 bg-[#111111] dark:bg-white text-white dark:text-black px-4 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
