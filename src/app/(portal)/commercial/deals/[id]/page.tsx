"use client";
// Builds 4+5+6: creative briefing flow, scope-creep deliverables, campaign tracker.

import { useState, useEffect, useCallback, useRef, use } from "react";
import Link from "next/link";
import {
  Loader2,
  ArrowLeft,
  Rocket,
  X,
  Plus,
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
  Archive as ArchiveIcon,
  ArchiveRestore,
  Palette,
  Package,
  LinkIcon,
  MessageSquare,
  History,
  RefreshCw,
  Circle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { format, parseISO, formatDistanceToNow, differenceInCalendarDays } from "date-fns";
import {
  STAGE_ORDER,
  STAGE_STYLES,
  CREATIVE_STATUS_STYLES,
  CREATIVE_STATUS_ORDER,
  WORKFLOW_STYLES,
  stagesForDeal,
  normalizeStage,
  typeStyle,
  formatMoney,
  dealTypesOf,
  DEAL_TYPE_OPTIONS,
  TYPE_STYLES,
  type DealStage,
} from "../../_components/deal-ui";
import { ActionTrackPanel } from "@/components/tasks/ActionTrackPanel";
import MediaPlanTab from "../../_components/MediaPlanTab";
import DeliverablesTab, { type Deliverable } from "./DeliverablesTab";
import CampaignTrackerTab from "./CampaignTrackerTab";

interface ActivityEntry {
  id: string;
  type: string;
  message: string;
  userName: string | null;
  createdAt: string;
  meta?: { from?: string; to?: string } | null;
}

interface ClientBriefData {
  content: string;
  references: string[];
  receivedDate: string | null;
  responseDueDate: string | null;
  sentToCreativeAt: string | null;
}

interface CreativeRevisionData {
  treatment: string;
  figmaUrl: string | null;
  moodBoardLinks: string[];
  sentDate: string | null;
  submittedBy: string | null;
}

interface CreativeResponseData extends CreativeRevisionData {
  revisions: CreativeRevisionData[];
}

interface FeedbackEntryData {
  date: string;
  from: string;
  text: string;
  type: "note" | "revision" | "approval";
}

interface DealDetail {
  id: string;
  title: string;
  type: string;
  dealTypes: string[];
  workflowType: string;
  briefContent: string | null;
  briefDueDate: string | null;
  briefStatus: string;
  clientBrief: ClientBriefData | null;
  creativeResponse: CreativeResponseData | null;
  clientFeedback: FeedbackEntryData[] | null;
  creativeStatus: string | null;
  budgetLocked: boolean;
  lastSyncedToProduction: string | null;
  archived: boolean;
  archivedAt: string | null;
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
    budgetActual: number | null;
    shootDates: string[];
    updatedAt: string;
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

type Tab = "overview" | "brief" | "mediaplan" | "deliverables" | "tracker" | "tasks" | "activity";

// Sign-off / approval onward counts as "won".
const WON_STAGES: DealStage[] = [
  "SIGN_OFF",
  "APPROVAL",
  "IO_SIGNED_KICK_OFF",
  "IN_PRODUCTION",
  "LIVE",
  "COMPLETED",
  "PAID",
];

// Launch checklist for "Clear for Production" — mirrors the server-side gate
// in /api/commercial/deals/[id]/clear-for-production.
interface ChecklistItem {
  key: string;
  label: string;
  ok: boolean;
  detail?: string;
}

function buildLaunchChecklist(deal: DealDetail): { items: ChecklistItem[]; ready: boolean } {
  const creative = deal.workflowType !== "SUPPLIED_ASSETS";
  const stageIdx = STAGE_ORDER.indexOf(normalizeStage(deal.stage));
  // Bespoke needs IO signed & kicked off; supplied/print just need sign-off.
  const gateIdx = STAGE_ORDER.indexOf(creative ? "IO_SIGNED_KICK_OFF" : "APPROVAL");
  const stageOk = stageIdx >= gateIdx;
  const briefOk = Boolean(deal.clientBrief?.content?.trim() || deal.briefContent?.trim());

  const items: ChecklistItem[] = [
    {
      key: "creative",
      label: creative ? "Creative approved by client" : "Creative approval — N/A for supplied assets",
      ok: creative ? deal.creativeStatus === "APPROVED" : true,
      detail:
        creative && deal.creativeStatus !== "APPROVED"
          ? "Log an approval in Client Feedback on the Brief & Creative tab"
          : undefined,
    },
    {
      key: "budget",
      label: "Media plan locked",
      ok: deal.budgetLocked,
      detail: !deal.budgetLocked ? "Lock the media plan on the Media Plan tab" : undefined,
    },
    {
      key: "brief",
      label: "Brief attached",
      ok: briefOk,
      detail: !briefOk ? "Add the client brief on the Brief & Creative tab" : undefined,
    },
    {
      key: "stage",
      label: creative ? "IO signed & kicked off (deal at IO Signed & Kick Off)" : "Signed off (Approval or later)",
      ok: stageOk,
      detail: !stageOk ? "Move the deal to IO Signed & Kick Off first" : undefined,
    },
  ];
  return { items, ready: items.every((i) => i.ok) };
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

export default function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [deal, setDeal] = useState<DealDetail | null>(null);
  const [users, setUsers] = useState<TeamMember[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [showMarkLive, setShowMarkLive] = useState(false);
  const [showClearProduction, setShowClearProduction] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
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
      fetch("/api/me")
        .then((r) => r.json())
        .then((d) => setIsAdmin(d.user?.role === "ADMIN"))
        .catch(() => {}),
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

  async function archiveDeal() {
    setArchiveBusy(true);
    try {
      const res = await fetch(`/api/campaigns/${id}/archive`, { method: "PATCH" });
      if (res.ok) {
        setShowArchiveConfirm(false);
        await reload();
      }
    } finally {
      setArchiveBusy(false);
    }
  }

  async function unarchiveDeal() {
    setArchiveBusy(true);
    try {
      const res = await fetch(`/api/campaigns/${id}/unarchive`, { method: "PATCH" });
      if (res.ok) await reload();
    } finally {
      setArchiveBusy(false);
    }
  }

  async function syncToProduction() {
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch(`/api/commercial/deals/${id}/sync-production`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setSyncError(data.error || "Failed to sync to production");
        return;
      }
      await reload();
      flashSaved();
    } catch {
      setSyncError("Failed to sync to production");
    } finally {
      setSyncing(false);
    }
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
          <p className="text-lg font-semibold text-gray-800 dark:text-gray-200">Deal not found</p>
          <Link
            href="/commercial/pipeline"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--portal-commercial)] hover:text-[var(--portal-commercial)]"
          >
            <ArrowLeft size={14} /> Back to pipeline
          </Link>
        </div>
      </div>
    );
  }

  const stage = STAGE_STYLES[deal.stage] ?? STAGE_STYLES.LEAD;
  const types = dealTypesOf(deal);
  // The workflow type determines the process: creative loop + production, or
  // the simpler supplied-assets path with no production at all.
  const creativeWorkflow = deal.workflowType !== "SUPPLIED_ASSETS";
  const workflowStyle = WORKFLOW_STYLES[creativeWorkflow ? "CREATIVE_BRIEF" : "SUPPLIED_ASSETS"];
  const normalizedStage = normalizeStage(deal.stage);
  const stageWon = WON_STAGES.includes(normalizedStage);
  // "Deal confirmed" — sign-off / approval onward. Gates scope-creep
  // deliverables and counts as a won deal.
  const dealSigned = stageWon;
  // Bespoke deals always show the Brief & Creative workspace — the brief is
  // prepared from New Brief and the back-and-forth happens during pitching.
  const creativeUnlocked = creativeWorkflow;
  const projectStarted = Boolean(deal.production);
  const checklist = buildLaunchChecklist(deal);
  const showClearButton = creativeWorkflow && !projectStarted;
  // Supplied assets: no production — "Mark as Live" once the budget is locked.
  const canMarkLive =
    !creativeWorkflow && stageWon && deal.budgetLocked &&
    !["LIVE", "COMPLETED", "PAID"].includes(deal.stage);
  // Changes made after the last production sync need pushing across.
  const pendingSync =
    projectStarted &&
    deal.lastSyncedToProduction != null &&
    parseISO(deal.updatedAt).getTime() > parseISO(deal.lastSyncedToProduction).getTime() + 2000;
  const stageOptions = stagesForDeal(deal);
  // Advertorials and print deliverables live in the magazine planning sheet too.
  const printRelated =
    types.includes("ADVERTORIAL") ||
    types.includes("PRINT_AD") ||
    deal.deliverables.some((d) =>
      /print|magazine|advertorial|flat\s*plan/i.test(`${d.type} ${d.description ?? ""}`)
    );

  // Contracted deliverables freeze once IO is signed & kicked off (admin can override).
  const contractedLocked =
    STAGE_ORDER.indexOf(normalizedStage) >= STAGE_ORDER.indexOf("IO_SIGNED_KICK_OFF");

  // Every deal gets a Campaign Tracker — supplied/print see the media calendar
  // + link banking, bespoke see their production milestones.
  const TABS: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    ...(creativeUnlocked ? [{ key: "brief" as Tab, label: "Brief & Creative" }] : []),
    { key: "mediaplan", label: "Media Plan" },
    { key: "deliverables", label: `Deliverables (${deal.deliverables.length})` },
    { key: "tracker", label: "Campaign Tracker" },
    { key: "tasks", label: "Tasks" },
    { key: "activity", label: "Activity" },
  ];

  return (
    <div className="min-h-screen bg-card">
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

        {/* Archived banner */}
        {deal.archived && (
          <div className="mb-5 rounded-2xl border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
            <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 flex items-center gap-2">
              <ArchiveIcon size={15} />
              This deal is archived
              {deal.archivedAt && (
                <span className="font-normal text-gray-400 text-xs">
                  since {format(parseISO(deal.archivedAt), "d MMM yyyy")}
                </span>
              )}
              {deal.production && (
                <span className="font-normal text-gray-400 text-xs">
                  · the linked production is archived with it
                </span>
              )}
            </p>
            <button
              onClick={unarchiveDeal}
              disabled={archiveBusy}
              className="flex items-center gap-1.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3.5 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {archiveBusy ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <ArchiveRestore size={13} />
              )}
              Unarchive
            </button>
          </div>
        )}

        {/* Header */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6 mb-5">
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
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full ${workflowStyle.bg} ${workflowStyle.text}`}
                  title={
                    creativeWorkflow
                      ? "Creative brief workflow — creative response, client approval, then production"
                      : "Supplied assets — client provides content, no creative or production"
                  }
                >
                  {creativeWorkflow ? <Palette size={11} /> : <Package size={11} />}
                  {workflowStyle.label}
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
                {creativeWorkflow && !projectStarted && deal.creativeStatus && (
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full ${CREATIVE_STATUS_STYLES[deal.creativeStatus]?.bg ?? "bg-gray-100"} ${CREATIVE_STATUS_STYLES[deal.creativeStatus]?.text ?? "text-gray-600"}`}
                  >
                    <FileText size={11} />{" "}
                    {CREATIVE_STATUS_STYLES[deal.creativeStatus]?.label ?? deal.creativeStatus}
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
                    className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-teal-50 text-emerald-600 hover:bg-teal-100 transition-colors"
                  >
                    <Newspaper size={11} /> Print: View in magazine planning{" "}
                    <ArrowUpRight size={11} />
                  </Link>
                )}
              </div>
              <EditableTitle title={deal.title} onSave={(t) => patchDeal({ title: t })} />
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{deal.client.name}</p>
              <div className="mt-3">
                <TypePills
                  types={types}
                  onChange={(next) => patchDeal({ dealTypes: next })}
                />
              </div>
            </div>

            <div className="flex flex-col items-end gap-3 shrink-0">
              <EditableValue value={deal.value} onSave={(v) => patchDeal({ value: v })} />
              {showClearButton && (
                <button
                  onClick={() => checklist.ready && setShowClearProduction(true)}
                  disabled={!checklist.ready}
                  title={
                    checklist.ready
                      ? "Everything's ready — send this deal to the production team"
                      : `Not ready yet — ${checklist.items.filter((i) => !i.ok).length} item${checklist.items.filter((i) => !i.ok).length === 1 ? "" : "s"} outstanding on the launch checklist`
                  }
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm ${
                    checklist.ready
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed border border-gray-200 dark:border-gray-700"
                  }`}
                >
                  <CheckCircle2 size={15} />
                  Clear for Production
                </button>
              )}
              {canMarkLive && (
                <button
                  onClick={() => setShowMarkLive(true)}
                  className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
                >
                  <Rocket size={15} />
                  Mark as Live
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
                className="w-full text-sm font-medium text-gray-800 dark:text-gray-200 bg-transparent focus:outline-none cursor-pointer"
              >
                {(stageOptions.includes(deal.stage)
                  ? stageOptions
                  : ([deal.stage, ...stageOptions] as DealStage[])
                ).map((s) => (
                  <option key={s} value={s}>
                    {STAGE_STYLES[s]?.label ?? s}
                  </option>
                ))}
              </select>
            </HeaderField>
            <HeaderField label="Client">
              <select
                value={deal.client.id}
                onChange={(e) => patchDeal({ clientId: e.target.value })}
                className="w-full text-sm font-medium text-gray-800 dark:text-gray-200 bg-transparent focus:outline-none cursor-pointer"
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
                className="w-full text-sm font-medium text-gray-800 dark:text-gray-200 bg-transparent focus:outline-none cursor-pointer"
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
                className="w-full text-sm font-medium text-gray-800 dark:text-gray-200 bg-transparent focus:outline-none cursor-pointer"
              />
            </HeaderField>
          </div>
        </div>

        {/* Sync banner — changes made since the last push to production */}
        {pendingSync && (
          <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <RefreshCw size={16} className="text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  Changes made since last submission to production
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Last synced{" "}
                  {formatDistanceToNow(parseISO(deal.lastSyncedToProduction!), { addSuffix: true })}{" "}
                  — click &ldquo;Update Production&rdquo; to push the latest brief and budget across.
                </p>
                {syncError && <p className="text-xs text-red-600 mt-1">{syncError}</p>}
              </div>
            </div>
            <button
              onClick={syncToProduction}
              disabled={syncing}
              className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-amber-700 transition-colors disabled:opacity-50 shrink-0"
            >
              {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Update Production
            </button>
          </div>
        )}

        {/* Launch checklist — what's ready / missing for Clear for Production */}
        {showClearButton && (
          <LaunchChecklist
            items={checklist.items}
            ready={checklist.ready}
            onClear={() => setShowClearProduction(true)}
          />
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-5 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm p-1 w-fit">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t.key
                  ? "bg-[#ffd700]/10 text-[var(--portal-commercial)]"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "overview" && <OverviewTab deal={deal} onPatch={patchDeal} />}
        {tab === "brief" && creativeUnlocked && (
          <BriefCreativeTab deal={deal} onPatch={patchDeal} />
        )}
        {/* Brief tab requested but the deal isn't signed yet — show why it's locked. */}
        {tab === "brief" && !creativeUnlocked && (
          <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm p-8 text-center max-w-2xl">
            <LockIcon className="mx-auto mb-3 text-gray-300" size={28} />
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Creative is locked until the deal is signed</p>
            <p className="text-xs text-gray-400 mt-1">
              Move the deal to <span className="font-medium text-gray-600 dark:text-gray-400">Deal Signed</span> to unlock the brief &amp; creative workflow.
            </p>
          </div>
        )}
        {tab === "mediaplan" && (
          <MediaPlanTab dealId={deal.id} workflowType={deal.workflowType} onSaved={reload} />
        )}
        {tab === "deliverables" && (
          <DeliverablesTab
            dealId={deal.id}
            initial={deal.deliverables}
            dealValue={deal.value}
            contractedLocked={contractedLocked}
            dealSigned={dealSigned}
            isAdmin={isAdmin}
            onChanged={reload}
          />
        )}
        {tab === "tracker" && (
          <CampaignTrackerTab
            dealId={deal.id}
            initial={deal.deliverables}
            workflowType={deal.workflowType}
            dueDate={deal.dueDate}
            production={
              deal.production
                ? {
                    id: deal.production.id,
                    title: deal.production.title,
                    status: deal.production.status,
                    shootDates: deal.production.shootDates,
                  }
                : null
            }
            onChanged={reload}
          />
        )}
        {tab === "tasks" && <ActionTrackPanel projectId={deal.id} />}
        {tab === "activity" && <ActivityTab activities={deal.activities} />}

        {/* Archive — quiet, at the bottom. Replaces delete platform-wide. */}
        {!deal.archived && (
          <div className="mt-10 pt-5 border-t border-gray-100 dark:border-gray-800 flex justify-end">
            <button
              onClick={() => setShowArchiveConfirm(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-red-500 transition-colors px-2 py-1"
            >
              <ArchiveIcon size={13} /> Archive Deal
            </button>
          </div>
        )}
      </div>

      {showMarkLive && (
        <MarkAsLiveModal
          deal={deal}
          onClose={() => setShowMarkLive(false)}
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

      {/* Archive confirmation */}
      {showArchiveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="border-b border-gray-50 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <ArchiveIcon size={16} className="text-red-400" /> Archive deal?
              </h2>
              <button
                onClick={() => setShowArchiveConfirm(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                &ldquo;{deal.title}&rdquo; disappears from the pipeline. Nothing is deleted — the
                deal, its budget, and its history stay on record and you can unarchive it any time
                via &ldquo;Show archived&rdquo;.
              </p>
              {deal.production && (
                <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mt-3">
                  This will also archive the linked production project &ldquo;
                  {deal.production.title}&rdquo;. Continue?
                </p>
              )}
              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => setShowArchiveConfirm(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={archiveDeal}
                  disabled={archiveBusy}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {archiveBusy ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <ArchiveIcon size={15} />
                  )}
                  Archive
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HeaderField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 px-3 py-2">
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
        className="w-full text-2xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight bg-transparent border-b-2 border-[#ffd700] focus:outline-none"
      />
    );
  }
  return (
    <h1
      onClick={() => setEditing(true)}
      title="Click to edit title"
      className="text-2xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight cursor-text rounded-lg -mx-1 px-1 hover:bg-amber-50/60 transition-colors"
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
          className="w-44 pl-8 pr-3 py-1.5 text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums rounded-xl border-2 border-[#ffd700] focus:outline-none"
        />
      </div>
    );
  }
  return (
    <p
      onClick={() => setEditing(true)}
      title="Click to edit value"
      className="text-3xl font-bold text-gray-900 dark:text-gray-100 tabular-nums cursor-text rounded-lg px-1 hover:bg-amber-50/60 transition-colors"
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
            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full border border-dashed border-gray-300 dark:border-gray-600 text-gray-400 hover:border-[#ffd700] hover:text-[var(--portal-commercial)] transition-colors"
          >
            <Plus size={11} /> Add
          </button>
          {adding && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setAdding(false)} />
              <div className="absolute z-20 mt-1.5 w-52 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg p-1.5">
                {remaining.map((t) => {
                  const style = TYPE_STYLES[t];
                  return (
                    <button
                      key={t}
                      onClick={() => {
                        onChange([...types, t]);
                        setAdding(false);
                      }}
                      className="flex w-full items-center rounded-lg px-2.5 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
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
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Description</h3>
            {saving && <Loader2 size={13} className="animate-spin text-gray-400" />}
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={saveDescription}
            rows={4}
            placeholder="What's the deal? Scope, deliverables, context — saved automatically when you click away…"
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[#ffd700]/30 focus:border-[#ffd700]"
          />
        </div>

        {/* Notes */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Notes</h3>
            {saving && <Loader2 size={13} className="animate-spin text-gray-400" />}
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveNotes}
            rows={6}
            placeholder="Internal notes — saved automatically when you click away…"
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[#ffd700]/30 focus:border-[#ffd700]"
          />
        </div>
      </div>

      <div className="space-y-5">
        {/* Production status — live cross-portal view once the deal is cleared */}
        {deal.production && (() => {
          const prod = deal.production;
          const utilisation =
            prod.budgetTotal && prod.budgetTotal > 0
              ? Math.round(((prod.budgetActual ?? 0) / prod.budgetTotal) * 100)
              : null;
          const nextShoot = prod.shootDates
            .map((d) => parseISO(d))
            .filter((d) => differenceInCalendarDays(d, new Date()) >= 0)
            .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
          return (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                <Film size={15} className="text-red-600" />
                Production Status
              </h3>
              <Link
                href={`/production/${prod.id}`}
                className="text-sm font-semibold text-gray-900 dark:text-gray-100 hover:text-red-600 transition-colors"
              >
                {prod.title}
              </Link>
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-50 text-[11px] font-medium text-red-600">
                  {PRODUCTION_STATUS_LABELS[prod.status] ?? prod.status}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {prod._count?.teamMembers ?? 0} crew
                </span>
              </div>
              <dl className="mt-3 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <dt className="text-gray-400 flex items-center gap-1.5">
                    <CalendarDays size={12} /> Next shoot
                  </dt>
                  <dd className="font-medium text-gray-700 dark:text-gray-300">
                    {nextShoot ? format(nextShoot, "EEE d MMM") : "—"}
                  </dd>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <dt className="text-gray-400">Budget used</dt>
                    <dd className="font-medium text-gray-700 dark:text-gray-300 tabular-nums">
                      {formatMoney(prod.budgetActual ?? 0)} / {formatMoney(prod.budgetTotal ?? 0)}
                      {utilisation !== null ? ` · ${utilisation}%` : ""}
                    </dd>
                  </div>
                  {utilisation !== null && (
                    <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${utilisation > 100 ? "bg-red-500" : "bg-emerald-400"}`}
                        style={{ width: `${Math.min(100, utilisation)}%` }}
                      />
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-gray-400">Last update</dt>
                  <dd className="font-medium text-gray-700 dark:text-gray-300">
                    {formatDistanceToNow(parseISO(prod.updatedAt), { addSuffix: true })}
                  </dd>
                </div>
              </dl>
              <Link
                href={`/production/${prod.id}`}
                className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-600 transition-colors"
              >
                Open in Production <ArrowUpRight size={12} />
              </Link>
            </div>
          );
        })()}

        {/* Dates */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">Dates</h3>
          <dl className="space-y-2.5 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-gray-400 flex items-center gap-1.5">
                <CalendarDays size={13} /> Created
              </dt>
              <dd className="font-medium text-gray-700 dark:text-gray-300">
                {format(parseISO(deal.createdAt), "d MMM yyyy")}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-400 flex items-center gap-1.5">
                <CalendarDays size={13} /> Due
              </dt>
              <dd className="font-medium text-gray-700 dark:text-gray-300">
                {deal.dueDate ? format(parseISO(deal.dueDate), "d MMM yyyy") : "—"}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-400 flex items-center gap-1.5">
                <ArrowRightLeft size={13} /> In stage since
              </dt>
              <dd className="font-medium text-gray-700 dark:text-gray-300">
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
                    <span className="text-gray-600 dark:text-gray-400">
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
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">Client</h3>
          <Link
            href={`/commercial/clients/${deal.client.id}`}
            className="text-sm font-semibold text-gray-900 dark:text-gray-100 hover:text-[var(--portal-commercial)] transition-colors"
          >
            {deal.client.name}
          </Link>
          {deal.client.industry && (
            <p className="text-xs text-gray-400 mt-0.5">{deal.client.industry}</p>
          )}
          {deal.billingContact ? (
            <div className="mt-3 pt-3 border-t border-gray-50 text-sm space-y-1">
              <p className="font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <UserIcon size={13} className="text-gray-400" />
                {deal.billingContact.name}
              </p>
              {deal.billingContact.email && (
                <p className="text-xs text-gray-500 dark:text-gray-400">{deal.billingContact.email}</p>
              )}
              {deal.billingContact.phone && (
                <p className="text-xs text-gray-500 dark:text-gray-400">{deal.billingContact.phone}</p>
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

// ─── Launch checklist — Clear for Production readiness ───────────────────────

function LaunchChecklist({
  items,
  ready,
  onClear,
}: {
  items: ChecklistItem[];
  ready: boolean;
  onClear: () => void;
}) {
  const outstanding = items.filter((i) => !i.ok);
  return (
    <div
      className={`mb-5 rounded-2xl border shadow-sm px-6 py-5 ${
        ready ? "border-emerald-200 bg-emerald-50/60" : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
      }`}
    >
      <div className="flex items-center justify-between gap-4 flex-wrap mb-3">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
          <Rocket size={15} className={ready ? "text-emerald-600" : "text-[var(--portal-commercial)]"} />
          Production launch checklist
        </h3>
        {ready ? (
          <button
            onClick={onClear}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <CheckCircle2 size={14} /> Clear for Production
          </button>
        ) : (
          <span className="text-xs font-semibold text-gray-400">
            {items.length - outstanding.length}/{items.length} ready
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {items.map((item) => (
          <div
            key={item.key}
            className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 ${
              item.ok ? "border-emerald-100 bg-emerald-50/50" : "border-gray-100 dark:border-gray-800 bg-gray-50/60"
            }`}
          >
            {item.ok ? (
              <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 shrink-0" />
            ) : (
              <Circle size={16} className="text-gray-300 mt-0.5 shrink-0" />
            )}
            <div className="min-w-0">
              <p
                className={`text-[13px] font-medium ${item.ok ? "text-emerald-800" : "text-gray-600 dark:text-gray-400"}`}
              >
                {item.label}
              </p>
              {!item.ok && item.detail && (
                <p className="text-[11px] text-gray-400 mt-0.5">{item.detail}</p>
              )}
            </div>
          </div>
        ))}
      </div>
      {!ready && outstanding.length > 0 && (
        <p className="text-[11px] text-gray-400 mt-3">
          Missing: {outstanding.map((i) => i.label).join(" · ")} — the Clear for Production button
          unlocks when everything is ticked.
        </p>
      )}
    </div>
  );
}

// ─── Brief & Creative tab — the case builder document workspace ──────────────

function emptyBrief(): ClientBriefData {
  return { content: "", references: [], receivedDate: null, responseDueDate: null, sentToCreativeAt: null };
}

function emptyResponse(): CreativeResponseData {
  return { treatment: "", figmaUrl: null, moodBoardLinks: [], sentDate: null, submittedBy: null, revisions: [] };
}

// Turn a Figma file/proto URL into its embeddable form. Returns null for
// non-Figma URLs (we just render those as a plain link).
function figmaEmbedUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const u = url.trim();
  if (!/figma\.com\/(file|design|proto|board)\//i.test(u)) return null;
  const full = u.startsWith("http") ? u : `https://${u}`;
  return `https://www.figma.com/embed?embed_host=outlanderos&url=${encodeURIComponent(full)}`;
}

function BriefCreativeTab({
  deal,
  onPatch,
}: {
  deal: DealDetail;
  onPatch: (data: Record<string, unknown>) => Promise<void>;
}) {
  const brief = deal.clientBrief ?? emptyBrief();
  const response = deal.creativeResponse ?? emptyResponse();
  const feedback = deal.clientFeedback ?? [];

  const [briefContent, setBriefContent] = useState(brief.content);
  const [treatment, setTreatment] = useState(response.treatment);
  const [figmaUrl, setFigmaUrl] = useState(response.figmaUrl ?? "");
  const [submittedBy, setSubmittedBy] = useState(response.submittedBy ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => setBriefContent(deal.clientBrief?.content ?? ""), [deal.clientBrief?.content]);
  useEffect(
    () => setTreatment(deal.creativeResponse?.treatment ?? ""),
    [deal.creativeResponse?.treatment]
  );
  useEffect(() => setFigmaUrl(deal.creativeResponse?.figmaUrl ?? ""), [deal.creativeResponse?.figmaUrl]);
  useEffect(
    () => setSubmittedBy(deal.creativeResponse?.submittedBy ?? ""),
    [deal.creativeResponse?.submittedBy]
  );

  const statusStyle =
    CREATIVE_STATUS_STYLES[deal.creativeStatus ?? "AWAITING_RESPONSE"] ??
    CREATIVE_STATUS_STYLES.AWAITING_RESPONSE;

  async function patch(data: Record<string, unknown>) {
    setSaving(true);
    await onPatch(data);
    setSaving(false);
  }

  function saveBrief(partial: Partial<ClientBriefData>) {
    return patch({ clientBrief: { ...brief, content: briefContent, ...partial } });
  }

  function saveResponse(partial: Partial<CreativeResponseData>) {
    return patch({
      creativeResponse: {
        ...response,
        treatment,
        figmaUrl: figmaUrl.trim() || null,
        submittedBy: submittedBy.trim() || null,
        ...partial,
      },
    });
  }

  // Commercial flags the brief as sent to the creative/production team —
  // this is what surfaces the deal in the Production portal's "Creative in
  // Progress" list.
  async function sendToCreative() {
    await patch({
      clientBrief: { ...brief, content: briefContent, sentToCreativeAt: new Date().toISOString() },
      creativeStatus: deal.creativeStatus ?? "AWAITING_RESPONSE",
      briefStatus: "SENT_TO_PRODUCTION",
    });
  }

  async function sendResponse() {
    if (!treatment.trim()) return;
    // Re-sending after a round of revisions archives the previous version.
    const revisions =
      response.sentDate != null
        ? [
            ...response.revisions,
            {
              treatment: response.treatment,
              figmaUrl: response.figmaUrl,
              moodBoardLinks: response.moodBoardLinks,
              sentDate: response.sentDate,
              submittedBy: response.submittedBy,
            },
          ]
        : response.revisions;
    await patch({
      creativeResponse: {
        ...response,
        treatment,
        figmaUrl: figmaUrl.trim() || null,
        submittedBy: submittedBy.trim() || null,
        sentDate: new Date().toISOString(),
        revisions,
      },
      creativeStatus: "RESPONSE_SENT",
      stage: "PITCHING_FEEDBACK",
    });
  }

  async function addFeedback(entry: FeedbackEntryData) {
    const data: Record<string, unknown> = { clientFeedback: [...feedback, entry] };
    if (entry.type === "revision" && deal.creativeStatus !== "APPROVED") {
      data.creativeStatus = "REVISIONS_REQUESTED";
    } else if (entry.type === "note" && deal.creativeStatus === "RESPONSE_SENT") {
      data.creativeStatus = "IN_REVIEW";
    }
    await patch(data);
  }

  async function approveCreative() {
    await patch({ creativeStatus: "APPROVED", stage: "SIGN_OFF" });
  }

  const responseSent = Boolean(response.sentDate);
  const inputCls =
    "px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/30 focus:border-purple-400";

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Status strip */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm px-6 py-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Creative status
          </p>
          <select
            value={deal.creativeStatus ?? "AWAITING_RESPONSE"}
            onChange={(e) => patch({ creativeStatus: e.target.value })}
            className={`text-[11px] font-semibold rounded-full px-2.5 py-1 cursor-pointer focus:outline-none ${statusStyle.bg} ${statusStyle.text}`}
            title="Creative status"
          >
            {CREATIVE_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {CREATIVE_STATUS_STYLES[s].label}
              </option>
            ))}
          </select>
        </div>
        {saving && <Loader2 size={13} className="animate-spin text-gray-400" />}
      </div>

      {/* Client Brief */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2 mb-1">
          <FileText size={15} className="text-purple-500" />
          Client Brief
        </h3>
        <p className="text-xs text-gray-400 mb-4">
          What the client wants — saved automatically as you go.
        </p>

        <textarea
          value={briefContent}
          onChange={(e) => setBriefContent(e.target.value)}
          onBlur={() => {
            if (briefContent !== brief.content) saveBrief({ content: briefContent });
          }}
          rows={8}
          placeholder={
            "Paste or write the client's brief here.\n\n• What do they want?\n• Objectives & audience\n• Mandatories, deadlines, budget signals"
          }
          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-purple-400/30 focus:border-purple-400"
        />

        <LinkListEditor
          label="Reference links"
          links={brief.references}
          onChange={(references) => saveBrief({ references })}
          placeholder="https:// — client decks, references, examples"
        />

        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
              Brief received
            </p>
            <input
              type="date"
              value={brief.receivedDate ? brief.receivedDate.slice(0, 10) : ""}
              onChange={(e) => saveBrief({ receivedDate: e.target.value || null })}
              className={`${inputCls} w-full`}
            />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
              Response due
            </p>
            <input
              type="date"
              value={brief.responseDueDate ? brief.responseDueDate.slice(0, 10) : ""}
              onChange={(e) => saveBrief({ responseDueDate: e.target.value || null })}
              className={`${inputCls} w-full`}
            />
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-3 flex-wrap">
          {brief.sentToCreativeAt ? (
            <p className="text-[11px] text-emerald-600 font-medium inline-flex items-center gap-1.5">
              <CheckCircle2 size={13} /> Sent to creative team{" "}
              {format(parseISO(brief.sentToCreativeAt), "d MMM yyyy")} — visible in Production
            </p>
          ) : (
            <p className="text-[11px] text-gray-400">
              Send the brief to kick off the creative response.
            </p>
          )}
          <button
            onClick={sendToCreative}
            disabled={!briefContent.trim() || saving}
            title={briefContent.trim() ? "Make the brief visible to the creative/production team" : "Write the brief first"}
            className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={14} />
            {brief.sentToCreativeAt ? "Re-send to Creative Team" : "Send to Creative Team"}
          </button>
        </div>
      </div>

      {/* Creative Response */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <Sparkles size={15} className="text-purple-500" />
            Creative Response
          </h3>
          {responseSent && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-sky-100 text-sky-700">
              <Send size={11} /> Sent {format(parseISO(response.sentDate!), "d MMM yyyy")}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 mb-4">
          Outlander&apos;s treatment / concept in response to the brief.
        </p>

        <textarea
          value={treatment}
          onChange={(e) => setTreatment(e.target.value)}
          onBlur={() => {
            if (treatment !== response.treatment) saveResponse({ treatment });
          }}
          rows={8}
          placeholder={
            "Write the treatment / concept here.\n\n• The idea\n• Visual direction & tone\n• Formats and deliverables proposed"
          }
          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-purple-400/30 focus:border-purple-400"
        />

        {/* Figma deck link + embedded preview */}
        <div className="mt-4">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
            Figma deck link
          </p>
          <div className="flex items-center gap-2">
            <input
              type="url"
              value={figmaUrl}
              onChange={(e) => setFigmaUrl(e.target.value)}
              onBlur={() => {
                if (figmaUrl.trim() !== (response.figmaUrl ?? "")) saveResponse({ figmaUrl: figmaUrl.trim() || null });
              }}
              placeholder="https://www.figma.com/… — the creative deck"
              className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/30 focus:border-purple-400"
            />
            {figmaUrl.trim() && (
              <a
                href={figmaUrl.startsWith("http") ? figmaUrl : `https://${figmaUrl}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-800 px-2.5 py-2 rounded-lg border border-purple-200 hover:bg-purple-50 transition-colors shrink-0"
              >
                Open <ArrowUpRight size={12} />
              </a>
            )}
          </div>
          {figmaEmbedUrl(response.figmaUrl) ? (
            <div className="mt-3 rounded-xl border border-gray-800 bg-secondary overflow-hidden">
              <iframe
                title="Figma deck"
                src={figmaEmbedUrl(response.figmaUrl)!}
                className="w-full"
                style={{ height: 420, border: "none" }}
                allowFullScreen
              />
            </div>
          ) : response.figmaUrl ? (
            <p className="mt-2 text-[11px] text-gray-400">
              Not a recognised Figma URL — it&apos;ll show as a link only.
            </p>
          ) : null}
        </div>

        <div className="mt-4">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
            Submitted by
          </p>
          <input
            type="text"
            value={submittedBy}
            onChange={(e) => setSubmittedBy(e.target.value)}
            onBlur={() => {
              if (submittedBy.trim() !== (response.submittedBy ?? "")) saveResponse({ submittedBy: submittedBy.trim() || null });
            }}
            placeholder="Who from the creative team is sending this?"
            className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/30 focus:border-purple-400"
          />
        </div>

        <LinkListEditor
          label="Mood board links"
          links={response.moodBoardLinks}
          onChange={(moodBoardLinks) => saveResponse({ moodBoardLinks })}
          placeholder="https:// — Figma, Pinterest, drive folders"
        />

        <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end">
          <button
            onClick={sendResponse}
            disabled={!treatment.trim() || saving}
            title={
              treatment.trim()
                ? "Send the response — moves the deal to Client Review"
                : "Write the treatment first"
            }
            className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={14} />
            {responseSent ? "Re-send Response" : "Send Response"}
          </button>
        </div>
        <p className="text-[11px] text-gray-400 text-right mt-2">
          Sending moves the deal to <span className="font-semibold">Client Review</span>
          {responseSent ? " and archives the previous version in Revision History." : "."}
        </p>
      </div>

      {/* Client Feedback */}
      <FeedbackLog
        feedback={feedback}
        creativeStatus={deal.creativeStatus}
        onAdd={addFeedback}
        onApprove={approveCreative}
      />

      {/* Version History — timeline of each creative response version */}
      {responseSent && (
        <VersionHistory current={response} />
      )}
    </div>
  );
}

// ─── Version history timeline ─────────────────────────────────────────────────

function VersionHistory({ current }: { current: CreativeResponseData }) {
  const [open, setOpen] = useState(true);
  // Newest first: current sent version, then archived revisions (most recent first).
  const versions: CreativeRevisionData[] = [
    { treatment: current.treatment, figmaUrl: current.figmaUrl, moodBoardLinks: current.moodBoardLinks, sentDate: current.sentDate, submittedBy: current.submittedBy },
    ...[...current.revisions].reverse(),
  ];
  const total = versions.length;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 text-left"
      >
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
          <History size={15} className="text-purple-500" />
          Version History
          <span className="text-[11px] font-normal text-gray-400">({total})</span>
        </h3>
        <span className="text-gray-400">{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
      </button>

      {open && (
        <div className="relative mt-4 pl-5">
          {/* connecting line */}
          <div className="absolute left-[6px] top-1.5 bottom-1.5 w-px bg-gray-200 dark:bg-gray-700" />
          <div className="space-y-4">
            {versions.map((rev, i) => {
              const versionNo = total - i;
              const isCurrent = i === 0;
              return (
                <div key={i} className="relative">
                  <span
                    className={`absolute -left-5 top-1 w-3 h-3 rounded-full border-2 border-white ${
                      isCurrent ? "bg-purple-500 ring-2 ring-purple-200" : "bg-gray-300"
                    }`}
                  />
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Version {versionNo}
                      {isCurrent && (
                        <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-purple-600">
                          Current
                        </span>
                      )}
                    </p>
                    <div className="flex items-center gap-3">
                      {rev.submittedBy && (
                        <span className="text-[11px] text-gray-400">by {rev.submittedBy}</span>
                      )}
                      {rev.sentDate && (
                        <span className="text-[11px] text-gray-400">
                          {format(parseISO(rev.sentDate), "d MMM yyyy")}
                        </span>
                      )}
                    </div>
                  </div>
                  {rev.treatment && (
                    <p className="text-[13px] text-gray-600 dark:text-gray-400 whitespace-pre-wrap line-clamp-3 mt-1">
                      {rev.treatment}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5">
                    {rev.figmaUrl && (
                      <a
                        href={rev.figmaUrl.startsWith("http") ? rev.figmaUrl : `https://${rev.figmaUrl}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-600 hover:text-purple-800"
                      >
                        <LinkIcon size={11} /> Figma deck <ArrowUpRight size={10} />
                      </a>
                    )}
                    {rev.moodBoardLinks.length > 0 && (
                      <span className="text-[11px] text-gray-400">
                        {rev.moodBoardLinks.length} mood board link{rev.moodBoardLinks.length === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Link list editor (references / mood boards) ─────────────────────────────

function LinkListEditor({
  label,
  links,
  onChange,
  placeholder,
}: {
  label: string;
  links: string[];
  onChange: (links: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const url = draft.trim();
    if (!url) return;
    onChange([...links, url]);
    setDraft("");
  }

  return (
    <div className="mt-4">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
        {label}
      </p>
      {links.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {links.map((url, i) => (
            <div
              key={`${url}-${i}`}
              className="flex items-center gap-2 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50/60 px-3 py-1.5 group"
            >
              <LinkIcon size={12} className="text-gray-400 shrink-0" />
              <a
                href={url.startsWith("http") ? url : `https://${url}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 text-xs text-purple-700 hover:underline truncate"
              >
                {url}
              </a>
              <button
                onClick={() => onChange(links.filter((_, j) => j !== i))}
                className="p-1 rounded text-gray-300 hover:text-red-500 transition-colors"
                title="Remove link"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <input
          type="url"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/30 focus:border-purple-400"
        />
        <button
          onClick={add}
          disabled={!draft.trim()}
          className="flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-800 px-2.5 py-2 rounded-lg border border-purple-200 hover:bg-purple-50 transition-colors disabled:opacity-40"
        >
          <Plus size={12} /> Add
        </button>
      </div>
    </div>
  );
}

// ─── Client feedback log — chat-style: date left, content right ──────────────

const FEEDBACK_TYPE_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  note: { label: "Note", bg: "bg-gray-100", text: "text-gray-600" },
  revision: { label: "Revision", bg: "bg-orange-100", text: "text-orange-700" },
  approval: { label: "Approval", bg: "bg-emerald-100", text: "text-emerald-700" },
};

function FeedbackLog({
  feedback,
  creativeStatus,
  onAdd,
  onApprove,
}: {
  feedback: FeedbackEntryData[];
  creativeStatus: string | null;
  onAdd: (entry: FeedbackEntryData) => Promise<void>;
  onApprove: () => Promise<void>;
}) {
  const [from, setFrom] = useState("");
  const [text, setText] = useState("");
  const [type, setType] = useState<FeedbackEntryData["type"]>("note");
  const [adding, setAdding] = useState(false);
  const [approving, setApproving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setAdding(true);
    try {
      await onAdd({
        date: new Date().toISOString(),
        from: from.trim(),
        text: text.trim(),
        type,
      });
      setText("");
      setType("note");
    } finally {
      setAdding(false);
    }
  }

  async function approve() {
    setApproving(true);
    try {
      await onApprove();
    } finally {
      setApproving(false);
    }
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6">
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2 mb-1">
        <MessageSquare size={15} className="text-purple-500" />
        Client Feedback
      </h3>
      <p className="text-xs text-gray-400 mb-4">
        A running log of what the client said about the creative.
      </p>

      {feedback.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 py-6 text-center text-sm text-gray-400 mb-4">
          No feedback logged yet.
        </div>
      ) : (
        <div className="space-y-3 mb-4">
          {feedback.map((f, i) => {
            const style = FEEDBACK_TYPE_STYLES[f.type] ?? FEEDBACK_TYPE_STYLES.note;
            return (
              <div key={i} className="flex gap-4">
                <div className="w-20 shrink-0 text-right">
                  <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                    {format(parseISO(f.date), "d MMM")}
                  </p>
                  <p className="text-[10px] text-gray-400">{format(parseISO(f.date), "HH:mm")}</p>
                </div>
                <div className="flex-1 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/60 px-4 py-3">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {f.from && <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{f.from}</p>}
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}
                    >
                      {style.label}
                    </span>
                    {f.type === "approval" && creativeStatus !== "APPROVED" && (
                      <button
                        onClick={approve}
                        disabled={approving}
                        className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-50"
                      >
                        {approving ? (
                          <Loader2 size={10} className="animate-spin" />
                        ) : (
                          <CheckCircle2 size={10} />
                        )}
                        Move to Client Approved
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{f.text}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <form onSubmit={submit} className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/40 p-3.5 space-y-2.5">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
          Add feedback
        </p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            placeholder="Who said it (client contact)"
            className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-400/30 focus:border-purple-400"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value as FeedbackEntryData["type"])}
            className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 focus:outline-none cursor-pointer"
          >
            <option value="note">Note</option>
            <option value="revision">Revision requested</option>
            <option value="approval">Approval</option>
          </select>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="What did they say?"
          className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 resize-y focus:outline-none focus:ring-2 focus:ring-purple-400/30 focus:border-purple-400"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!text.trim() || adding}
            className="flex items-center gap-1.5 bg-purple-600 text-white px-3.5 py-2 rounded-xl text-xs font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            {adding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
            Add Feedback
          </button>
        </div>
      </form>
    </div>
  );
}


// ─── Activity tab ─────────────────────────────────────────────────────────────

function ActivityTab({ activities }: { activities: ActivityEntry[] }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden max-w-2xl">
      <div className="px-6 py-4 border-b border-gray-50">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
          <ActivityIcon size={15} className="text-[var(--portal-commercial)]" />
          Activity
        </h3>
      </div>
      {activities.length === 0 ? (
        <div className="px-6 py-10 text-center text-sm text-gray-400">No activity yet.</div>
      ) : (
        <div className="divide-y divide-gray-50">
          {activities.map((a) => (
            <div key={a.id} className="flex items-start gap-3 px-6 py-3.5">
              <div className="mt-0.5 w-6 h-6 rounded-lg bg-amber-50 text-[var(--portal-commercial)] flex items-center justify-center shrink-0">
                {ACTIVITY_ICONS[a.type] ?? <ActivityIcon size={13} />}
              </div>
              <div className="min-w-0">
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-snug">{a.message}</p>
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

  // The deal value is the full deal; production only receives the hard-cost
  // budget (the "Production" allocation), not the whole thing.
  const splits = Array.isArray(deal.budgetBreakdown) ? deal.budgetBreakdown : [];
  const dealTotal = deal.value ?? splits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  const productionSplit = splits.find((s) => /production/i.test(String(s.category)));
  const productionBudget = productionSplit ? Number(productionSplit.amount) || 0 : dealTotal;

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
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="border-b border-gray-50 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <CheckCircle2 size={17} className="text-emerald-600" />
            Clear for Production
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {done ? (
          <div className="px-6 py-10 text-center">
            <div className="mx-auto w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center mb-4">
              <CheckCircle2 size={24} className="text-emerald-500" />
            </div>
            <p className="text-base font-semibold text-gray-900 dark:text-gray-100">Cleared for production</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              &ldquo;{deal.title}&rdquo; is now with the production team — the brief and a{" "}
              {formatMoney(productionBudget)} hard-cost budget went across (of{" "}
              {formatMoney(dealTotal)} total deal).
            </p>
            <div className="flex gap-3 mt-6 justify-center">
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
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
            <p className="text-sm text-gray-700 dark:text-gray-300">
              This will create a production project and send the brief to the production team.
              Continue?
            </p>
            <div className="mt-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-800 px-4 py-3 text-sm space-y-1.5">
              <p className="flex items-center justify-between">
                <span className="text-gray-400">Project</span>
                <span className="font-medium text-gray-800 dark:text-gray-200 truncate ml-3">{deal.title}</span>
              </p>
              <p className="flex items-center justify-between">
                <span className="text-gray-400">Client</span>
                <span className="font-medium text-gray-800 dark:text-gray-200">{deal.client.name}</span>
              </p>
              <p className="flex items-center justify-between">
                <span className="text-gray-400">Deal value</span>
                <span className="font-medium text-gray-800 dark:text-gray-200 tabular-nums">{formatMoney(dealTotal)}</span>
              </p>
              <p className="flex items-center justify-between">
                <span className="text-gray-400">Production budget (hard costs)</span>
                <span className="font-medium text-gray-800 dark:text-gray-200 tabular-nums">{formatMoney(productionBudget)}</span>
              </p>
              <p className="flex items-center justify-between">
                <span className="text-gray-400">Brief</span>
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  {deal.clientBrief?.content?.trim() || deal.briefContent?.trim()
                    ? "Included"
                    : "Not written yet"}
                </span>
              </p>
              <p className="flex items-center justify-between">
                <span className="text-gray-400">Creative</span>
                <span className="font-medium text-emerald-700">Approved by client</span>
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2 mt-3">{error}</p>
            )}

            <div className="flex gap-3 mt-5">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
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

// ─── Mark as Live modal (supplied-assets deals — no production) ──────────────

function MarkAsLiveModal({
  deal,
  onClose,
  onDone,
}: {
  deal: DealDetail;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const needsFinance = !deal.financeBudget;

  async function markLive() {
    setBusy(true);
    setError(null);
    try {
      // Supplied-assets deals still get a CampaignBudget for finance tracking.
      if (needsFinance) {
        const res = await fetch(`/api/commercial/deals/${deal.id}/start-project`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requiresProduction: false }),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Failed to create the finance budget");
          return;
        }
      }
      const res = await fetch(`/api/campaigns/${deal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: "LIVE" }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to mark the deal as live");
        return;
      }
      await onDone();
      setDone(true);
    } catch {
      setError("Failed to mark the deal as live");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="border-b border-gray-50 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Rocket size={17} className="text-emerald-600" />
            Mark as Live
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {done ? (
          <div className="px-6 py-10 text-center">
            <div className="mx-auto w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center mb-4">
              <CheckCircle2 size={24} className="text-emerald-500" />
            </div>
            <p className="text-base font-semibold text-gray-900 dark:text-gray-100">Deal is live</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              &ldquo;{deal.title}&rdquo; is now live
              {needsFinance ? " and a budget was created in Finance for tracking." : "."}
            </p>
            <button
              onClick={onClose}
              className="mt-6 bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="px-6 py-5">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Supplied-assets job — no creative or production needed. This moves the deal to{" "}
              <span className="font-semibold">Live</span>
              {needsFinance
                ? ` and creates a ${formatMoney(deal.value ?? 0)} budget in Finance for tracking.`
                : "."}
            </p>
            <div className="mt-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-800 px-4 py-3 text-sm space-y-1.5">
              <p className="flex items-center justify-between">
                <span className="text-gray-400">Deal</span>
                <span className="font-medium text-gray-800 dark:text-gray-200 truncate ml-3">{deal.title}</span>
              </p>
              <p className="flex items-center justify-between">
                <span className="text-gray-400">Client</span>
                <span className="font-medium text-gray-800 dark:text-gray-200">{deal.client.name}</span>
              </p>
              <p className="flex items-center justify-between">
                <span className="text-gray-400">Budget</span>
                <span className="font-medium text-gray-800 dark:text-gray-200 tabular-nums">
                  {formatMoney(deal.value)} · locked
                </span>
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2 mt-3">{error}</p>
            )}

            <div className="flex gap-3 mt-5">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={markLive}
                disabled={busy}
                className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Rocket size={15} />}
                Mark as Live
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
