"use client";

import { useState, useEffect, useMemo, useRef, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Loader2, Search, ChevronDown, Archive as ArchiveIcon, ArchiveRestore, Table2 } from "lucide-react";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import {
  STAGE_ORDER,
  STAGE_STYLES,
  STAGE_GROUPS,
  stagesForDeal,
  WORKFLOW_STYLES,
  CREATIVE_STATUS_STYLES,
  normalizeStage,
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
import { useUser } from "@/components/user-context";
import { Avatar, Chips, Tag, pill } from "@/components/os";

// Production states worth flagging on a pipeline card.
const PRODUCTION_LABEL: Record<string, string> = {
  BRIEFED: "Briefed",
  PRE_PRODUCTION: "Pre-production",
  SHOOTING: "Shooting",
  POST_PRODUCTION: "Post-production",
  DELIVERED: "Delivered",
};

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

  const { user } = useUser();
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

  const totalValue = filtered.reduce((sum, d) => sum + (d.value ?? 0), 0);
  const ownerChip = memberFilter === "" ? "all" : user && memberFilter === user.id ? "mine" : "other";

  return (
    <div className="min-h-full">
      <div className="px-4 pb-20 pt-6 sm:px-8 lg:px-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-1.5 text-base text-muted-foreground">
              {filtered.length} {showArchived ? "deals" : "active"} · {formatMoney(totalValue)}
            </p>
            <h1 className="text-[28px] font-semibold leading-[1.1] tracking-[-0.015em] sm:text-4xl">Pipeline</h1>
          </div>
          <button type="button" onClick={() => setShowNewDeal(true)} className={pill("primary")}>
            <Plus strokeWidth={1.75} /> New deal
          </button>
        </div>

        {/* Filters — owners as chips (the board), everything else as pills on the same row */}
        <div className="my-6 flex flex-wrap items-center gap-2">
          <Chips
            label="Owner"
            value={ownerChip}
            onChange={(v) => setMemberFilter(v === "mine" && user ? user.id : v === "all" ? "" : memberFilter)}
            options={[
              { value: "all", label: "All owners" },
              ...(user ? [{ value: "mine" as const, label: "Mine" }] : []),
            ]}
            className="[&_button:not([aria-pressed=true])]:bg-surface"
          />
          <select
            value={ownerChip === "other" ? memberFilter : ""}
            onChange={(e) => setMemberFilter(e.target.value)}
            aria-label="Someone else's deals"
            className={`h-9 rounded-full border-0 px-4 text-sm font-medium outline-none ${ownerChip === "other" ? "bg-foreground text-background" : "bg-surface text-ink-2"}`}
          >
            <option value="">Someone else…</option>
            {users
              .filter((u) => u.id !== user?.id)
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
          </select>
          <TypeFilterDropdown selected={typeFilter} onChange={setTypeFilter} />
          <div className="relative">
            <Search size={16} strokeWidth={1.75} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search deals or clients"
              aria-label="Search deals or clients"
              className="h-9 w-56 rounded-full border-0 bg-surface pl-10 pr-4 text-sm outline-none placeholder:text-muted-foreground focus-visible:shadow-[0_0_0_3px_var(--focus)]"
            />
          </div>
          {(search || typeFilter.length > 0 || memberFilter) && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setTypeFilter([]);
                setMemberFilter("");
              }}
              className="px-2 text-sm font-semibold underline underline-offset-4 hover:text-brand"
            >
              Clear
            </button>
          )}
          <div className="ml-auto flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={showArchived}
              onClick={() => setShowArchived((v) => !v)}
              className={`inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium ${showArchived ? "bg-foreground text-background" : "bg-surface text-ink-2 hover:bg-surface-2"}`}
            >
              <ArchiveIcon size={16} strokeWidth={1.75} /> {showArchived ? "Showing archived" : "Archived"}
            </button>
            <Link href="/commercial" className="inline-flex h-9 items-center gap-2 rounded-full bg-surface px-4 text-sm font-medium text-ink-2 hover:bg-surface-2">
              <Table2 size={16} strokeWidth={1.75} /> Table view
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="overflow-x-auto pb-3">
            <div className="flex w-max items-start gap-6">
              {STAGE_GROUPS.map((group) => {
                const groupCount = group.stages.reduce((n, st) => n + (byStage.get(st)?.length ?? 0), 0);
                return (
                  <div key={group.key}>
                    <div className="mb-3 border-b-2 border-line px-1 pb-2 text-xs font-semibold text-muted-foreground">
                      {group.label} · {groupCount}
                      {group.note && <span className="font-normal"> · {group.note}</span>}
                    </div>

                    <div className="flex gap-3">
                      {group.stages.map((stage) => {
                        const style = STAGE_STYLES[stage];
                        const stageDeals = byStage.get(stage) ?? [];
                        const stageValue = stageDeals.reduce((sum, d) => sum + (d.value ?? 0), 0);
                        const isOver = dragOverStage === stage;
                        const isFocused = focusStage === stage;
                        const draggingDeal = draggingId ? deals.find((d) => d.id === draggingId) : null;
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
                            className={`flex min-h-[560px] w-[272px] shrink-0 flex-col gap-2 rounded-[20px] p-3 transition-[background-color,box-shadow,opacity] ${
                              isOver && dropBlocked
                                ? "bg-surface opacity-60"
                                : isOver
                                  ? "bg-accent shadow-[inset_0_0_0_2px_var(--primary)]"
                                  : isFocused
                                    ? "bg-surface shadow-[inset_0_0_0_2px_var(--primary)]"
                                    : "bg-surface"
                            }`}
                          >
                            <div className="flex items-baseline justify-between gap-2 px-1.5 pb-2 pt-1.5 text-sm">
                              <strong className="font-semibold">{style.label}</strong>
                              <span className="tabular-nums text-muted-foreground">
                                {stageDeals.length}
                                {stageValue > 0 ? ` · ${formatMoney(stageValue)}` : ""}
                              </span>
                            </div>

                            {stageDeals.length === 0 && (
                              <div className="rounded-2xl border border-dashed border-field/70 px-3 py-6 text-center text-[13px] text-muted-foreground">
                                {isOver && dropBlocked ? "This workflow skips this stage" : isOver ? "Drop here" : "No deals"}
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
                        );
                      })}
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
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-medium ${
          selected.length ? "bg-foreground text-background" : "bg-surface text-ink-2 hover:bg-surface-2"
        }`}
      >
        {selected.length === 0
          ? "All types"
          : selected.length === 1
            ? TYPE_STYLES[selected[0]]?.label ?? selected[0]
            : `${selected.length} types`}
        <ChevronDown size={14} strokeWidth={1.75} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 mt-2 w-60 rounded-[20px] bg-popover p-2 shadow-[0_1px_2px_rgba(11,18,32,0.08),0_24px_48px_-16px_rgba(11,18,32,0.24)]">
            {DEAL_TYPE_OPTIONS.map((t) => (
              <label key={t} className="flex min-h-10 cursor-pointer items-center gap-3 rounded-xl px-3 text-[15px] hover:bg-surface">
                <input type="checkbox" checked={selected.includes(t)} onChange={() => toggle(t)} className="size-4 accent-foreground" />
                {TYPE_STYLES[t].label}
              </label>
            ))}
            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="mt-1 w-full border-t border-line px-3 pb-1 pt-2.5 text-left text-sm font-semibold text-muted-foreground hover:text-foreground"
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
  const stageSince = deal.stageUpdatedAt ?? deal.createdAt;
  const daysInStage = differenceInCalendarDays(new Date(), parseISO(stageSince));
  const due = deal.dueDate ? parseISO(deal.dueDate) : null;
  const overdue = due ? differenceInCalendarDays(due, new Date()) < 0 : false;
  const workflow =
    WORKFLOW_STYLES[(deal.workflowType as WorkflowType) ?? "CREATIVE_BRIEF"] ?? WORKFLOW_STYLES.CREATIVE_BRIEF;
  const creativeStatus =
    deal.workflowType !== "SUPPLIED_ASSETS" && deal.creativeStatus ? CREATIVE_STATUS_STYLES[deal.creativeStatus] : null;
  const productionLabel = deal.production ? PRODUCTION_LABEL[deal.production.status] : null;
  const archived = Boolean(deal.archived);
  const types = dealTypesOf(deal);

  return (
    <Link href={`/commercial/deals/${deal.id}`} className="block rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground">
      <div
        draggable={!archived}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        title={types.length ? types.map((t) => TYPE_STYLES[t]?.label ?? t).join(", ") : undefined}
        className={`group/card relative flex flex-col gap-2.5 rounded-2xl bg-card p-4 shadow-[0_1px_2px_rgba(11,18,32,0.06)] transition-[box-shadow,opacity,transform] ${
          archived ? "opacity-60" : "cursor-grab hover:shadow-[0_0_0_1px_#CDD4DD] active:cursor-grabbing"
        } ${dragging ? "rotate-1 opacity-40" : ""}`}
      >
        {!archived && canArchive && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onArchive();
            }}
            aria-label={`Archive ${deal.title}`}
            title="Archive deal"
            className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-surface hover:text-foreground focus-visible:opacity-100 group-hover/card:opacity-100"
          >
            <ArchiveIcon size={15} strokeWidth={1.75} />
          </button>
        )}
        <div>
          <div className="line-clamp-2 pr-6 font-semibold leading-snug">{deal.title}</div>
          <div className="mt-0.5 truncate text-sm text-muted-foreground">
            {deal.client.name}
            {deal.workflowType && deal.workflowType !== "CREATIVE_BRIEF" ? ` · ${workflow.label}` : ""}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold tabular-nums">{formatMoney(deal.value)}</span>
          {deal.assignedTo ? (
            <span title={`Owner: ${deal.assignedTo.name}`}>
              <Avatar name={deal.assignedTo.name} size={28} />
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">No owner</span>
          )}
        </div>
        {(archived || overdue || daysInStage >= 14 || productionLabel || creativeStatus) && (
          <div className="flex flex-wrap gap-1.5">
            {archived && <Tag tone="neutral">Archived</Tag>}
            {overdue && due && <Tag tone="bad">Overdue · {format(due, "d MMM")}</Tag>}
            {!archived && daysInStage >= 14 && <Tag tone="warn">{daysInStage} days in stage</Tag>}
            {productionLabel && <Tag tone="info">{productionLabel}</Tag>}
            {creativeStatus && !deal.production && <Tag tone="neutral">{creativeStatus.label}</Tag>}
          </div>
        )}
        {archived && canArchive && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onUnarchive();
            }}
            className={`${pill("outline", "sm")} w-full`}
          >
            <ArchiveRestore strokeWidth={1.75} /> Unarchive
          </button>
        )}
      </div>
    </Link>
  );
}
