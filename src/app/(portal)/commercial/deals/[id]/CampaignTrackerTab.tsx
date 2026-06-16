"use client";

import { useState, useMemo } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  CheckCircle2,
  Link as LinkIcon,
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

// Schedule status drives the calendar dot colours.
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

export default function CampaignTrackerTab({
  dealId,
  initial,
  onChanged,
}: {
  dealId: string;
  initial: Deliverable[];
  onChanged: () => Promise<void>;
}) {
  const [items, setItems] = useState<TrackedDeliverable[]>(
    initial.map((d) => ({ ...d, scheduleStatus: (d as TrackedDeliverable).scheduleStatus ?? "PENDING" }))
  );
  const [month, setMonth] = useState<Date>(() => {
    const withDate = initial.find((d) => d.dueDate);
    return withDate?.dueDate ? startOfMonth(parseISO(withDate.dueDate)) : startOfMonth(new Date());
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

  const byDay = useMemo(() => {
    const map = new Map<string, TrackedDeliverable[]>();
    for (const d of items) {
      if (!d.dueDate) continue;
      const key = format(parseISO(d.dueDate), "yyyy-MM-dd");
      const arr = map.get(key) ?? [];
      arr.push(d);
      map.set(key, arr);
    }
    return map;
  }, [items]);

  const unscheduled = items.filter((d) => !d.dueDate);

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Link banking overview */}
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

      {/* Media calendar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <CalendarDays size={15} className="text-[#ffd700]" />
            Media Calendar
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
          {SCHEDULE_STATUSES.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5 text-[11px] text-gray-500">
              <span className={`w-2 h-2 rounded-full ${s.dot}`} /> {s.label}
            </span>
          ))}
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
            const dayItems = byDay.get(key) ?? [];
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
                  {dayItems.map((d) => {
                    const st = schedStyle(d.scheduleStatus);
                    return (
                      <div
                        key={d.id}
                        title={`${d.title || d.type} · ${st.label}`}
                        className={`text-[10px] leading-tight px-1.5 py-0.5 rounded ${st.chip} flex items-center gap-1 truncate`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${st.dot} shrink-0`} />
                        <span className="truncate">{d.title || d.type}</span>
                      </div>
                    );
                  })}
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
