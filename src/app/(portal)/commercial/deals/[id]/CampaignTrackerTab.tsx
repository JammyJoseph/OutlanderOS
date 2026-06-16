"use client";

import { useState, useMemo } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  CheckCircle2,
  Link as LinkIcon,
  Film,
  Banknote,
  Clapperboard,
  PackageCheck,
} from "lucide-react";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
} from "date-fns";
import type { Deliverable } from "./DeliverablesTab";

// Schedule status drives the deliverable dot colours.
const SCHEDULE_STATUSES = [
  { key: "PENDING", label: "Pending", dot: "bg-gray-400", chip: "bg-gray-100 text-gray-600" },
  { key: "SCHEDULED", label: "Scheduled", dot: "bg-sky-400", chip: "bg-sky-100 text-sky-700" },
  { key: "LIVE", label: "Live", dot: "bg-emerald-400", chip: "bg-emerald-100 text-emerald-700" },
  { key: "LATE", label: "Late", dot: "bg-red-400", chip: "bg-red-100 text-red-700" },
];

function schedStyle(s: string) {
  return SCHEDULE_STATUSES.find((x) => x.key === s) ?? SCHEDULE_STATUSES[0];
}

interface TrackedDeliverable extends Deliverable {
  scheduleStatus: string;
}

interface ProductionInfo {
  id: string;
  title: string;
  status: string;
  shootDates: string[];
}

// A single calendar event — a deliverable, a shoot, or the payment due date.
type CalEvent =
  | { kind: "deliverable"; label: string; dot: string; chip: string }
  | { kind: "shoot"; label: string; dot: string; chip: string }
  | { kind: "payment"; label: string; dot: string; chip: string };

const PRODUCTION_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Planning",
  BRIEFED: "Briefed",
  PRE_PRODUCTION: "Pre-Production",
  SHOOTING: "Shooting",
  POST_PRODUCTION: "Wrap",
  DELIVERED: "Complete",
  ARCHIVED: "Archived",
};

export default function CampaignTrackerTab({
  dealId,
  initial,
  workflowType,
  dueDate,
  production,
  onChanged,
}: {
  dealId: string;
  initial: Deliverable[];
  workflowType: string;
  dueDate: string | null;
  production: ProductionInfo | null;
  onChanged: () => Promise<void>;
}) {
  const bespoke = workflowType !== "SUPPLIED_ASSETS";
  const [items, setItems] = useState<TrackedDeliverable[]>(
    initial.map((d) => ({ ...d, scheduleStatus: (d as TrackedDeliverable).scheduleStatus ?? "PENDING" }))
  );
  const [month, setMonth] = useState<Date>(() => {
    const withDate = initial.find((d) => d.dueDate);
    if (withDate?.dueDate) return startOfMonth(parseISO(withDate.dueDate));
    if (production?.shootDates?.[0]) return startOfMonth(parseISO(production.shootDates[0]));
    return startOfMonth(new Date());
  });

  async function patch(item: TrackedDeliverable, data: Record<string, unknown>) {
    setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, ...data } : x)));
    await fetch(`/api/commercial/deals/${dealId}/deliverables/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    onChanged();
  }

  const liveCount = items.filter((d) => d.postedUrl).length;
  const days = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [month]);

  // Combine deliverable due dates, production shoot dates, and the payment due
  // date into one calendar keyed by day.
  const byDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    const push = (date: Date, ev: CalEvent) => {
      const key = format(date, "yyyy-MM-dd");
      const arr = map.get(key) ?? [];
      arr.push(ev);
      map.set(key, arr);
    };
    for (const d of items) {
      if (!d.dueDate) continue;
      const st = schedStyle(d.scheduleStatus);
      push(parseISO(d.dueDate), { kind: "deliverable", label: d.title || d.type, dot: st.dot, chip: st.chip });
    }
    for (const sd of production?.shootDates ?? []) {
      push(parseISO(sd), { kind: "shoot", label: "Shoot day", dot: "bg-red-500", chip: "bg-red-100 text-red-700" });
    }
    if (dueDate) {
      push(parseISO(dueDate), {
        kind: "payment",
        label: "Payment due",
        dot: "bg-blue-500",
        chip: "bg-blue-100 text-blue-700",
      });
    }
    return map;
  }, [items, production, dueDate]);

  const unscheduled = items.filter((d) => !d.dueDate);

  // Bespoke production milestones — derived from production status, shoot dates,
  // and delivered deliverables.
  const milestones = useMemo(() => {
    if (!bespoke) return [];
    const shoots = (production?.shootDates ?? []).map((d) => parseISO(d)).sort((a, b) => a.getTime() - b.getTime());
    const status = production?.status ?? null;
    const order = ["DRAFT", "BRIEFED", "PRE_PRODUCTION", "SHOOTING", "POST_PRODUCTION", "DELIVERED"];
    const statusIdx = status ? order.indexOf(status) : -1;
    const delivered = items.filter((d) => d.status === "DELIVERED").length;
    return [
      {
        key: "preprod",
        label: "Pre-Production",
        icon: <Clapperboard size={14} />,
        detail: status ? PRODUCTION_STATUS_LABELS[status] ?? status : "Not started",
        done: statusIdx >= order.indexOf("PRE_PRODUCTION"),
      },
      {
        key: "shoot",
        label: "Shoot",
        icon: <Film size={14} />,
        detail:
          shoots.length > 0
            ? shoots.map((d) => format(d, "d MMM")).join(" · ")
            : "No shoot dates yet",
        done: statusIdx >= order.indexOf("SHOOTING"),
      },
      {
        key: "post",
        label: "Post-Production",
        icon: <Clapperboard size={14} />,
        detail: statusIdx >= order.indexOf("POST_PRODUCTION") ? "In progress / done" : "Pending",
        done: statusIdx >= order.indexOf("POST_PRODUCTION"),
      },
      {
        key: "delivery",
        label: "Delivery",
        icon: <PackageCheck size={14} />,
        detail: `${delivered}/${items.length} deliverables delivered`,
        done: items.length > 0 && delivered === items.length,
      },
    ];
  }, [bespoke, production, items]);

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Bespoke milestones */}
      {bespoke && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <Film size={15} className="text-[#ff4444]" />
              Production Milestones
            </h3>
            {production ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-50 text-[11px] font-medium text-red-600">
                {PRODUCTION_STATUS_LABELS[production.status] ?? production.status}
              </span>
            ) : (
              <span className="text-[11px] text-gray-400">Not yet cleared for production</span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {milestones.map((m) => (
              <div
                key={m.key}
                className={`rounded-xl border px-3 py-3 ${
                  m.done ? "border-emerald-100 bg-emerald-50/50" : "border-gray-100 bg-gray-50/60"
                }`}
              >
                <div className={`flex items-center gap-1.5 text-xs font-semibold ${m.done ? "text-emerald-700" : "text-gray-600"}`}>
                  {m.done ? <CheckCircle2 size={14} /> : m.icon}
                  {m.label}
                </div>
                <p className="text-[11px] text-gray-400 mt-1 leading-snug">{m.detail}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Link banking — supplied/print go-live tracking */}
      {!bespoke && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <LinkIcon size={15} className="text-[#ffd700]" />
              Link Banking
            </h3>
            <span className="text-sm font-semibold text-gray-700">
              {liveCount}/{items.length} live
            </span>
          </div>
          <p className="text-xs text-gray-400 mb-4">
            Paste the live URL for each post once it goes out. Status colours track go-live.
          </p>

          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 py-8 text-center text-sm text-gray-400">
              No deliverables yet — add them on the Deliverables tab and they appear here.
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((d) => {
                const st = schedStyle(d.scheduleStatus);
                return (
                  <div
                    key={d.id}
                    className="flex items-center gap-3 rounded-xl border border-gray-100 px-4 py-3 hover:bg-gray-50/60 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{d.title || d.type}</p>
                      {d.dueDate && (
                        <p className="text-[11px] text-gray-400 flex items-center gap-1">
                          <CalendarDays size={11} /> {format(parseISO(d.dueDate), "d MMM yyyy")}
                        </p>
                      )}
                    </div>
                    <select
                      value={d.scheduleStatus}
                      onChange={(e) => patch(d, { scheduleStatus: e.target.value })}
                      className={`text-[11px] font-semibold rounded-full px-2.5 py-1 cursor-pointer focus:outline-none ${st.chip}`}
                    >
                      {SCHEDULE_STATUSES.map((s) => (
                        <option key={s.key} value={s.key}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="url"
                      defaultValue={d.postedUrl ?? ""}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v !== (d.postedUrl ?? "")) {
                          patch(d, { postedUrl: v || null, ...(v ? { scheduleStatus: "LIVE" } : {}) });
                        }
                      }}
                      placeholder="Paste live link…"
                      className="w-44 px-3 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#ffd700]/30 focus:border-[#ffd700]"
                    />
                    {d.postedUrl ? (
                      <a
                        href={d.postedUrl.startsWith("http") ? d.postedUrl : `https://${d.postedUrl}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 shrink-0"
                      >
                        <CheckCircle2 size={12} /> Live <ExternalLink size={11} />
                      </a>
                    ) : (
                      <span className="text-[11px] text-gray-300 shrink-0 w-12 text-center">—</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Campaign calendar — deliverables, shoots, and payment due date */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <CalendarDays size={15} className="text-[#ffd700]" />
            Campaign Calendar
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMonth((m) => subMonths(m, 1))}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium text-gray-700 w-32 text-center">
              {format(month, "MMMM yyyy")}
            </span>
            <button
              onClick={() => setMonth((m) => addMonths(m, 1))}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mb-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-500">
            <span className="w-2 h-2 rounded-full bg-red-500" /> Shoot
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-500">
            <span className="w-2 h-2 rounded-full bg-emerald-400" /> Content live
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-500">
            <span className="w-2 h-2 rounded-full bg-sky-400" /> Scheduled
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-500">
            <Banknote size={12} className="text-blue-500" /> Payment due
          </span>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center mb-1">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 py-1">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const dayEvents = byDay.get(key) ?? [];
            const inMonth = isSameMonth(day, month);
            const today = isSameDay(day, new Date());
            return (
              <div
                key={key}
                className={`min-h-[72px] rounded-lg border p-1.5 ${
                  inMonth ? "border-gray-100 bg-white" : "border-gray-50 bg-gray-50/50"
                } ${today ? "ring-1 ring-[#ffd700]" : ""}`}
              >
                <p className={`text-[10px] font-semibold ${inMonth ? "text-gray-500" : "text-gray-300"}`}>
                  {format(day, "d")}
                </p>
                <div className="space-y-1 mt-0.5">
                  {dayEvents.map((ev, i) => (
                    <div
                      key={i}
                      title={ev.label}
                      className={`text-[10px] leading-tight px-1.5 py-0.5 rounded ${ev.chip} flex items-center gap-1 truncate`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${ev.dot} shrink-0`} />
                      <span className="truncate">{ev.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {unscheduled.length > 0 && (
          <p className="text-[11px] text-gray-400 mt-3">
            {unscheduled.length} deliverable{unscheduled.length === 1 ? "" : "s"} have no due date — set one
            on the Deliverables tab to schedule them.
          </p>
        )}
      </div>
    </div>
  );
}
