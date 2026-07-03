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
  stagesForDeal,
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
import { useConfirm } from "@/components/ui/confirm-provider";

interface TeamMember {
  id: string;
  name: string;
}

export default function PipelinePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <Loader2 size={24} className="animate-spin text-gray-400 dark:text-gray-500" />
        </div>
      }
    >
      <PipelineBoard />
    </Suspense>
  );
}

function PipelineBoard() {
  const confirm = useConfirm();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [users, setUsers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewDeal, setShowNewDeal] = useState(false);
  // Archiving is restricted to ADMINs and the Commercial team.
  const [canArchive, setCanArchive] = useState(false);

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

  useEffect(() => {
    fetch("/api/me/permissions")
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => setCanArchive(Boolean(p?.canArchiveDeals)))
      .catch(() => setCanArchive(false));
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

  // Each workflow only allows its own stages — bespoke skips Approval; supplied
  // skips Creative/IO/Cleared; print skips those plus Approval.
  function stageAllowedFor(deal: Deal, stage: DealStage): boolean {
    return (stagesForDeal(deal) as string[]).includes(stage);
  }

  async function archiveDeal(deal: Deal) {
    const cascades = Boolean(deal.production);
    const message = cascades
      ? `This will also archive the linked production project. It disappears from the pipeline but can be restored via "Show archived".`
      : `It disappears from the pipeline but can be restored via "Show archived".`;
    const ok = await confirm({
      title: `Archive "${deal.title}"?`,
      message,
      confirmLabel: "Archive",
      confirmVariant: "danger",
    });
    if (!ok) return;
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
    "rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#ffd700]/30 focus:border-[#ffd700]";

  return (
    <div className="min-h-screen bg-card">
      <div className="max-w-full px-6 py-8">
        {/* Header */}
        <div className="flex items-end justify-between mb-5 max-w-6xl mx-auto">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--portal-commercial)]">
              OutlanderOS · Commercial
            </p>
            <h1 className="mt-1 text-3xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight">Pipeline</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
              {filtered.length} deal{filtered.length !== 1 ? "s" : ""} · drag cards between stages
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/commercial"
              className="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shadow-sm"
            >
              <LayoutDashboard size={16} className="text-[var(--portal-commercial)]" />
              Dashboard
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

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-5 max-w-6xl mx-auto">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
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
            className={`flex items-center gap-1.5 rounded-xl border bg-white dark:bg-gray-900 text-sm px-3 py-2 transition-colors ${
              showArchived
                ? "border-gray-400 dark:border-gray-500 text-gray-700 dark:text-gray-300 font-medium"
                : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400"
            }`}
            title={showArchived ? "Hide archived deals" : "Show archived deals"}
          >
            <ArchiveIcon size={13} className="text-gray-400 dark:text-gray-500" />
            {showArchived ? "Showing archived" : "Show archived"}
          </button>
          {(search || typeFilter.length > 0 || memberFilter) && (
            <button
              onClick={() => {
                setSearch("");
                setTypeFilter([]);
                setMemberFilter("");
              }}
              className="text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 px-2 py-1"
            >
              Clear filters
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={24} className="animate-spin text-gray-400 dark:text-gray-500" />
          </div>
        ) : (
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4 min-w-max items-start">
              {STAGE_GROUPS.map((group) => (
                <div
                  key={group.key}
                  className={`rounded-2xl p-1.5 ${
                    group.creative ? "bg-purple-50/60 dark:bg-purple-900/30 border border-purple-100 dark:border-purple-800" : "bg-transparent"
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
                    {group.note && (
                      <span
                        className={`text-[10px] font-medium ${
                          group.creative ? "text-purple-400" : "text-gray-400 dark:text-gray-500"
                        }`}
                      >
                        {group.note}
                      </span>
                    )}
                    <span className="flex-1 border-t border-dashed border-gray-200 dark:border-gray-700 ml-1" />
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
                            group.creative ? "bg-purple-100/40 dark:bg-purple-900/30" : "bg-gray-100/70 dark:bg-gray-800/70"
                          } ${
                            isOver && dropBlocked
                              ? "border-gray-300 dark:border-gray-600 ring-2 ring-gray-300/40 dark:ring-gray-600/40 opacity-60"
                              : isOver
                                ? "border-[#ffd700] ring-2 ring-[#ffd700]/30 bg-amber-50/60 dark:bg-amber-900/30"
                                : isFocused
                                  ? "border-[#ffd700]/50 ring-1 ring-[#ffd700]/20"
                                  : group.creative
                                    ? "border-purple-200/60 dark:border-purple-800/60"
                                    : "border-gray-200/60 dark:border-gray-700/60"
                          }`}
                        >
                          {/* Column header */}
                          <div className="px-3.5 pt-3.5 pb-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                              <span
                                className={`text-xs font-semibold uppercase tracking-wide ${
                                  group.creative ? "text-purple-800 dark:text-purple-300" : "text-gray-700 dark:text-gray-300"
                                }`}
                              >
                                {style.label}
                              </span>
                              <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-900 rounded-full px-1.5 py-0.5 border border-gray-200/60 dark:border-gray-700/60">
                                {stageDeals.length}
                              </span>
                            </div>
                            <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 tabular-nums">
                              {stageValue > 0 ? formatMoney(stageValue) : ""}
                            </span>
                          </div>

                          {/* Cards */}
                          <div className="px-2.5 pb-3 space-y-2 min-h-[140px]">
                            {stageDeals.length === 0 && (
                              <div
                                className={`rounded-xl border border-dashed py-6 text-center text-[11px] ${
                                  group.creative
                                    ? "border-purple-200/80 dark:border-purple-800/80 text-purple-300 dark:text-purple-400"
                                    : "border-gray-300/70 dark:border-gray-600/70 text-gray-400 dark:text-gray-500"
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
                                canArchive={canArchive}
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
        className={`flex items-center gap-1.5 rounded-xl border bg-white dark:bg-gray-900 text-sm px-3 py-2 transition-colors ${
          selected.length
            ? "border-[#ffd700] text-[var(--portal-commercial)] font-medium"
            : "border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
        }`}
      >
        {selected.length === 0
          ? "All types"
          : selected.length === 1
            ? TYPE_STYLES[selected[0]]?.label ?? selected[0]
            : `${selected.length} types`}
        <ChevronDown size={13} className="text-gray-400 dark:text-gray-500" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1.5 w-56 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg p-1.5">
            {DEAL_TYPE_OPTIONS.map((t) => (
              <label
                key={t}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(t)}
                  onChange={() => toggle(t)}
                  className="h-3.5 w-3.5 rounded border-gray-300 dark:border-gray-600 accent-[#ffd700]"
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
                className="w-full text-left text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 px-2.5 py-1.5 mt-0.5 border-t border-gray-50 dark:border-gray-800"
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
  canArchive,
  dragging,
  onArchive,
  onUnarchive,
  onDragStart,
  onDragEnd,
}: {
  deal: Deal;
  canArchive: boolean;
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
        className={`relative group/card bg-white dark:bg-gray-900 rounded-xl border shadow-sm p-3.5 transition-all duration-150 ${
          archived
            ? "border-gray-200/60 dark:border-gray-700/60 opacity-60 grayscale"
            : "border-gray-200/80 dark:border-gray-700/80 cursor-grab active:cursor-grabbing hover:shadow-md hover:-translate-y-0.5"
        } ${dragging ? "opacity-40 rotate-1 scale-[0.98]" : ""}`}
      >
        {/* Hover action: archive replaces delete everywhere (commercial/admin only) */}
        {!archived && canArchive && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onArchive();
            }}
            title="Archive deal"
            className="absolute top-2 right-2 p-1.5 rounded-lg text-gray-300 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 opacity-0 group-hover/card:opacity-100 transition-opacity"
          >
            <ArchiveIcon size={13} />
          </button>
        )}
        <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide truncate mb-1.5">
          {deal.client.name}
        </p>
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug line-clamp-2 mb-1.5">
          {deal.title}
        </p>
        <div className="flex flex-wrap items-center gap-1 mb-2">
          {archived && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
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
              deal.budgetLocked ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300" : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
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
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
              <Film size={10} /> In Production
            </span>
          )}
        </div>
        <p className="text-base font-bold text-gray-900 dark:text-gray-100 tabular-nums mb-2.5">
          {formatMoney(deal.value)}
        </p>
        <div className="flex items-center justify-between text-[11px] text-gray-400 dark:text-gray-500">
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
              className="flex items-center gap-1 truncate max-w-[90px] text-gray-500 dark:text-gray-400"
              title={`Assigned to ${deal.assignedTo.name}`}
            >
              <UserIcon size={11} />
              <span className="truncate">{deal.assignedTo.name.split(" ")[0]}</span>
            </span>
          )}
        </div>
        {archived && canArchive && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onUnarchive();
            }}
            className="mt-2.5 w-full flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <ArchiveRestore size={12} /> Unarchive
          </button>
        )}
      </div>
    </Link>
  );
}
