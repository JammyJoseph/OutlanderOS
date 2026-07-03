"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  FileText,
  ListChecks,
  Lock,
  Wallet,
  Users,
  TrendingDown,
  TrendingUp,
  Clock,
} from "lucide-react";
import { format, parseISO, isAfter, startOfDay } from "date-fns";
import { ProductionFull, ProductionBriefData, gbp } from "./types";
import LinkedDeal from "./LinkedDeal";

interface Props {
  production: ProductionFull;
  description: string;
  setDescription: (s: string) => void;
  budget: string;
  setBudget: (s: string) => void;
  figmaUrl: string;
  setFigmaUrl: (s: string) => void;
  shootDates: string[];
  setShootDates: (s: string[]) => void;
  scheduleSave: () => void;
}

export default function OverviewTab({
  production,
  description,
  setDescription,
  budget,
  setBudget,
  figmaUrl,
  setFigmaUrl,
  shootDates,
  setShootDates,
  scheduleSave,
}: Props) {
  const totalBudgeted = useMemo(
    () => (production.budgetItems ?? []).reduce((sum, it) => sum + (it.budgeted || 0), 0),
    [production.budgetItems]
  );
  const totalActual = useMemo(
    () => (production.budgetItems ?? []).reduce((sum, it) => sum + (it.actual || 0), 0),
    [production.budgetItems]
  );
  const variance = totalBudgeted - totalActual;
  const overBudget = variance < 0;

  const team = production.teamMembers ?? [];
  const teamCounts = {
    total: team.length,
    confirmed: team.filter((m) => m.status === "CONFIRMED").length,
    contracted: team.filter((m) => m.status === "CONTRACTED").length,
  };

  const tasks = production.productionTasks ?? [];
  const completed = tasks.filter((t) => t.status === "DONE").length;
  const pct = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;

  // Shotlist progress across this production's call sheets
  const shots = useMemo(() => {
    let total = 0;
    let done = 0;
    for (const cs of production.callSheets ?? []) {
      for (const shot of cs.shotlist ?? []) {
        total += 1;
        if (shot?.status === "completed") done += 1;
      }
    }
    return { total, done };
  }, [production.callSheets]);

  const today = startOfDay(new Date());
  const upcomingTask = tasks
    .filter((t) => t.status !== "DONE" && t.dueDate)
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())[0];
  const nextShoot = (production.shootDates ?? [])
    .map((d) => parseISO(d))
    .filter((d) => isAfter(d, today) || d.getTime() === today.getTime())
    .sort((a, b) => a.getTime() - b.getTime())[0];

  function updateShoot(i: number, value: string) {
    const next = [...shootDates];
    next[i] = value;
    setShootDates(next);
    scheduleSave();
  }
  function addShoot() {
    setShootDates([...shootDates, ""]);
  }
  function removeShoot(i: number) {
    setShootDates(shootDates.filter((_, j) => j !== i));
    scheduleSave();
  }

  const lockedBudget = production.type === "COMMERCIAL";

  return (
    <div className="space-y-5">
      {/* Cross-portal breadcrumb */}
      {production.campaign?.id && (
        <Link
          href={`/commercial/deals/${production.campaign.id}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-[#ffd700] transition-colors"
        >
          From: <span className="text-gray-600 dark:text-gray-400 font-semibold">{production.campaign.title}</span> in
          Commercial <ArrowUpRight size={12} />
        </Link>
      )}

      {/* Quick stats row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Wallet size={16} />}
          label="Budget"
          primary={gbp(totalBudgeted)}
          secondary={`${gbp(totalActual)} actual`}
          accent={
            overBudget ? (
              <span className="text-red-600 inline-flex items-center gap-1">
                <TrendingUp size={12} /> {gbp(Math.abs(variance))} over
              </span>
            ) : (
              <span className="text-emerald-600 inline-flex items-center gap-1">
                <TrendingDown size={12} /> {gbp(variance)} under
              </span>
            )
          }
        />
        <StatCard
          icon={<Users size={16} />}
          label="Team"
          primary={`${teamCounts.total} ${teamCounts.total === 1 ? "person" : "people"}`}
          secondary={`${teamCounts.confirmed} confirmed · ${teamCounts.contracted} contracted`}
        />
        <StatCard
          icon={<ListChecks size={16} />}
          label="Tasks"
          primary={`${completed} / ${tasks.length}`}
          secondary={`${pct}% complete`}
          progress={pct}
        />
        <StatCard
          icon={<CalendarDays size={16} />}
          label="Next shoot"
          primary={nextShoot ? format(nextShoot, "EEE d MMM") : "—"}
          secondary={
            nextShoot
              ? `${(production.callSheets ?? []).length} call sheet${(production.callSheets ?? []).length === 1 ? "" : "s"}`
              : "No dates set"
          }
        />
      </div>

      {/* Shotlist progress — only when call sheets have shots planned */}
      {shots.total > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
              <ListChecks size={15} className="text-[#ff4444]" />
              Shotlist Progress
            </h2>
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
              {shots.done}/{shots.total} shots completed
            </span>
          </div>
          <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#ff4444] rounded-full transition-all"
              style={{ width: `${Math.round((shots.done / shots.total) * 100)}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Description / details */}
        <div className="lg:col-span-2 space-y-5">
          {/* Brief handed over from the Commercial deal */}
          {production.type === "COMMERCIAL" && production.brief && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-emerald-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                  <FileText size={15} className="text-emerald-600" />
                  Brief from Commercial
                </h2>
                <div className="flex items-center gap-2 text-xs">
                  {(production.clientName || production.campaign?.client?.name) && (
                    <span className="text-gray-500 dark:text-gray-400">
                      {production.clientName || production.campaign?.client?.name}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 font-semibold text-[#ffd700] bg-amber-50 rounded-full px-2 py-0.5">
                    <Lock size={10} /> {gbp(production.budgetTotal ?? 0)} budget
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                {production.brief}
              </p>
              {production.campaignId && (
                <Link
                  href={`/commercial/deals/${production.campaignId}`}
                  className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800 transition-colors"
                >
                  View the deal in Commercial <ArrowUpRight size={12} />
                </Link>
              )}
            </div>
          )}

          {/* Phase 4F — structured production brief auto-generated from the deal */}
          {production.briefData && (
            <ProductionBriefPanel briefData={production.briefData} />
          )}

          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5">
            <Label>Description</Label>
            <textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                scheduleSave();
              }}
              rows={4}
              placeholder="What is this project about?"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-100 dark:border-gray-800 text-sm resize-none bg-gray-50/50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-900 focus:bg-white dark:focus:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ffd700]/30 focus:border-[#ffd700] transition-colors"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div>
                <Label>Total Campaign Budget (£)</Label>
                {lockedBudget ? (
                  <div className="w-full px-3 py-2 rounded-xl border border-amber-100 bg-amber-50/40 text-sm flex items-center justify-between gap-2">
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {gbp(production.budgetTotal ?? 0)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#ffd700]">
                      <Lock size={10} /> Budget set in Commercial
                    </span>
                  </div>
                ) : (
                  <input
                    type="number"
                    min="0"
                    value={budget}
                    onChange={(e) => {
                      setBudget(e.target.value);
                      scheduleSave();
                    }}
                    placeholder="0"
                    className="w-full px-3 py-2 rounded-xl border border-gray-100 dark:border-gray-800 text-sm bg-gray-50/50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-900 focus:bg-white dark:focus:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ffd700]/30 focus:border-[#ffd700] transition-colors"
                  />
                )}
              </div>
              <div>
                <Label>Figma Link</Label>
                <input
                  type="url"
                  value={figmaUrl}
                  onChange={(e) => {
                    setFigmaUrl(e.target.value);
                    scheduleSave();
                  }}
                  placeholder="https://figma.com/file/…"
                  className="w-full px-3 py-2 rounded-xl border border-gray-100 dark:border-gray-800 text-sm bg-gray-50/50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-900 focus:bg-white dark:focus:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ffd700]/30 focus:border-[#ffd700] transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Upcoming task */}
          {upcomingTask && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5">
              <Label>Next up</Label>
              <div className="flex items-start gap-3 mt-1">
                <Clock size={16} className="text-[#ffd700] mt-1 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{upcomingTask.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {upcomingTask.owner ? `${upcomingTask.owner} · ` : ""}
                    {upcomingTask.dueDate
                      ? `Due ${format(parseISO(upcomingTask.dueDate), "d MMM")}`
                      : "No due date"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar — linked deal + shoot dates */}
        <div className="space-y-5">
        <LinkedDeal campaignId={production.campaignId} />
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
              <CalendarDays size={15} className="text-[#ffd700]" />
              Shoot Dates
            </h2>
            <button
              onClick={addShoot}
              className="text-xs font-medium text-[#ffd700] hover:text-[#ffd700]"
            >
              + Add
            </button>
          </div>
          {(shootDates ?? []).length === 0 ? (
            <p className="text-xs text-gray-400 py-2">No shoot dates yet.</p>
          ) : (
            <div className="space-y-2">
              {(shootDates ?? []).map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="date"
                    value={d}
                    onChange={(e) => updateShoot(i, e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border border-gray-100 dark:border-gray-800 text-sm bg-gray-50/50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-900 focus:bg-white dark:focus:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ffd700]/30 focus:border-[#ffd700] transition-colors"
                  />
                  <button
                    onClick={() => removeShoot(i)}
                    className="text-xs text-gray-300 hover:text-red-500 px-2"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 pt-4 border-t border-gray-50 text-xs text-gray-500 dark:text-gray-400 space-y-1">
            <p className="flex items-center gap-2">
              <CheckCircle2 size={12} className="text-emerald-500" />
              {(production.callSheets ?? []).length} call sheet
              {(production.callSheets ?? []).length === 1 ? "" : "s"}
            </p>
            <p className="flex items-center gap-2">
              <CheckCircle2 size={12} className="text-emerald-500" />
              {(production.creativeAssets ?? []).length} creative asset
              {(production.creativeAssets ?? []).length === 1 ? "" : "s"}
            </p>
            <p className="flex items-center gap-2">
              <CheckCircle2 size={12} className="text-emerald-500" />
              {(production.prodDeliverables ?? []).length} deliverable
              {(production.prodDeliverables ?? []).length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}

// Phase 4F — structured brief seeded from the Commercial deal.
function ProductionBriefPanel({ briefData }: { briefData: ProductionBriefData }) {
  const deliverables = briefData.deliverables ?? [];
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-blue-100 dark:border-blue-900 shadow-sm p-5">
      <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2 mb-3">
        <FileText size={15} className="text-blue-600 dark:text-blue-400" />
        Production Brief
        <span className="text-[10px] font-normal text-gray-400">auto-generated from the deal</span>
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {briefData.budget != null && (
          <BriefField label="Budget">{gbp(briefData.budget)}</BriefField>
        )}
        {briefData.timeline && <BriefField label="Timeline">{briefData.timeline}</BriefField>}
        {briefData.clientName && <BriefField label="Client">{briefData.clientName}</BriefField>}
        {briefData.targetAudience && (
          <BriefField label="Target Audience">{briefData.targetAudience}</BriefField>
        )}
      </div>
      {briefData.creativeDirection && (
        <div className="mt-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">
            Creative Direction
          </p>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
            {briefData.creativeDirection}
          </p>
        </div>
      )}
      {deliverables.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">
            Deliverables ({deliverables.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {deliverables.map((d, i) => (
              <span
                key={i}
                className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full px-2.5 py-1"
              >
                {d.quantity && d.quantity > 1 ? `${d.quantity}× ` : ""}
                {d.title}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BriefField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{children}</p>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">
      {children}
    </label>
  );
}

function StatCard({
  icon,
  label,
  primary,
  secondary,
  accent,
  progress,
}: {
  icon: React.ReactNode;
  label: string;
  primary: string;
  secondary?: string;
  accent?: React.ReactNode;
  progress?: number;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4">
      <div className="flex items-center gap-2 text-gray-400">
        <span className="text-[#ffd700]">{icon}</span>
        <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
      </div>
      <p className="text-xl font-semibold text-gray-900 dark:text-gray-100 mt-2 truncate">{primary}</p>
      {secondary && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{secondary}</p>}
      {accent && <p className="text-xs mt-1.5 font-medium">{accent}</p>}
      {progress != null && (
        <div className="mt-2 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#ffd700] rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
