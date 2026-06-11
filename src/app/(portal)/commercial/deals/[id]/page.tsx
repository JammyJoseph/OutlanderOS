"use client";

import { useState, useEffect, useCallback, useRef, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Loader2,
  ArrowLeft,
  Rocket,
  X,
  Plus,
  Trash2,
  CalendarDays,
  User as UserIcon,
  Film,
  Banknote,
  CheckCircle2,
  Sparkles,
  ArrowRightLeft,
  PenLine,
  PackageCheck,
  Activity as ActivityIcon,
  ArrowUpRight,
  Newspaper,
  FileText,
  Send,
  Lock as LockIcon,
} from "lucide-react";
import { format, parseISO, formatDistanceToNow, differenceInCalendarDays } from "date-fns";
import {
  STAGE_ORDER,
  STAGE_STYLES,
  typeStyle,
  formatMoney,
  dealTypesOf,
  isProductionDeal,
  DEAL_TYPE_OPTIONS,
  TYPE_STYLES,
  BRIEF_STATUS_STYLES,
  type DealStage,
} from "../../_components/deal-ui";
import { ActionTrackPanel } from "@/components/tasks/ActionTrackPanel";

interface Deliverable {
  id: string;
  type: string;
  description: string | null;
  dueDate: string | null;
  status: string;
}

interface ActivityEntry {
  id: string;
  type: string;
  message: string;
  userName: string | null;
  createdAt: string;
  meta?: { from?: string; to?: string } | null;
}

interface DealDetail {
  id: string;
  title: string;
  type: string;
  dealTypes: string[];
  briefContent: string | null;
  briefDueDate: string | null;
  briefStatus: string;
  stage: DealStage;
  stageUpdatedAt: string | null;
  value: number | null;
  currency: string;
  description: string | null;
  notes: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  budgetBreakdown: { category: string; amount: number }[] | null;
  client: { id: string; name: string; industry: string | null; brandColor: string | null };
  assignedTo: { id: string; name: string } | null;
  billingContact: { id: string; name: string; email: string | null; phone: string | null } | null;
  production: {
    id: string;
    status: string;
    title: string;
    budgetTotal: number | null;
    shootDates: string[];
    _count?: { teamMembers: number };
  } | null;
  financeBudget: { id: string; status: string; totalBudget: number } | null;
  deliverables: Deliverable[];
  activities: ActivityEntry[];
}

const PRODUCTION_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Planning",
  BRIEFED: "Briefed",
  PRE_PRODUCTION: "Pre-Production",
  SHOOTING: "Shooting",
  POST_PRODUCTION: "Wrap",
  DELIVERED: "Complete",
  ARCHIVED: "Archived",
};

interface TeamMember {
  id: string;
  name: string;
}

interface ClientOption {
  id: string;
  name: string;
}

type Tab = "overview" | "brief" | "budget" | "deliverables" | "tasks" | "activity";

const WON_STAGES: DealStage[] = ["CONTRACTED", "LIVE", "COMPLETED", "PAID"];

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  created: <Sparkles size={13} />,
  stage_change: <ArrowRightLeft size={13} />,
  budget_update: <Banknote size={13} />,
  field_update: <PenLine size={13} />,
  note: <PenLine size={13} />,
  deliverable: <PackageCheck size={13} />,
  project_started: <Rocket size={13} />,
};

export default function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [deal, setDeal] = useState<DealDetail | null>(null);
  const [users, setUsers] = useState<TeamMember[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [showStartProject, setShowStartProject] = useState(false);
  const [showClearProduction, setShowClearProduction] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reload = useCallback(async () => {
    const res = await fetch(`/api/campaigns/${id}`);
    if (!res.ok) {
      setNotFound(true);
      return;
    }
    const data = await res.json();
    setDeal(data);
  }, [id]);

  useEffect(() => {
    Promise.all([
      reload(),
      fetch("/api/users")
        .then((r) => r.json())
        .then((u) => setUsers(Array.isArray(u) ? u : [])),
      fetch("/api/clients")
        .then((r) => r.json())
        .then((c) => setClients(Array.isArray(c) ? c : [])),
    ]).finally(() => setLoading(false));
  }, [reload]);

  function flashSaved() {
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 2000);
  }

  const patchDeal = useCallback(
    async (data: Record<string, unknown>) => {
      // Optimistic local merge for instant feedback; reload syncs the truth.
      setDeal((prev) => (prev ? ({ ...prev, ...data } as DealDetail) : prev));
      const res = await fetch(`/api/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        await reload();
        flashSaved();
      } else {
        await reload(); // roll back the optimistic merge
      }
    },
    [id, reload]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (notFound || !deal) {
    return (
      <div className="flex min-h-full items-center justify-center px-6 py-24">
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-800">Deal not found</p>
          <Link
            href="/commercial/pipeline"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-[#D4A853] hover:text-[#c49843]"
          >
            <ArrowLeft size={14} /> Back to pipeline
          </Link>
        </div>
      </div>
    );
  }

  const stage = STAGE_STYLES[deal.stage] ?? STAGE_STYLES.LEAD;
  const types = dealTypesOf(deal);
  const productionDeal = isProductionDeal(deal);
  const stageWon = WON_STAGES.includes(deal.stage);
  const projectStarted = Boolean(deal.production);
  const canClearProduction = productionDeal && stageWon && !projectStarted;
  const canStartFinance = !productionDeal && stageWon && !projectStarted && !deal.financeBudget;
  // Advertorials and print deliverables live in the magazine planning sheet too.
  const printRelated =
    types.includes("ADVERTORIAL") ||
    types.includes("PRINT_AD") ||
    deal.deliverables.some((d) =>
      /print|magazine|advertorial|flat\s*plan/i.test(`${d.type} ${d.description ?? ""}`)
    );

  const TABS: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    ...(productionDeal ? [{ key: "brief" as Tab, label: "Brief" }] : []),
    { key: "budget", label: "Budget" },
    { key: "deliverables", label: `Deliverables (${deal.deliverables.length})` },
    { key: "tasks", label: "Tasks" },
    { key: "activity", label: "Activity" },
  ];

  return (
    <div className="min-h-screen bg-[#F9F9F7]">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Breadcrumb + saved indicator */}
        <div className="flex items-center justify-between mb-4">
          <Link
            href="/commercial/pipeline"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ArrowLeft size={13} /> Pipeline
          </Link>
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium text-emerald-600 transition-opacity duration-300 ${
              saved ? "opacity-100" : "opacity-0"
            }`}
          >
            <CheckCircle2 size={13} /> Saved
          </span>
        </div>

        {/* Header */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-5">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span
                  className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${stage.bg} ${stage.text}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${stage.dot}`} />
                  {stage.label}
                </span>
                {projectStarted && (
                  <Link
                    href={`/production/${deal.production!.id}`}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors"
                  >
                    <Film size={11} /> In Production: {deal.production!.title}{" "}
                    <ArrowUpRight size={11} />
                  </Link>
                )}
                {productionDeal && !projectStarted && deal.briefContent && (
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full ${BRIEF_STATUS_STYLES[deal.briefStatus]?.bg ?? "bg-gray-100"} ${BRIEF_STATUS_STYLES[deal.briefStatus]?.text ?? "text-gray-600"}`}
                  >
                    <FileText size={11} />{" "}
                    {BRIEF_STATUS_STYLES[deal.briefStatus]?.label ?? deal.briefStatus}
                  </span>
                )}
                {deal.financeBudget && (
                  <Link
                    href={`/finance?tab=projects&project=${deal.financeBudget.id}`}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                  >
                    <Banknote size={11} /> Finance: View project P&amp;L <ArrowUpRight size={11} />
                  </Link>
                )}
                {printRelated && (
                  <Link
                    href="/print"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-teal-50 text-[#1D9E75] hover:bg-teal-100 transition-colors"
                  >
                    <Newspaper size={11} /> Print: View in magazine planning{" "}
                    <ArrowUpRight size={11} />
                  </Link>
                )}
              </div>
              <EditableTitle title={deal.title} onSave={(t) => patchDeal({ title: t })} />
              <p className="text-sm text-gray-500 mt-0.5">{deal.client.name}</p>
              <div className="mt-3">
                <TypePills
                  types={types}
                  onChange={(next) => patchDeal({ dealTypes: next })}
                />
              </div>
            </div>

            <div className="flex flex-col items-end gap-3 shrink-0">
              <EditableValue value={deal.value} onSave={(v) => patchDeal({ value: v })} />
              {canClearProduction && (
                <button
                  onClick={() => setShowClearProduction(true)}
                  className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
                >
                  <CheckCircle2 size={15} />
                  Clear for Production
                </button>
              )}
              {canStartFinance && (
                <button
                  onClick={() => setShowStartProject(true)}
                  className="flex items-center gap-2 bg-[#D4A853] text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-[#c49843] transition-colors shadow-sm"
                >
                  <Rocket size={15} />
                  Start Project
                </button>
              )}
            </div>
          </div>

          {/* Inline editable controls */}
          <div className="mt-5 pt-5 border-t border-gray-50 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <HeaderField label="Stage">
              <select
                value={deal.stage}
                onChange={(e) => patchDeal({ stage: e.target.value })}
                className="w-full text-sm font-medium text-gray-800 bg-transparent focus:outline-none cursor-pointer"
              >
                {STAGE_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {STAGE_STYLES[s].label}
                  </option>
                ))}
              </select>
            </HeaderField>
            <HeaderField label="Client">
              <select
                value={deal.client.id}
                onChange={(e) => patchDeal({ clientId: e.target.value })}
                className="w-full text-sm font-medium text-gray-800 bg-transparent focus:outline-none cursor-pointer"
              >
                {!clients.some((c) => c.id === deal.client.id) && (
                  <option value={deal.client.id}>{deal.client.name}</option>
                )}
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </HeaderField>
            <HeaderField label="Assigned To">
              <select
                value={deal.assignedTo?.id ?? ""}
                onChange={(e) => patchDeal({ assignedToId: e.target.value || null })}
                className="w-full text-sm font-medium text-gray-800 bg-transparent focus:outline-none cursor-pointer"
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </HeaderField>
            <HeaderField label="Due Date">
              <input
                type="date"
                value={deal.dueDate ? deal.dueDate.slice(0, 10) : ""}
                onChange={(e) => patchDeal({ dueDate: e.target.value || null })}
                className="w-full text-sm font-medium text-gray-800 bg-transparent focus:outline-none cursor-pointer"
              />
            </HeaderField>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-5 bg-white rounded-xl border border-gray-100 shadow-sm p-1 w-fit">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t.key
                  ? "bg-[#D4A853]/10 text-[#9C7424]"
                  : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "overview" && <OverviewTab deal={deal} onPatch={patchDeal} />}
        {tab === "brief" && <BriefTab deal={deal} onPatch={patchDeal} />}
        {tab === "budget" && <BudgetTab dealId={deal.id} dealValue={deal.value} onSaved={reload} />}
        {tab === "deliverables" && (
          <DeliverablesTab dealId={deal.id} initial={deal.deliverables} onChanged={reload} />
        )}
        {tab === "tasks" && <ActionTrackPanel projectId={deal.id} />}
        {tab === "activity" && <ActivityTab activities={deal.activities} />}
      </div>

      {showStartProject && (
        <StartProjectModal
          deal={deal}
          onClose={() => setShowStartProject(false)}
          onDone={reload}
        />
      )}
      {showClearProduction && (
        <ClearForProductionModal
          deal={deal}
          onClose={() => setShowClearProduction(false)}
          onDone={reload}
        />
      )}
    </div>
  );
}

function HeaderField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/50 px-3 py-2">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
        {label}
      </p>
      {children}
    </div>
  );
}

// ─── Inline editable title + value ───────────────────────────────────────────

function EditableTitle({ title, onSave }: { title: string; onSave: (t: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);

  useEffect(() => setDraft(title), [title]);

  function commit() {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== title) onSave(next);
    else setDraft(title);
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(title);
            setEditing(false);
          }
        }}
        className="w-full text-2xl font-semibold text-gray-900 tracking-tight bg-transparent border-b-2 border-[#D4A853] focus:outline-none"
      />
    );
  }
  return (
    <h1
      onClick={() => setEditing(true)}
      title="Click to edit title"
      className="text-2xl font-semibold text-gray-900 tracking-tight cursor-text rounded-lg -mx-1 px-1 hover:bg-amber-50/60 transition-colors"
    >
      {title}
    </h1>
  );
}

function EditableValue({
  value,
  onSave,
}: {
  value: number | null;
  onSave: (v: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value != null ? String(value) : "");

  useEffect(() => setDraft(value != null ? String(value) : ""), [value]);

  function commit() {
    setEditing(false);
    const next = draft.trim() === "" ? null : Number(draft);
    if (next !== value && (next === null || !Number.isNaN(next))) onSave(next);
    else setDraft(value != null ? String(value) : "");
  }

  if (editing) {
    return (
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg text-gray-400">£</span>
        <input
          autoFocus
          type="number"
          min="0"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setDraft(value != null ? String(value) : "");
              setEditing(false);
            }
          }}
          className="w-44 pl-8 pr-3 py-1.5 text-2xl font-bold text-gray-900 tabular-nums rounded-xl border-2 border-[#D4A853] focus:outline-none"
        />
      </div>
    );
  }
  return (
    <p
      onClick={() => setEditing(true)}
      title="Click to edit value"
      className="text-3xl font-bold text-gray-900 tabular-nums cursor-text rounded-lg px-1 hover:bg-amber-50/60 transition-colors"
    >
      {formatMoney(value)}
    </p>
  );
}

// ─── Editable type pills ──────────────────────────────────────────────────────

function TypePills({
  types,
  onChange,
}: {
  types: string[];
  onChange: (types: string[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const remaining = DEAL_TYPE_OPTIONS.filter((t) => !types.includes(t));

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {types.map((t) => {
        const style = typeStyle(t);
        return (
          <span
            key={t}
            className={`inline-flex items-center gap-1 text-[11px] font-semibold pl-2.5 pr-1 py-1 rounded-full ${style.bg} ${style.text} group`}
          >
            {style.label}
            <button
              onClick={() => {
                if (types.length <= 1) return; // a deal always keeps at least one type
                onChange(types.filter((x) => x !== t));
              }}
              title={types.length <= 1 ? "A deal needs at least one type" : "Remove type"}
              className={`rounded-full p-0.5 transition-colors ${
                types.length <= 1
                  ? "opacity-30 cursor-not-allowed"
                  : "hover:bg-black/10 opacity-60 hover:opacity-100"
              }`}
            >
              <X size={11} />
            </button>
          </span>
        );
      })}
      {remaining.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setAdding((a) => !a)}
            title="Add type"
            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full border border-dashed border-gray-300 text-gray-400 hover:border-[#D4A853] hover:text-[#9C7424] transition-colors"
          >
            <Plus size={11} /> Add
          </button>
          {adding && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setAdding(false)} />
              <div className="absolute z-20 mt-1.5 w-52 rounded-xl border border-gray-100 bg-white shadow-lg p-1.5">
                {remaining.map((t) => {
                  const style = TYPE_STYLES[t];
                  return (
                    <button
                      key={t}
                      onClick={() => {
                        onChange([...types, t]);
                        setAdding(false);
                      }}
                      className="flex w-full items-center rounded-lg px-2.5 py-1.5 hover:bg-gray-50 transition-colors"
                    >
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}
                      >
                        {style.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Overview tab ─────────────────────────────────────────────────────────────

function OverviewTab({
  deal,
  onPatch,
}: {
  deal: DealDetail;
  onPatch: (data: Record<string, unknown>) => Promise<void>;
}) {
  const [notes, setNotes] = useState(deal.notes ?? "");
  const [description, setDescription] = useState(deal.description ?? "");
  const [saving, setSaving] = useState(false);

  const stageHistory = deal.activities.filter((a) => a.type === "stage_change").slice(0, 8);

  async function saveNotes() {
    if (notes === (deal.notes ?? "")) return;
    setSaving(true);
    await onPatch({ notes });
    setSaving(false);
  }

  async function saveDescription() {
    if (description === (deal.description ?? "")) return;
    setSaving(true);
    await onPatch({ description: description || null });
    setSaving(false);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 space-y-5">
        {/* Description */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">Description</h3>
            {saving && <Loader2 size={13} className="animate-spin text-gray-400" />}
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={saveDescription}
            rows={4}
            placeholder="What's the deal? Scope, deliverables, context — saved automatically when you click away…"
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853]"
          />
        </div>

        {/* Notes */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">Notes</h3>
            {saving && <Loader2 size={13} className="animate-spin text-gray-400" />}
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveNotes}
            rows={6}
            placeholder="Internal notes — saved automatically when you click away…"
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853]"
          />
        </div>
      </div>

      <div className="space-y-5">
        {/* Production — appears once the deal is cleared for production */}
        {deal.production && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Film size={15} className="text-[#E24B4A]" />
              Production
            </h3>
            <Link
              href={`/production/${deal.production.id}`}
              className="text-sm font-semibold text-gray-900 hover:text-[#E24B4A] transition-colors"
            >
              {deal.production.title}
            </Link>
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-[11px] font-medium text-gray-600">
                {PRODUCTION_STATUS_LABELS[deal.production.status] ?? deal.production.status}
              </span>
              <span className="text-xs text-gray-500">
                {deal.production._count?.teamMembers ?? 0} crew
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-2 flex items-center gap-1.5">
              <CalendarDays size={12} className="text-gray-400" />
              {deal.production.shootDates.length > 0
                ? deal.production.shootDates
                    .map((d) => format(parseISO(d), "d MMM"))
                    .join(" · ")
                : "No shoot dates yet"}
            </p>
            <Link
              href={`/production/${deal.production.id}`}
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#E24B4A] hover:text-red-600 transition-colors"
            >
              Open in Production <ArrowUpRight size={12} />
            </Link>
          </div>
        )}

        {/* Dates */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Dates</h3>
          <dl className="space-y-2.5 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-gray-400 flex items-center gap-1.5">
                <CalendarDays size={13} /> Created
              </dt>
              <dd className="font-medium text-gray-700">
                {format(parseISO(deal.createdAt), "d MMM yyyy")}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-400 flex items-center gap-1.5">
                <CalendarDays size={13} /> Due
              </dt>
              <dd className="font-medium text-gray-700">
                {deal.dueDate ? format(parseISO(deal.dueDate), "d MMM yyyy") : "—"}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-400 flex items-center gap-1.5">
                <ArrowRightLeft size={13} /> In stage since
              </dt>
              <dd className="font-medium text-gray-700">
                {format(parseISO(deal.stageUpdatedAt ?? deal.createdAt), "d MMM yyyy")}
              </dd>
            </div>
          </dl>

          {stageHistory.length > 0 && (
            <>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mt-4 mb-2">
                Stage history
              </p>
              <div className="space-y-1.5">
                {stageHistory.map((a) => (
                  <div key={a.id} className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">
                      {a.meta?.from && a.meta?.to ? (
                        <>
                          {STAGE_STYLES[a.meta.from as DealStage]?.label ?? a.meta.from}
                          {" → "}
                          <span className="font-semibold">
                            {STAGE_STYLES[a.meta.to as DealStage]?.label ?? a.meta.to}
                          </span>
                        </>
                      ) : (
                        a.message
                      )}
                    </span>
                    <span className="text-gray-400 shrink-0 ml-2">
                      {format(parseISO(a.createdAt), "d MMM")}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Client */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Client</h3>
          <Link
            href={`/commercial/clients/${deal.client.id}`}
            className="text-sm font-semibold text-gray-900 hover:text-[#D4A853] transition-colors"
          >
            {deal.client.name}
          </Link>
          {deal.client.industry && (
            <p className="text-xs text-gray-400 mt-0.5">{deal.client.industry}</p>
          )}
          {deal.billingContact ? (
            <div className="mt-3 pt-3 border-t border-gray-50 text-sm space-y-1">
              <p className="font-medium text-gray-700 flex items-center gap-1.5">
                <UserIcon size={13} className="text-gray-400" />
                {deal.billingContact.name}
              </p>
              {deal.billingContact.email && (
                <p className="text-xs text-gray-500">{deal.billingContact.email}</p>
              )}
              {deal.billingContact.phone && (
                <p className="text-xs text-gray-500">{deal.billingContact.phone}</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-50">
              No billing contact linked.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Creative Brief tab ───────────────────────────────────────────────────────

function BriefTab({
  deal,
  onPatch,
}: {
  deal: DealDetail;
  onPatch: (data: Record<string, unknown>) => Promise<void>;
}) {
  const [content, setContent] = useState(deal.briefContent ?? "");
  const [saving, setSaving] = useState(false);

  const sent = deal.briefStatus === "SENT_TO_PRODUCTION";
  const statusStyle = BRIEF_STATUS_STYLES[deal.briefStatus] ?? BRIEF_STATUS_STYLES.DRAFT;

  const due = deal.briefDueDate ? parseISO(deal.briefDueDate) : null;
  const dueDays = due ? differenceInCalendarDays(due, new Date()) : null;
  const dueLabel =
    dueDays === null
      ? null
      : dueDays < 0
        ? `${Math.abs(dueDays)} day${Math.abs(dueDays) === 1 ? "" : "s"} overdue`
        : dueDays === 0
          ? "due today"
          : `due in ${dueDays} day${dueDays === 1 ? "" : "s"}`;

  async function saveContent() {
    if (content === (deal.briefContent ?? "")) return;
    setSaving(true);
    await onPatch({ briefContent: content || null });
    setSaving(false);
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 max-w-3xl">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
        <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <FileText size={15} className="text-[#D4A853]" />
          Creative Brief
        </h3>
        <div className="flex items-center gap-2.5">
          {saving && <Loader2 size={13} className="animate-spin text-gray-400" />}
          {sent ? (
            <span
              className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${statusStyle.bg} ${statusStyle.text}`}
            >
              <CheckCircle2 size={12} /> Sent to Production
            </span>
          ) : (
            <select
              value={deal.briefStatus}
              onChange={(e) => onPatch({ briefStatus: e.target.value })}
              className={`text-[11px] font-semibold rounded-full px-2.5 py-1 cursor-pointer focus:outline-none ${statusStyle.bg} ${statusStyle.text}`}
              title="Brief status"
            >
              <option value="DRAFT">Draft</option>
              <option value="READY">Ready</option>
            </select>
          )}
        </div>
      </div>
      <p className="text-xs text-gray-400 mb-5">
        What needs to be produced, requirements, references — this goes to the production team.
      </p>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onBlur={saveContent}
        rows={12}
        placeholder={
          "Write the creative brief here — saved automatically when you click away.\n\n• What are we making?\n• Key requirements & deliverables\n• References / mood\n• Anything the production team must know"
        }
        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853]"
      />

      <div className="mt-5 pt-4 border-t border-gray-100 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
            Brief due to production
          </p>
          <div className="flex items-center gap-2.5">
            <input
              type="date"
              value={deal.briefDueDate ? deal.briefDueDate.slice(0, 10) : ""}
              onChange={(e) => onPatch({ briefDueDate: e.target.value || null })}
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853]"
            />
            {dueLabel && (
              <span
                className={`text-xs font-semibold ${
                  dueDays !== null && dueDays < 0
                    ? "text-red-500"
                    : dueDays !== null && dueDays <= 3
                      ? "text-amber-600"
                      : "text-gray-500"
                }`}
              >
                {dueLabel}
              </span>
            )}
          </div>
        </div>

        {!sent && (
          <button
            onClick={() => onPatch({ briefStatus: "SENT_TO_PRODUCTION" })}
            disabled={!content.trim()}
            title={content.trim() ? "Mark the brief as sent to production" : "Write the brief first"}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={14} />
            Send to Production
          </button>
        )}
        {sent && deal.production && (
          <Link
            href={`/production/${deal.production.id}`}
            className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:text-emerald-800"
          >
            View in Production <ArrowUpRight size={14} />
          </Link>
        )}
      </div>
    </div>
  );
}

// ─── Budget tab — deal economics: total, margin, allocations, lock ───────────

interface AllocationDraft {
  name: string;
  amount: string;
  isProductionBudget: boolean;
}

function compactGBP(n: number): string {
  if (Math.abs(n) >= 1000 && Math.abs(n) % 1000 < 50) return `£${Math.round(n / 1000)}K`;
  return `£${n.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
}

function BudgetTab({
  dealId,
  dealValue,
  onSaved,
}: {
  dealId: string;
  dealValue: number | null;
  onSaved: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [totalBudget, setTotalBudget] = useState("");
  const [marginPct, setMarginPct] = useState("");
  const [marginAmt, setMarginAmt] = useState("");
  const [allocations, setAllocations] = useState<AllocationDraft[]>([]);
  const [locked, setLocked] = useState(false);
  const [lockedAt, setLockedAt] = useState<string | null>(null);
  const [lockedByName, setLockedByName] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLockConfirm, setShowLockConfirm] = useState(false);
  const [showUnlockConfirm, setShowUnlockConfirm] = useState(false);
  const [lockBusy, setLockBusy] = useState(false);

  const load = useCallback(async () => {
    const d = await fetch(`/api/commercial/deals/${dealId}/budget`).then((r) => r.json());
    setTotalBudget(d.value != null ? String(d.value) : "");
    setMarginPct(d.marginPercent != null ? String(d.marginPercent) : "");
    setMarginAmt(d.marginAmount != null ? String(d.marginAmount) : "");
    const loaded = (d.allocations ?? []) as {
      name: string;
      amount: number;
      isProductionBudget: boolean;
    }[];
    setAllocations(
      loaded.length
        ? loaded.map((a) => ({
            name: a.name,
            amount: String(a.amount),
            isProductionBudget: a.isProductionBudget,
          }))
        : [{ name: "Production", amount: "", isProductionBudget: true }]
    );
    setLocked(Boolean(d.budgetLocked));
    setLockedAt(d.budgetLockedAt ?? null);
    setLockedByName(d.lockedByName ?? null);
  }, [dealId]);

  useEffect(() => {
    Promise.all([
      load(),
      fetch("/api/me")
        .then((r) => r.json())
        .then((d) => setIsAdmin(d.user?.role === "ADMIN"))
        .catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [load]);

  const total = Number(totalBudget) || 0;
  const margin = Number(marginAmt) || 0;
  const allocated = allocations.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
  const remaining = total - margin - allocated;
  const balanced = total > 0 && Math.abs(remaining) < 0.01;
  const productionAllocations = allocations.filter(
    (a) => a.isProductionBudget && (Number(a.amount) || 0) > 0
  );
  const productionTotal = productionAllocations.reduce((s, a) => s + (Number(a.amount) || 0), 0);

  // Dual margin entry: % drives £ and vice versa.
  function onMarginPct(v: string) {
    setMarginPct(v);
    const pct = Number(v);
    if (v !== "" && !Number.isNaN(pct) && total > 0) {
      setMarginAmt(String(Math.round((total * pct) / 100 * 100) / 100));
    }
  }
  function onMarginAmt(v: string) {
    setMarginAmt(v);
    const amt = Number(v);
    if (v !== "" && !Number.isNaN(amt) && total > 0) {
      setMarginPct(String(Math.round((amt / total) * 100 * 10) / 10));
    }
  }
  function onTotalBudget(v: string) {
    setTotalBudget(v);
    const t = Number(v);
    const pct = Number(marginPct);
    // Keep the % fixed and re-derive the £ when the total changes.
    if (marginPct !== "" && !Number.isNaN(pct) && t > 0) {
      setMarginAmt(String(Math.round((t * pct) / 100 * 100) / 100));
    }
  }

  async function save(): Promise<boolean> {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/commercial/deals/${dealId}/budget`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalBudget: totalBudget === "" ? null : Number(totalBudget),
          marginPercent: marginPct === "" ? null : Number(marginPct),
          marginAmount: marginAmt === "" ? null : Number(marginAmt),
          allocations: allocations
            .filter((a) => a.name.trim())
            .map((a) => ({
              name: a.name.trim(),
              amount: Number(a.amount) || 0,
              isProductionBudget: a.isProductionBudget,
            })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save budget");
        return false;
      }
      setSavedAt(Date.now());
      await onSaved();
      return true;
    } finally {
      setSaving(false);
    }
  }

  async function setLock(nextLocked: boolean) {
    setLockBusy(true);
    setError(null);
    try {
      if (nextLocked) {
        const ok = await save();
        if (!ok) return;
      }
      const res = await fetch(`/api/commercial/deals/${dealId}/budget/lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locked: nextLocked }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to update lock");
        return;
      }
      setShowLockConfirm(false);
      setShowUnlockConfirm(false);
      await load();
      await onSaved();
    } finally {
      setLockBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={20} className="animate-spin text-gray-400" />
      </div>
    );
  }

  const inputCls =
    "px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853] disabled:bg-gray-50 disabled:text-gray-500";

  // Locked summary pieces: "Margin: £30K (30%) | Production: £50K | Media: £20K | Total: £100K"
  const summaryParts = [
    `Margin: ${compactGBP(margin)}${marginPct !== "" ? ` (${Number(marginPct)}%)` : ""}`,
    ...allocations
      .filter((a) => a.name.trim() && (Number(a.amount) || 0) > 0)
      .map((a) => `${a.name.trim()}: ${compactGBP(Number(a.amount) || 0)}`),
    `Total: ${compactGBP(total)}`,
  ];

  return (
    <div className="space-y-5 max-w-2xl">
      {locked && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm font-semibold text-emerald-800 flex items-center gap-2">
              <LockIcon size={14} /> Budget locked
              {lockedAt && (
                <span className="font-normal text-emerald-600 text-xs">
                  {lockedByName ? `by ${lockedByName} ` : ""}on{" "}
                  {format(parseISO(lockedAt), "d MMM yyyy")}
                </span>
              )}
            </p>
            {isAdmin && (
              <button
                onClick={() => setShowUnlockConfirm(true)}
                className="text-xs font-medium text-emerald-700 hover:text-emerald-900 underline underline-offset-2"
              >
                Unlock (admin)
              </button>
            )}
          </div>
          <p className="text-sm text-emerald-700 mt-1.5 font-medium tabular-nums">
            {summaryParts.join(" | ")}
          </p>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <Banknote size={15} className="text-[#D4A853]" />
            Deal Economics
          </h3>
          {savedAt && !saving && !locked && (
            <span className="text-xs text-emerald-600 flex items-center gap-1">
              <CheckCircle2 size={13} /> Saved
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 mb-5">
          Total budget, company margin, and where the rest goes. The production allocation flows to
          the Production team; everything flows to Finance.
        </p>

        {/* Total deal budget */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
              Total Deal Budget
            </p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                £
              </span>
              <input
                type="number"
                min="0"
                value={totalBudget}
                onChange={(e) => onTotalBudget(e.target.value)}
                disabled={locked}
                placeholder={dealValue != null ? String(dealValue) : "0"}
                className={`${inputCls} w-full pl-7 font-semibold`}
              />
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
              Company Margin (%)
            </p>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={marginPct}
                onChange={(e) => onMarginPct(e.target.value)}
                disabled={locked}
                placeholder="0"
                className={`${inputCls} w-full pr-7`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                %
              </span>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
              Company Margin (£)
            </p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                £
              </span>
              <input
                type="number"
                min="0"
                value={marginAmt}
                onChange={(e) => onMarginAmt(e.target.value)}
                disabled={locked}
                placeholder="0"
                className={`${inputCls} w-full pl-7`}
              />
            </div>
          </div>
        </div>

        {/* Allocations */}
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
          Budget Allocations
        </p>
        <p className="text-[11px] text-gray-400 mb-3">
          Where the money after margin goes. Tick the allocation that is the production budget —
          that amount is handed to the Production team.
        </p>
        <div className="space-y-2">
          {allocations.map((a, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={a.name}
                onChange={(e) =>
                  setAllocations((prev) =>
                    prev.map((x, j) => (j === i ? { ...x, name: e.target.value } : x))
                  )
                }
                disabled={locked}
                placeholder="Allocation (e.g. Media Spend, Production, Travel)"
                className={`${inputCls} flex-1`}
              />
              <div className="relative w-36">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                  £
                </span>
                <input
                  type="number"
                  min="0"
                  value={a.amount}
                  onChange={(e) =>
                    setAllocations((prev) =>
                      prev.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x))
                    )
                  }
                  disabled={locked}
                  placeholder="0"
                  className={`${inputCls} w-full pl-7`}
                />
              </div>
              <button
                onClick={() =>
                  setAllocations((prev) =>
                    prev.map((x, j) => ({ ...x, isProductionBudget: j === i ? !x.isProductionBudget : false }))
                  )
                }
                disabled={locked}
                title={
                  a.isProductionBudget
                    ? "This is the production budget — sent to the Production team"
                    : "Mark as the production budget"
                }
                className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1.5 rounded-lg border transition-colors disabled:cursor-not-allowed ${
                  a.isProductionBudget
                    ? "bg-red-50 border-red-200 text-[#E24B4A]"
                    : "bg-white border-gray-200 text-gray-400 hover:border-gray-300"
                }`}
              >
                <Film size={11} /> Production
              </button>
              <button
                onClick={() => setAllocations((prev) => prev.filter((_, j) => j !== i))}
                disabled={locked}
                className="p-2 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-300"
                title="Remove allocation"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        {!locked && (
          <button
            onClick={() =>
              setAllocations((prev) => [...prev, { name: "", amount: "", isProductionBudget: false }])
            }
            className="mt-3 flex items-center gap-1.5 text-xs font-medium text-[#D4A853] hover:text-[#c49843] transition-colors"
          >
            <Plus size={13} /> Add allocation
          </button>
        )}

        {/* Running totals */}
        <div className="mt-5 pt-4 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Margin</p>
            <p className="font-bold text-gray-900 tabular-nums">{formatMoney(margin)}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
              Allocated
            </p>
            <p className="font-bold text-gray-900 tabular-nums">{formatMoney(allocated)}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
              Margin + Allocated
            </p>
            <p className="font-bold text-gray-900 tabular-nums">{formatMoney(margin + allocated)}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
              Remaining to allocate
            </p>
            <p
              className={`font-bold tabular-nums ${
                remaining < -0.01 ? "text-red-500" : balanced ? "text-emerald-600" : "text-amber-600"
              }`}
            >
              {remaining < -0.01
                ? `${formatMoney(Math.abs(remaining))} over`
                : formatMoney(Math.max(remaining, 0))}
            </p>
          </div>
        </div>

        {remaining < -0.01 && (
          <p className="text-[11px] text-red-500 bg-red-50 rounded-lg px-3 py-2 mt-3">
            Over-allocated — margin + allocations exceed the total budget by{" "}
            {formatMoney(Math.abs(remaining))}.
          </p>
        )}
        {productionAllocations.length === 0 && allocated > 0 && (
          <p className="text-[11px] text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mt-3">
            No allocation is flagged as the production budget yet — the Production team won&apos;t
            receive an allocation.
          </p>
        )}
        {error && (
          <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2 mt-3">{error}</p>
        )}

        {!locked && (
          <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
            <button
              onClick={save}
              disabled={saving || lockBusy}
              className="flex items-center gap-2 border border-gray-200 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              Save Draft
            </button>
            <button
              onClick={() => setShowLockConfirm(true)}
              disabled={saving || lockBusy || !balanced}
              title={
                balanced
                  ? "Finalise and lock the budget"
                  : "Margin + allocations must equal the total budget before locking"
              }
              className="flex items-center gap-2 bg-[#D4A853] text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-[#c49843] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <LockIcon size={14} />
              Lock &amp; Submit
            </button>
          </div>
        )}
      </div>

      {/* Lock confirmation */}
      {showLockConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="border-b border-gray-50 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <LockIcon size={16} className="text-[#D4A853]" /> Lock budget?
              </h2>
              <button
                onClick={() => setShowLockConfirm(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-gray-600">
                The allocations become read-only and the production budget
                {productionTotal > 0 ? ` of ${formatMoney(productionTotal)}` : ""} is finalised for
                the Production team. Only an admin can unlock it afterwards.
              </p>
              <div className="mt-4 rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 text-sm font-medium text-gray-700 tabular-nums">
                {summaryParts.join(" | ")}
              </div>
              {error && (
                <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2 mt-3">{error}</p>
              )}
              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => setShowLockConfirm(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setLock(true)}
                  disabled={lockBusy}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#D4A853] text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-[#c49843] transition-colors disabled:opacity-50"
                >
                  {lockBusy ? <Loader2 size={15} className="animate-spin" /> : <LockIcon size={15} />}
                  Lock &amp; Submit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unlock confirmation */}
      {showUnlockConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="border-b border-gray-50 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Unlock budget?</h2>
              <button
                onClick={() => setShowUnlockConfirm(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-gray-600">
                The budget becomes editable again. If the deal has already been cleared for
                production, re-lock it after editing so downstream numbers stay correct.
              </p>
              {error && (
                <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2 mt-3">{error}</p>
              )}
              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => setShowUnlockConfirm(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setLock(false)}
                  disabled={lockBusy}
                  className="flex-1 flex items-center justify-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {lockBusy && <Loader2 size={15} className="animate-spin" />}
                  Unlock
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Deliverables tab ─────────────────────────────────────────────────────────

const DELIVERABLE_STATUSES = [
  { key: "PENDING", label: "Pending", bg: "bg-gray-100", text: "text-gray-600" },
  { key: "IN_PROGRESS", label: "In Progress", bg: "bg-amber-100", text: "text-amber-700" },
  { key: "DELIVERED", label: "Delivered", bg: "bg-emerald-100", text: "text-emerald-700" },
];

function DeliverablesTab({
  dealId,
  initial,
  onChanged,
}: {
  dealId: string;
  initial: Deliverable[];
  onChanged: () => Promise<void>;
}) {
  const [items, setItems] = useState<Deliverable[]>(initial);
  const [newItem, setNewItem] = useState("");
  const [newDue, setNewDue] = useState("");
  const [adding, setAdding] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!newItem.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/commercial/deals/${dealId}/deliverables`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: newItem.trim(), dueDate: newDue || null }),
      });
      if (res.ok) {
        const created = await res.json();
        setItems((prev) => [...prev, created]);
        setNewItem("");
        setNewDue("");
        onChanged();
      }
    } finally {
      setAdding(false);
    }
  }

  async function setStatus(item: Deliverable, status: string) {
    setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, status } : x)));
    await fetch(`/api/commercial/deals/${dealId}/deliverables/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    onChanged();
  }

  async function remove(item: Deliverable) {
    setItems((prev) => prev.filter((x) => x.id !== item.id));
    await fetch(`/api/commercial/deals/${dealId}/deliverables/${item.id}`, {
      method: "DELETE",
    });
    onChanged();
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 max-w-2xl">
      <h3 className="text-sm font-semibold text-gray-800 mb-1 flex items-center gap-2">
        <PackageCheck size={15} className="text-[#D4A853]" />
        Deliverables
      </h3>
      <p className="text-xs text-gray-400 mb-5">What&apos;s included in this deal.</p>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-8 text-center text-sm text-gray-400 mb-4">
          No deliverables yet — add what&apos;s included below.
        </div>
      ) : (
        <div className="space-y-2 mb-4">
          {items.map((item) => {
            const status =
              DELIVERABLE_STATUSES.find((s) => s.key === item.status) ?? DELIVERABLE_STATUSES[0];
            return (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-xl border border-gray-100 px-4 py-3 hover:bg-gray-50/60 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium ${
                      item.status === "DELIVERED" ? "text-gray-400 line-through" : "text-gray-800"
                    }`}
                  >
                    {item.type}
                  </p>
                  {item.dueDate && (
                    <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                      <CalendarDays size={11} /> Due {format(parseISO(item.dueDate), "d MMM yyyy")}
                    </p>
                  )}
                </div>
                <select
                  value={item.status}
                  onChange={(e) => setStatus(item, e.target.value)}
                  className={`text-[11px] font-semibold rounded-full px-2.5 py-1 cursor-pointer focus:outline-none ${status.bg} ${status.text}`}
                >
                  {DELIVERABLE_STATUSES.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => remove(item)}
                  className="p-1.5 rounded-lg text-gray-200 hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="Remove"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <form onSubmit={add} className="flex items-center gap-2">
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="Add a deliverable (e.g. 3x Instagram Reels)"
          className="flex-1 px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853]"
        />
        <input
          type="date"
          value={newDue}
          onChange={(e) => setNewDue(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853]"
        />
        <button
          type="submit"
          disabled={!newItem.trim() || adding}
          className="flex items-center gap-1.5 bg-[#D4A853] text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-[#c49843] transition-colors disabled:opacity-50"
        >
          {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Add
        </button>
      </form>
    </div>
  );
}

// ─── Activity tab ─────────────────────────────────────────────────────────────

function ActivityTab({ activities }: { activities: ActivityEntry[] }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden max-w-2xl">
      <div className="px-6 py-4 border-b border-gray-50">
        <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <ActivityIcon size={15} className="text-[#D4A853]" />
          Activity
        </h3>
      </div>
      {activities.length === 0 ? (
        <div className="px-6 py-10 text-center text-sm text-gray-400">No activity yet.</div>
      ) : (
        <div className="divide-y divide-gray-50">
          {activities.map((a) => (
            <div key={a.id} className="flex items-start gap-3 px-6 py-3.5">
              <div className="mt-0.5 w-6 h-6 rounded-lg bg-amber-50 text-[#D4A853] flex items-center justify-center shrink-0">
                {ACTIVITY_ICONS[a.type] ?? <ActivityIcon size={13} />}
              </div>
              <div className="min-w-0">
                <p className="text-sm text-gray-700 leading-snug">{a.message}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {a.userName ? `${a.userName} · ` : ""}
                  {formatDistanceToNow(parseISO(a.createdAt), { addSuffix: true })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Clear for Production modal ───────────────────────────────────────────────

function ClearForProductionModal({
  deal,
  onClose,
  onDone,
}: {
  deal: DealDetail;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ productionId: string } | null>(null);

  const splits = Array.isArray(deal.budgetBreakdown) ? deal.budgetBreakdown : [];
  const budgetTotal = splits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  const effectiveBudget = budgetTotal > 0 ? budgetTotal : deal.value ?? 0;

  async function clear() {
    setClearing(true);
    setError(null);
    try {
      const res = await fetch(`/api/commercial/deals/${deal.id}/clear-for-production`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to clear for production");
        return;
      }
      await onDone();
      setDone({ productionId: data.production.id });
    } catch {
      setError("Failed to clear for production");
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="border-b border-gray-50 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <CheckCircle2 size={17} className="text-emerald-600" />
            Clear for Production
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {done ? (
          <div className="px-6 py-10 text-center">
            <div className="mx-auto w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center mb-4">
              <CheckCircle2 size={24} className="text-emerald-500" />
            </div>
            <p className="text-base font-semibold text-gray-900">Cleared for production</p>
            <p className="text-sm text-gray-500 mt-1">
              &ldquo;{deal.title}&rdquo; is now with the production team — the brief and a{" "}
              {formatMoney(effectiveBudget)} budget went across.
            </p>
            <div className="flex gap-3 mt-6 justify-center">
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Stay on deal
              </button>
              <Link
                href={`/production/${done.productionId}`}
                className="flex items-center gap-1.5 bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors"
              >
                Open production <ArrowUpRight size={14} />
              </Link>
            </div>
          </div>
        ) : (
          <div className="px-6 py-5">
            <p className="text-sm text-gray-700">
              This will create a production project and send the brief to the production team.
              Continue?
            </p>
            <div className="mt-4 rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 text-sm space-y-1.5">
              <p className="flex items-center justify-between">
                <span className="text-gray-400">Project</span>
                <span className="font-medium text-gray-800 truncate ml-3">{deal.title}</span>
              </p>
              <p className="flex items-center justify-between">
                <span className="text-gray-400">Client</span>
                <span className="font-medium text-gray-800">{deal.client.name}</span>
              </p>
              <p className="flex items-center justify-between">
                <span className="text-gray-400">Budget</span>
                <span className="font-medium text-gray-800 tabular-nums">
                  {formatMoney(effectiveBudget)}
                  {splits.length > 0 ? ` · ${splits.length} line${splits.length === 1 ? "" : "s"}` : ""}
                </span>
              </p>
              <p className="flex items-center justify-between">
                <span className="text-gray-400">Brief</span>
                <span className="font-medium text-gray-800">
                  {deal.briefContent?.trim() ? "Included" : "Not written yet"}
                </span>
              </p>
            </div>
            {!deal.briefContent?.trim() && (
              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mt-3">
                No creative brief yet — the deal description will be sent instead. You can write
                the brief on the Brief tab first.
              </p>
            )}

            {error && (
              <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2 mt-3">{error}</p>
            )}

            <div className="flex gap-3 mt-5">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={clear}
                disabled={clearing}
                className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {clearing ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={15} />
                )}
                Continue
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Start Project modal (finance-only deals) ────────────────────────────────

function StartProjectModal({
  deal,
  onClose,
  onDone,
}: {
  deal: DealDetail;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [choice, setChoice] = useState<"production" | "finance" | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [financeDone, setFinanceDone] = useState(false);
  const router = useRouter();

  const splits = Array.isArray(deal.budgetBreakdown) ? deal.budgetBreakdown : [];
  const budgetTotal = splits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  const effectiveBudget = budgetTotal > 0 ? budgetTotal : deal.value ?? 0;

  async function start() {
    if (!choice) return;
    setStarting(true);
    setError(null);
    try {
      const res = await fetch(`/api/commercial/deals/${deal.id}/start-project`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requiresProduction: choice === "production" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to start project");
        return;
      }
      if (choice === "production" && data.production?.id) {
        router.push(`/production/${data.production.id}`);
        return;
      }
      setFinanceDone(true);
      await onDone();
    } catch {
      setError("Failed to start project");
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="border-b border-gray-50 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Rocket size={17} className="text-[#D4A853]" />
            Start Project
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {financeDone ? (
          <div className="px-6 py-10 text-center">
            <div className="mx-auto w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center mb-4">
              <CheckCircle2 size={24} className="text-emerald-500" />
            </div>
            <p className="text-base font-semibold text-gray-900">Finance budget created</p>
            <p className="text-sm text-gray-500 mt-1">
              A {formatMoney(effectiveBudget)} budget for &ldquo;{deal.title}&rdquo; is now in the
              Finance portal awaiting approval.
            </p>
            <button
              onClick={onClose}
              className="mt-6 bg-[#D4A853] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#c49843] transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="px-6 py-5">
            <p className="text-sm text-gray-600 mb-1">
              Kick &ldquo;{deal.title}&rdquo; downstream with a locked budget of{" "}
              <span className="font-semibold text-gray-900">{formatMoney(effectiveBudget)}</span>
              {splits.length > 0
                ? ` across ${splits.length} budget line${splits.length === 1 ? "" : "s"}.`
                : "."}
            </p>
            {effectiveBudget === 0 && (
              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mt-2">
                No budget set yet — you can set the breakdown on the Budget tab first, or start
                with £0 and adjust in Finance.
              </p>
            )}

            <div className="space-y-2.5 mt-4">
              <button
                onClick={() => setChoice("production")}
                className={`w-full text-left rounded-xl border p-4 transition-all ${
                  choice === "production"
                    ? "border-[#D4A853] ring-2 ring-[#D4A853]/20 bg-amber-50/40"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-red-50 text-[#E24B4A] flex items-center justify-center shrink-0">
                    <Film size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Requires production</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Shoot / content creation — creates a Production project with the budget
                      locked from Commercial.
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setChoice("finance")}
                className={`w-full text-left rounded-xl border p-4 transition-all ${
                  choice === "finance"
                    ? "border-[#D4A853] ring-2 ring-[#D4A853]/20 bg-amber-50/40"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <Banknote size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">No production needed</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Print / digital only — creates the campaign budget directly in Finance.
                    </p>
                  </div>
                </div>
              </button>
            </div>

            {error && (
              <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2 mt-3">{error}</p>
            )}

            <div className="flex gap-3 mt-5">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={start}
                disabled={!choice || starting}
                className="flex-1 flex items-center justify-center gap-2 bg-[#D4A853] text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-[#c49843] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {starting ? <Loader2 size={15} className="animate-spin" /> : <Rocket size={15} />}
                Start Project
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
