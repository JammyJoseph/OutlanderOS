"use client";

import { useState, useEffect, useMemo, useRef, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  Loader2,
  Search,
  CalendarDays,
  User as UserIcon,
  Clock,
  LayoutDashboard,
} from "lucide-react";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import {
  STAGE_ORDER,
  STAGE_STYLES,
  typeStyle,
  formatMoney,
  DEAL_TYPE_OPTIONS,
  TYPE_STYLES,
  type Deal,
  type DealStage,
} from "../_components/deal-ui";
import NewDealModal from "../_components/NewDealModal";

interface TeamMember {
  id: string;
  name: string;
}

export default function PipelinePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      }
    >
      <PipelineBoard />
    </Suspense>
  );
}

function PipelineBoard() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [users, setUsers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewDeal, setShowNewDeal] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [memberFilter, setMemberFilter] = useState("");

  // Drag state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<DealStage | null>(null);

  const searchParams = useSearchParams();
  const focusStage = searchParams.get("stage") as DealStage | null;
  const columnRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const router = useRouter();

  useEffect(() => {
    Promise.all([
      fetch("/api/campaigns").then((r) => r.json()),
      fetch("/api/users").then((r) => r.json()),
    ])
      .then(([d, u]) => {
        setDeals(Array.isArray(d) ? d : []);
        setUsers(Array.isArray(u) ? u : []);
      })
      .finally(() => setLoading(false));
  }, []);

  // Scroll the focused stage column into view (when arriving from the dashboard)
  useEffect(() => {
    if (!loading && focusStage && columnRefs.current[focusStage]) {
      columnRefs.current[focusStage]?.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    }
  }, [loading, focusStage]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return deals.filter((d) => {
      if (typeFilter && d.type !== typeFilter) return false;
      if (memberFilter && d.assignedTo?.id !== memberFilter) return false;
      if (q && !d.title.toLowerCase().includes(q) && !d.client.name.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [deals, search, typeFilter, memberFilter]);

  const byStage = useMemo(() => {
    const map = new Map<DealStage, Deal[]>();
    for (const stage of STAGE_ORDER) map.set(stage, []);
    for (const d of filtered) {
      map.get(d.stage)?.push(d) ?? map.set(d.stage, [d]);
    }
    return map;
  }, [filtered]);

  async function moveDeal(dealId: string, stage: DealStage) {
    const deal = deals.find((d) => d.id === dealId);
    if (!deal || deal.stage === stage) return;
    const previous = deals;
    // Optimistic update
    setDeals((prev) =>
      prev.map((d) =>
        d.id === dealId ? { ...d, stage, stageUpdatedAt: new Date().toISOString() } : d
      )
    );
    try {
      const res = await fetch(`/api/campaigns/${dealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      if (!res.ok) setDeals(previous);
    } catch {
      setDeals(previous);
    }
  }

  const inputCls =
    "rounded-xl border border-gray-200 bg-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853]";

  return (
    <div className="min-h-screen bg-[#F9F9F7]">
      <div className="max-w-full px-6 py-8">
        {/* Header */}
        <div className="flex items-end justify-between mb-5 max-w-6xl mx-auto">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#D4A853]">
              OutlanderOS · Commercial
            </p>
            <h1 className="mt-1 text-3xl font-semibold text-gray-900 tracking-tight">Pipeline</h1>
            <p className="text-gray-500 mt-1 text-sm">
              {filtered.length} deal{filtered.length !== 1 ? "s" : ""} · drag cards between stages
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/commercial"
              className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm"
            >
              <LayoutDashboard size={16} className="text-[#D4A853]" />
              Dashboard
            </Link>
            <button
              onClick={() => setShowNewDeal(true)}
              className="flex items-center gap-2 bg-[#D4A853] text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-[#c49843] transition-colors shadow-sm"
            >
              <Plus size={16} />
              New Deal
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-5 max-w-6xl mx-auto">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search deals or clients…"
              className={`${inputCls} pl-8 w-64`}
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className={inputCls}
          >
            <option value="">All types</option>
            {DEAL_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {TYPE_STYLES[t].label}
              </option>
            ))}
          </select>
          <select
            value={memberFilter}
            onChange={(e) => setMemberFilter(e.target.value)}
            className={inputCls}
          >
            <option value="">All team members</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          {(search || typeFilter || memberFilter) && (
            <button
              onClick={() => {
                setSearch("");
                setTypeFilter("");
                setMemberFilter("");
              }}
              className="text-xs font-medium text-gray-400 hover:text-gray-600 px-2 py-1"
            >
              Clear filters
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={24} className="animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-3 min-w-max">
              {STAGE_ORDER.map((stage) => {
                const style = STAGE_STYLES[stage];
                const stageDeals = byStage.get(stage) ?? [];
                const stageValue = stageDeals.reduce((sum, d) => sum + (d.value ?? 0), 0);
                const isOver = dragOverStage === stage;
                const isFocused = focusStage === stage;
                return (
                  <div
                    key={stage}
                    ref={(el) => {
                      columnRefs.current[stage] = el;
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverStage(stage);
                    }}
                    onDragLeave={(e) => {
                      if (e.currentTarget === e.target) setDragOverStage(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const id = e.dataTransfer.getData("text/plain") || draggingId;
                      if (id) moveDeal(id, stage);
                      setDragOverStage(null);
                      setDraggingId(null);
                    }}
                    className={`w-[280px] shrink-0 rounded-2xl bg-gray-100/70 border transition-all duration-150 ${
                      isOver
                        ? "border-[#D4A853] ring-2 ring-[#D4A853]/30 bg-amber-50/60"
                        : isFocused
                          ? "border-[#D4A853]/50 ring-1 ring-[#D4A853]/20"
                          : "border-gray-200/60"
                    }`}
                  >
                    {/* Column header */}
                    <div className="px-3.5 pt-3.5 pb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                          {style.label}
                        </span>
                        <span className="text-[11px] font-semibold text-gray-400 bg-white rounded-full px-1.5 py-0.5 border border-gray-200/60">
                          {stageDeals.length}
                        </span>
                      </div>
                      <span className="text-[11px] font-semibold text-gray-500 tabular-nums">
                        {stageValue > 0 ? formatMoney(stageValue) : ""}
                      </span>
                    </div>

                    {/* Cards */}
                    <div className="px-2.5 pb-3 space-y-2 min-h-[140px]">
                      {stageDeals.length === 0 && (
                        <div className="rounded-xl border border-dashed border-gray-300/70 py-6 text-center text-[11px] text-gray-400">
                          {isOver ? "Drop here" : "No deals"}
                        </div>
                      )}
                      {stageDeals.map((deal) => (
                        <DealCard
                          key={deal.id}
                          deal={deal}
                          dragging={draggingId === deal.id}
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", deal.id);
                            e.dataTransfer.effectAllowed = "move";
                            setDraggingId(deal.id);
                          }}
                          onDragEnd={() => {
                            setDraggingId(null);
                            setDragOverStage(null);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {showNewDeal && (
        <NewDealModal
          onClose={() => setShowNewDeal(false)}
          onCreated={(deal) => {
            setShowNewDeal(false);
            // The POST response includes client/assignedTo; stage defaults to LEAD
            setDeals((prev) => [{ ...deal, production: deal.production ?? null }, ...prev]);
            router.push(`/commercial/deals/${deal.id}`);
          }}
        />
      )}
    </div>
  );
}

// ─── Deal card ────────────────────────────────────────────────────────────────

function DealCard({
  deal,
  dragging,
  onDragStart,
  onDragEnd,
}: {
  deal: Deal;
  dragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  const type = typeStyle(deal.type);
  const stageSince = deal.stageUpdatedAt ?? deal.createdAt;
  const daysInStage = differenceInCalendarDays(new Date(), parseISO(stageSince));
  const due = deal.dueDate ? parseISO(deal.dueDate) : null;
  const overdue = due ? differenceInCalendarDays(due, new Date()) < 0 : false;

  return (
    <Link href={`/commercial/deals/${deal.id}`} className="block">
      <div
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        className={`bg-white rounded-xl border border-gray-200/80 shadow-sm p-3.5 cursor-grab active:cursor-grabbing transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 ${
          dragging ? "opacity-40 rotate-1 scale-[0.98]" : ""
        }`}
      >
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide truncate">
            {deal.client.name}
          </p>
          <span
            className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${type.bg} ${type.text}`}
          >
            {type.label}
          </span>
        </div>
        <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2 mb-2">
          {deal.title}
        </p>
        <p className="text-base font-bold text-gray-900 tabular-nums mb-2.5">
          {formatMoney(deal.value)}
        </p>
        <div className="flex items-center justify-between text-[11px] text-gray-400">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex items-center gap-1" title="Days in stage">
              <Clock size={11} />
              {daysInStage}d
            </span>
            {due && (
              <span
                className={`flex items-center gap-1 ${overdue ? "text-red-500 font-semibold" : ""}`}
                title="Due date"
              >
                <CalendarDays size={11} />
                {format(due, "d MMM")}
              </span>
            )}
          </div>
          {deal.assignedTo && (
            <span
              className="flex items-center gap-1 truncate max-w-[90px] text-gray-500"
              title={`Assigned to ${deal.assignedTo.name}`}
            >
              <UserIcon size={11} />
              <span className="truncate">{deal.assignedTo.name.split(" ")[0]}</span>
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
