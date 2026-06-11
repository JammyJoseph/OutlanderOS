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
  ChevronDown,
  Film,
  FileText,
  Lock as LockIcon,
  Archive as ArchiveIcon,
  ArchiveRestore,
} from "lucide-react";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import {
  STAGE_ORDER,
  STAGE_STYLES,
  STAGE_GROUPS,
  CREATIVE_STAGES,
  WORKFLOW_STYLES,
  CREATIVE_STATUS_STYLES,
  normalizeStage,
  typeStyle,
  formatMoney,
  dealTypesOf,
  DEAL_TYPE_OPTIONS,
  TYPE_STYLES,
  type Deal,
  type DealStage,
  type WorkflowType,
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

  // Filters — typeFilter is multi-select; a deal matches if it has ANY selected type
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [memberFilter, setMemberFilter] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  // Drag state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<DealStage | null>(null);

  const searchParams = useSearchParams();
  const focusStage = searchParams.get("stage") as DealStage | null;
  const columnRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const router = useRouter();

  useEffect(() => {
    Promise.all([
      fetch(showArchived ? "/api/campaigns?includeArchived=true" : "/api/campaigns").then((r) =>
        r.json()
      ),
      fetch("/api/users").then((r) => r.json()),
    ])
      .then(([d, u]) => {
        setDeals(Array.isArray(d) ? d : []);
        setUsers(Array.isArray(u) ? u : []);
      })
      .finally(() => setLoading(false));
  }, [showArchived]);

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
      if (typeFilter.length && !dealTypesOf(d).some((t) => typeFilter.includes(t))) return false;
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
      const stage = normalizeStage(d.stage);
      const list = map.get(stage);
      if (list) list.push(d);
      else map.set(stage, [d]);
    }
    return map;
  }, [filtered]);

  // Supplied-assets deals skip the creative + cleared-for-production columns.
  function stageAllowedFor(deal: Deal, stage: DealStage): boolean {
    if (deal.workflowType !== "SUPPLIED_ASSETS") return true;
    return !CREATIVE_STAGES.includes(stage) && stage !== "CLEARED_FOR_PRODUCTION";
  }

  async function archiveDeal(deal: Deal) {
    const cascades = Boolean(deal.production);
    const message = cascades
      ? `Archive "${deal.title}"? This will also archive the linked production project. Continue?`
      : `Archive "${deal.title}"? It disappears from the pipeline but can be restored via "Show archived".`;
    if (!confirm(message)) return;
    const previous = deals;
    setDeals((prev) =>
      showArchived
        ? prev.map((d) =>
            d.id === deal.id
              ? { ...d, archived: true, archivedAt: new Date().toISOString() }
              : d
          )
        : prev.filter((d) => d.id !== deal.id)
    );
    try {
      const res = await fetch(`/api/campaigns/${deal.id}/archive`, { method: "PATCH" });
      if (!res.ok) setDeals(previous);
    } catch {
      setDeals(previous);
    }
  }

  async function unarchiveDeal(deal: Deal) {
    const previous = deals;
    setDeals((prev) =>
      prev.map((d) => (d.id === deal.id ? { ...d, archived: false, archivedAt: null } : d))
    );
    try {
      const res = await fetch(`/api/campaigns/${deal.id}/unarchive`, { method: "PATCH" });
      if (!res.ok) setDeals(previous);
    } catch {
      setDeals(previous);
    }
  }

  async function moveDeal(dealId: string, stage: DealStage) {
    const deal = deals.find((d) => d.id === dealId);
    if (!deal || deal.stage === stage) return;
    if (deal.archived) return;
    if (!stageAllowedFor(deal, stage)) return;
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
          <TypeFilterDropdown selected={typeFilter} onChange={setTypeFilter} />
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
          <button
            onClick={() => setShowArchived((v) => !v)}
            className={`flex items-center gap-1.5 rounded-xl border bg-white text-sm px-3 py-2 transition-colors ${
              showArchived
                ? "border-gray-400 text-gray-700 font-medium"
                : "border-gray-200 text-gray-500"
            }`}
            title={showArchived ? "Hide archived deals" : "Show archived deals"}
          >
            <ArchiveIcon size={13} className="text-gray-400" />
            {showArchived ? "Showing archived" : "Show archived"}
          </button>
          {(search || typeFilter.length > 0 || memberFilter) && (
            <button
              onClick={() => {
                setSearch("");
                setTypeFilter([]);
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
            <div className="flex gap-4 min-w-max items-start">
              {STAGE_GROUPS.map((group) => (
                <div
                  key={group.key}
                  className={`rounded-2xl p-1.5 ${
                    group.creative ? "bg-purple-50/60 border border-purple-100" : "bg-transparent"
                  }`}
                >
                  {/* Group header */}
                  <div className="flex items-center gap-2 px-2 pt-1 pb-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${group.dot}`} />
                    <span
                      className={`text-[11px] font-bold uppercase tracking-widest ${group.accent}`}
                    >
                      {group.label}
                    </span>
                    {group.creative && (
                      <span className="text-[10px] font-medium text-purple-400">
                        creative brief jobs only
                      </span>
                    )}
                    <span className="flex-1 border-t border-dashed border-gray-200 ml-1" />
                  </div>

                  <div className="flex gap-3">
                    {group.stages.map((stage) => {
                      const style = STAGE_STYLES[stage];
                      const stageDeals = byStage.get(stage) ?? [];
                      const stageValue = stageDeals.reduce((sum, d) => sum + (d.value ?? 0), 0);
                      const isOver = dragOverStage === stage;
                      const isFocused = focusStage === stage;
                      const draggingDeal = draggingId
                        ? deals.find((d) => d.id === draggingId)
                        : null;
                      const dropBlocked = draggingDeal ? !stageAllowedFor(draggingDeal, stage) : false;
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
                          className={`w-[270px] shrink-0 rounded-2xl border transition-all duration-150 ${
                            group.creative ? "bg-purple-100/40" : "bg-gray-100/70"
                          } ${
                            isOver && dropBlocked
                              ? "border-gray-300 ring-2 ring-gray-300/40 opacity-60"
                              : isOver
                                ? "border-[#D4A853] ring-2 ring-[#D4A853]/30 bg-amber-50/60"
                                : isFocused
                                  ? "border-[#D4A853]/50 ring-1 ring-[#D4A853]/20"
                                  : group.creative
                                    ? "border-purple-200/60"
                                    : "border-gray-200/60"
                          }`}
                        >
                          {/* Column header */}
                          <div className="px-3.5 pt-3.5 pb-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                              <span
                                className={`text-xs font-semibold uppercase tracking-wide ${
                                  group.creative ? "text-purple-800" : "text-gray-700"
                                }`}
                              >
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
                              <div
                                className={`rounded-xl border border-dashed py-6 text-center text-[11px] ${
                                  group.creative
                                    ? "border-purple-200/80 text-purple-300"
                                    : "border-gray-300/70 text-gray-400"
                                }`}
                              >
                                {isOver && dropBlocked
                                  ? "Supplied assets skip this stage"
                                  : isOver
                                    ? "Drop here"
                                    : "No deals"}
                              </div>
                            )}
                            {stageDeals.map((deal) => (
                              <DealCard
                                key={deal.id}
                                deal={deal}
                                dragging={draggingId === deal.id}
                                onArchive={() => archiveDeal(deal)}
                                onUnarchive={() => unarchiveDeal(deal)}
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
              ))}
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

// ─── Type filter dropdown (multi-select) ──────────────────────────────────────

function TypeFilterDropdown({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (types: string[]) => void;
}) {
  const [open, setOpen] = useState(false);

  function toggle(type: string) {
    onChange(
      selected.includes(type) ? selected.filter((t) => t !== type) : [...selected, type]
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 rounded-xl border bg-white text-sm px-3 py-2 transition-colors ${
          selected.length
            ? "border-[#D4A853] text-[#9C7424] font-medium"
            : "border-gray-200 text-gray-700"
        }`}
      >
        {selected.length === 0
          ? "All types"
          : selected.length === 1
            ? TYPE_STYLES[selected[0]]?.label ?? selected[0]
            : `${selected.length} types`}
        <ChevronDown size={13} className="text-gray-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1.5 w-56 rounded-xl border border-gray-100 bg-white shadow-lg p-1.5">
            {DEAL_TYPE_OPTIONS.map((t) => (
              <label
                key={t}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(t)}
                  onChange={() => toggle(t)}
                  className="h-3.5 w-3.5 rounded border-gray-300 accent-[#D4A853]"
                />
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${TYPE_STYLES[t].bg} ${TYPE_STYLES[t].text}`}
                >
                  {TYPE_STYLES[t].label}
                </span>
              </label>
            ))}
            {selected.length > 0 && (
              <button
                onClick={() => onChange([])}
                className="w-full text-left text-xs font-medium text-gray-400 hover:text-gray-600 px-2.5 py-1.5 mt-0.5 border-t border-gray-50"
              >
                Clear selection
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Deal card ────────────────────────────────────────────────────────────────

function DealCard({
  deal,
  dragging,
  onArchive,
  onUnarchive,
  onDragStart,
  onDragEnd,
}: {
  deal: Deal;
  dragging: boolean;
  onArchive: () => void;
  onUnarchive: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  const types = dealTypesOf(deal);
  const stageSince = deal.stageUpdatedAt ?? deal.createdAt;
  const daysInStage = differenceInCalendarDays(new Date(), parseISO(stageSince));
  const due = deal.dueDate ? parseISO(deal.dueDate) : null;
  const overdue = due ? differenceInCalendarDays(due, new Date()) < 0 : false;
  const workflow =
    WORKFLOW_STYLES[(deal.workflowType as WorkflowType) ?? "CREATIVE_BRIEF"] ??
    WORKFLOW_STYLES.CREATIVE_BRIEF;
  const creativeStatus =
    deal.workflowType !== "SUPPLIED_ASSETS" && deal.creativeStatus
      ? CREATIVE_STATUS_STYLES[deal.creativeStatus]
      : null;

  const archived = Boolean(deal.archived);

  return (
    <Link href={`/commercial/deals/${deal.id}`} className="block">
      <div
        draggable={!archived}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        className={`relative group/card bg-white rounded-xl border shadow-sm p-3.5 transition-all duration-150 ${
          archived
            ? "border-gray-200/60 opacity-60 grayscale"
            : "border-gray-200/80 cursor-grab active:cursor-grabbing hover:shadow-md hover:-translate-y-0.5"
        } ${dragging ? "opacity-40 rotate-1 scale-[0.98]" : ""}`}
      >
        {/* Hover action: archive replaces delete everywhere */}
        {!archived && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onArchive();
            }}
            title="Archive deal"
            className="absolute top-2 right-2 p-1.5 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 opacity-0 group-hover/card:opacity-100 transition-opacity"
          >
            <ArchiveIcon size={13} />
          </button>
        )}
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide truncate mb-1.5">
          {deal.client.name}
        </p>
        <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2 mb-1.5">
          {deal.title}
        </p>
        <div className="flex flex-wrap items-center gap-1 mb-2">
          {archived && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">
              <ArchiveIcon size={9} /> Archived
            </span>
          )}
          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${workflow.bg} ${workflow.text}`}
          >
            {workflow.label}
          </span>
          {types.map((t) => {
            const style = typeStyle(t);
            return (
              <span
                key={t}
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}
              >
                {style.label}
              </span>
            );
          })}
          {creativeStatus && !deal.production && (
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${creativeStatus.bg} ${creativeStatus.text}`}
            >
              <FileText size={10} /> {creativeStatus.label}
            </span>
          )}
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
              deal.budgetLocked ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"
            }`}
            title={deal.budgetLocked ? "Budget locked" : "Budget draft"}
          >
            {deal.budgetLocked ? (
              <>
                <LockIcon size={9} /> Locked ✓
              </>
            ) : (
              "Draft"
            )}
          </span>
          {deal.production && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
              <Film size={10} /> In Production
            </span>
          )}
        </div>
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
        {archived && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onUnarchive();
            }}
            className="mt-2.5 w-full flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <ArchiveRestore size={12} /> Unarchive
          </button>
        )}
      </div>
    </Link>
  );
}
