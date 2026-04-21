"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type CampaignType =
  | "SUPPLIED_ASSET"
  | "BESPOKE_PRODUCTION"
  | "WHITE_LABEL"
  | "EDITORIAL_FEATURE"
  | "PRINT_AD";

interface Campaign {
  id: string;
  title: string;
  client: { name: string };
  type: CampaignType;
  timelineStart: string | null;
  timelineEnd: string | null;
  value?: number;
  currency: string;
}

const TYPE_COLORS: Record<CampaignType, string> = {
  SUPPLIED_ASSET: "bg-blue-400",
  BESPOKE_PRODUCTION: "bg-pink-400",
  WHITE_LABEL: "bg-purple-400",
  EDITORIAL_FEATURE: "bg-amber-400",
  PRINT_AD: "bg-rose-400",
};

const TYPE_LABELS: Record<CampaignType, string> = {
  SUPPLIED_ASSET: "Supplied",
  BESPOKE_PRODUCTION: "Bespoke",
  WHITE_LABEL: "White Label",
  EDITORIAL_FEATURE: "Editorial",
  PRINT_AD: "Print Ad",
};

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function CampaignCalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  useEffect(() => {
    fetch("/api/campaigns")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setCampaigns(data);
      })
      .catch(() => {});
  }, []);

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }

  function campaignsForDay(day: number): Campaign[] {
    const date = new Date(year, month, day);
    date.setHours(12, 0, 0, 0);
    return campaigns.filter((c) => {
      if (!c.timelineStart || !c.timelineEnd) return false;
      const start = new Date(c.timelineStart);
      const end = new Date(c.timelineEnd);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return date >= start && date <= end;
    });
  }

  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const cells: (number | null)[] = [
    ...Array(getFirstDayOfMonth(year, month)).fill(null),
    ...Array.from({ length: getDaysInMonth(year, month) }, (_, i) => i + 1),
  ];

  // Count active campaigns this month
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  const activeCampaigns = campaigns.filter((c) => {
    if (!c.timelineStart || !c.timelineEnd) return false;
    return new Date(c.timelineEnd) >= monthStart && new Date(c.timelineStart) <= monthEnd;
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Campaign Calendar</h1>
          <p className="text-xs text-gray-500">
            {activeCampaigns.length} active this month
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50"
          >
            <ChevronLeft className="h-4 w-4 text-gray-600" />
          </button>
          <span className="min-w-[140px] text-center text-sm font-semibold text-gray-900">
            {MONTHS[month]} {year}
          </span>
          <button
            onClick={nextMonth}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50"
          >
            <ChevronRight className="h-4 w-4 text-gray-600" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-7 mb-1">
          {DAYS.map((d) => (
            <div
              key={d}
              className="py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-400"
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-xl overflow-hidden border border-gray-200">
          {cells.map((day, idx) => {
            const dayCampaigns = day ? campaignsForDay(day) : [];
            return (
              <div
                key={idx}
                className={`min-h-[100px] p-2 ${day ? "bg-white" : "bg-gray-50"}`}
              >
                {day && (
                  <>
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                        isToday(day) ? "bg-[#D4A853] text-white" : "text-gray-700"
                      }`}
                    >
                      {day}
                    </span>
                    <div className="mt-1 space-y-0.5">
                      {dayCampaigns.slice(0, 3).map((c) => (
                        <div
                          key={c.id}
                          title={`${c.client.name} — ${c.title}`}
                          className={`truncate rounded px-1 py-0.5 text-[10px] font-medium text-white ${
                            TYPE_COLORS[c.type] ?? "bg-gray-400"
                          }`}
                        >
                          {c.client.name}
                        </div>
                      ))}
                      {dayCampaigns.length > 3 && (
                        <p className="text-[9px] text-gray-400">+{dayCampaigns.length - 3} more</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-4">
          {Object.entries(TYPE_LABELS).map(([type, label]) => (
            <div key={type} className="flex items-center gap-1.5">
              <div className={`h-2.5 w-2.5 rounded-full ${TYPE_COLORS[type as CampaignType]}`} />
              <span className="text-xs text-gray-500">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
