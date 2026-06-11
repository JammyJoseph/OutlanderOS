"use client";

import { useState, useEffect, useCallback, use } from "react";
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
} from "lucide-react";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import {
  STAGE_ORDER,
  STAGE_STYLES,
  typeStyle,
  formatMoney,
  DEAL_TYPE_OPTIONS,
  TYPE_STYLES,
  type DealStage,
} from "../../_components/deal-ui";

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

type Tab = "overview" | "budget" | "deliverables" | "activity";

const WON_STAGES: DealStage[] = ["CONTRACTED", "LIVE", "COMPLETED", "PAID"];

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  created: <Sparkles size={13} />,
  stage_change: <ArrowRightLeft size={13} />,
  budget_update: <Banknote size={13} />,
  note: <PenLine size={13} />,
  deliverable: <PackageCheck size={13} />,
  project_started: <Rocket size={13} />,
};

export default function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [deal, setDeal] = useState<DealDetail | null>(null);
  const [users, setUsers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [showStartProject, setShowStartProject] = useState(false);

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
    ]).finally(() => setLoading(false));
  }, [reload]);

  async function patchDeal(data: Record<string, unknown>) {
    const res = await fetch(`/api/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) await reload();
  }

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
  const type = typeStyle(deal.type);
  const canStartProject = WON_STAGES.includes(deal.stage);
  const projectStarted = Boolean(deal.production);
  // Advertorials and print deliverables live in the magazine planning sheet too.
  const printRelated =
    deal.type === "ADVERTORIAL" ||
    deal.type === "PRINT_AD" ||
    deal.deliverables.some((d) =>
      /print|magazine|advertorial|flat\s*plan/i.test(`${d.type} ${d.description ?? ""}`)
    );

  const TABS: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "budget", label: "Budget" },
    { key: "deliverables", label: `Deliverables (${deal.deliverables.length})` },
    { key: "activity", label: "Activity" },
  ];

  return (
    <div className="min-h-screen bg-[#F9F9F7]">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Breadcrumb */}
        <Link
          href="/commercial/pipeline"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-600 mb-4 transition-colors"
        >
          <ArrowLeft size={13} /> Pipeline
        </Link>

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
                <span
                  className={`inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-full ${type.bg} ${type.text}`}
                >
                  {type.label}
                </span>
                {projectStarted && (
                  <Link
                    href={`/production/${deal.production!.id}`}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-red-50 text-[#E24B4A] hover:bg-red-100 transition-colors"
                  >
                    <Film size={11} /> Production: {deal.production!.title} <ArrowUpRight size={11} />
                  </Link>
                )}
                {deal.financeBudget && (
                  <Link
                    href={`/finance?tab=projects&project=${deal.financeBudget.id}`}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
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
              <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">{deal.title}</h1>
              <p className="text-sm text-gray-500 mt-0.5">{deal.client.name}</p>
            </div>

            <div className="flex flex-col items-end gap-3 shrink-0">
              <p className="text-3xl font-bold text-gray-900 tabular-nums">
                {formatMoney(deal.value)}
              </p>
              {canStartProject && !projectStarted && (
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
            <HeaderField label="Type">
              <select
                value={deal.type}
                onChange={(e) => patchDeal({ type: e.target.value })}
                className="w-full text-sm font-medium text-gray-800 bg-transparent focus:outline-none cursor-pointer"
              >
                {[...DEAL_TYPE_OPTIONS].map((t) => (
                  <option key={t} value={t}>
                    {TYPE_STYLES[t].label}
                  </option>
                ))}
                {!DEAL_TYPE_OPTIONS.includes(deal.type as never) && (
                  <option value={deal.type}>{type.label}</option>
                )}
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
        {tab === "budget" && <BudgetTab dealId={deal.id} dealValue={deal.value} onSaved={reload} />}
        {tab === "deliverables" && (
          <DeliverablesTab dealId={deal.id} initial={deal.deliverables} onChanged={reload} />
        )}
        {tab === "activity" && <ActivityTab activities={deal.activities} />}
      </div>

      {showStartProject && (
        <StartProjectModal
          deal={deal}
          onClose={() => setShowStartProject(false)}
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

// ─── Overview tab ─────────────────────────────────────────────────────────────

function OverviewTab({
  deal,
  onPatch,
}: {
  deal: DealDetail;
  onPatch: (data: Record<string, unknown>) => Promise<void>;
}) {
  const [notes, setNotes] = useState(deal.notes ?? "");
  const [saving, setSaving] = useState(false);

  const stageHistory = deal.activities.filter((a) => a.type === "stage_change").slice(0, 8);

  async function saveNotes() {
    if (notes === (deal.notes ?? "")) return;
    setSaving(true);
    await onPatch({ notes });
    setSaving(false);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 space-y-5">
        {/* Description */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Description</h3>
          {deal.description ? (
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
              {deal.description}
            </p>
          ) : (
            <p className="text-sm text-gray-400">No description yet.</p>
          )}
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
        {/* Production — appears once a project has been started */}
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

// ─── Budget tab ───────────────────────────────────────────────────────────────

function BudgetTab({
  dealId,
  dealValue,
  onSaved,
}: {
  dealId: string;
  dealValue: number | null;
  onSaved: () => Promise<void>;
}) {
  const [splits, setSplits] = useState<{ category: string; amount: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/commercial/deals/${dealId}/budget`)
      .then((r) => r.json())
      .then((d) => {
        const loaded = (d.splits ?? []) as { category: string; amount: number }[];
        setSplits(
          loaded.length
            ? loaded.map((s) => ({ category: s.category, amount: String(s.amount) }))
            : [{ category: "", amount: "" }]
        );
      })
      .finally(() => setLoading(false));
  }, [dealId]);

  const total = splits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/commercial/deals/${dealId}/budget`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          splits: splits
            .filter((s) => s.category.trim())
            .map((s) => ({ category: s.category.trim(), amount: Number(s.amount) || 0 })),
        }),
      });
      if (res.ok) {
        setSavedAt(Date.now());
        await onSaved();
      }
    } finally {
      setSaving(false);
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
    "px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853]";

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <Banknote size={15} className="text-[#D4A853]" />
          Budget Breakdown
        </h3>
        <p className="text-xs text-gray-400">
          Deal value: <span className="font-semibold text-gray-600">{formatMoney(dealValue)}</span>
        </p>
      </div>
      <p className="text-xs text-gray-400 mb-5">
        Set the budget once here — it flows to Production and Finance when the project starts.
      </p>

      <div className="space-y-2">
        {splits.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="text"
              value={s.category}
              onChange={(e) =>
                setSplits((prev) => prev.map((x, j) => (j === i ? { ...x, category: e.target.value } : x)))
              }
              placeholder="Category (e.g. Talent, Production, Print)"
              className={`${inputCls} flex-1`}
            />
            <div className="relative w-36">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">£</span>
              <input
                type="number"
                min="0"
                value={s.amount}
                onChange={(e) =>
                  setSplits((prev) => prev.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))
                }
                placeholder="0"
                className={`${inputCls} w-full pl-7`}
              />
            </div>
            <button
              onClick={() => setSplits((prev) => prev.filter((_, j) => j !== i))}
              className="p-2 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
              title="Remove line"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={() => setSplits((prev) => [...prev, { category: "", amount: "" }])}
        className="mt-3 flex items-center gap-1.5 text-xs font-medium text-[#D4A853] hover:text-[#c49843] transition-colors"
      >
        <Plus size={13} /> Add line
      </button>

      <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400">Total budget</p>
          <p className="text-xl font-bold text-gray-900 tabular-nums">{formatMoney(total)}</p>
          {dealValue !== null && total > dealValue && (
            <p className="text-[11px] text-red-500 mt-0.5">
              Budget exceeds the deal value by {formatMoney(total - dealValue)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {savedAt && !saving && (
            <span className="text-xs text-emerald-600 flex items-center gap-1">
              <CheckCircle2 size={13} /> Saved
            </span>
          )}
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 bg-[#D4A853] text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-[#c49843] transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Save Budget
          </button>
        </div>
      </div>
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

// ─── Start Project modal ──────────────────────────────────────────────────────

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
