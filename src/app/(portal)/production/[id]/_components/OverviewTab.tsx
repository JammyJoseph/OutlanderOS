"use client";

import { useMemo } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ListChecks,
  Wallet,
  Users,
  TrendingDown,
  TrendingUp,
  Clock,
} from "lucide-react";
import { format, parseISO, isAfter, startOfDay } from "date-fns";
import { ProductionFull, gbp } from "./types";
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
  refresh: () => void;
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
  refresh,
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

  return (
    <div className="space-y-5">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Description / details */}
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <Label>Description</Label>
            <textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                scheduleSave();
              }}
              rows={4}
              placeholder="What is this project about?"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-100 text-sm resize-none bg-gray-50/50 hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853] transition-colors"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div>
                <Label>Total Campaign Budget (£)</Label>
                <input
                  type="number"
                  min="0"
                  value={budget}
                  onChange={(e) => {
                    setBudget(e.target.value);
                    scheduleSave();
                  }}
                  placeholder="0"
                  className="w-full px-3 py-2 rounded-xl border border-gray-100 text-sm bg-gray-50/50 hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853] transition-colors"
                />
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
                  className="w-full px-3 py-2 rounded-xl border border-gray-100 text-sm bg-gray-50/50 hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853] transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Upcoming task */}
          {upcomingTask && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <Label>Next up</Label>
              <div className="flex items-start gap-3 mt-1">
                <Clock size={16} className="text-[#D4A853] mt-1 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{upcomingTask.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
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
        <LinkedDeal
          productionId={production.id}
          trelloCardId={production.trelloCardId}
          onChange={refresh}
        />
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <CalendarDays size={15} className="text-[#D4A853]" />
              Shoot Dates
            </h2>
            <button
              onClick={addShoot}
              className="text-xs font-medium text-[#D4A853] hover:text-[#c49843]"
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
                    className="flex-1 px-3 py-2 rounded-xl border border-gray-100 text-sm bg-gray-50/50 hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853] transition-colors"
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
          <div className="mt-4 pt-4 border-t border-gray-50 text-xs text-gray-500 space-y-1">
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
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center gap-2 text-gray-400">
        <span className="text-[#D4A853]">{icon}</span>
        <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
      </div>
      <p className="text-xl font-semibold text-gray-900 mt-2 truncate">{primary}</p>
      {secondary && <p className="text-xs text-gray-500 mt-0.5 truncate">{secondary}</p>}
      {accent && <p className="text-xs mt-1.5 font-medium">{accent}</p>}
      {progress != null && (
        <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#D4A853] rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
