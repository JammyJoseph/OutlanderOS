"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Film,
  Plus,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  parseISO,
} from "date-fns";

type ProductionStatus =
  | "DRAFT"
  | "BRIEFED"
  | "PRE_PRODUCTION"
  | "SHOOTING"
  | "POST_PRODUCTION"
  | "DELIVERED"
  | "ARCHIVED";

type CallSheetStatus = "DRAFT" | "SAVED" | "PUBLISHED";

const PRODUCTION_STATUS_STYLES: Record<ProductionStatus, { bg: string; text: string; label: string }> = {
  DRAFT: { bg: "bg-gray-100", text: "text-gray-600", label: "Draft" },
  BRIEFED: { bg: "bg-blue-100", text: "text-blue-700", label: "Briefed" },
  PRE_PRODUCTION: { bg: "bg-purple-100", text: "text-purple-700", label: "Pre-Production" },
  SHOOTING: { bg: "bg-amber-100", text: "text-amber-700", label: "Shooting" },
  POST_PRODUCTION: { bg: "bg-orange-100", text: "text-orange-700", label: "Post" },
  DELIVERED: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Delivered" },
  ARCHIVED: { bg: "bg-gray-100", text: "text-gray-400", label: "Archived" },
};

const CS_STATUS_STYLES: Record<CallSheetStatus, { bg: string; text: string; label: string }> = {
  DRAFT: { bg: "bg-gray-100", text: "text-gray-500", label: "Draft" },
  SAVED: { bg: "bg-blue-100", text: "text-blue-600", label: "Saved" },
  PUBLISHED: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Published" },
};

interface CallSheet {
  id: string;
  shootDate: string;
  callTime: string;
  notes: string | null;
  status: CallSheetStatus;
}

interface Production {
  id: string;
  title: string;
  status: ProductionStatus;
  brief: string | null;
  shootDates: string[];
  campaign: { title: string; client: { name: string } } | null;
  callSheets: CallSheet[];
}

function getShootTitle(cs: CallSheet, productionTitle: string): string {
  if (cs.notes) {
    try {
      const parsed = JSON.parse(cs.notes);
      if (parsed.shootTitle) return parsed.shootTitle;
    } catch {}
  }
  return `${productionTitle} — ${format(parseISO(cs.shootDate), "d MMM yyyy")}`;
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [production, setProduction] = useState<Production | null>(null);
  const [loading, setLoading] = useState(true);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [creatingSheet, setCreatingSheet] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/productions/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.production) setProduction(d.production);
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function createCallSheet() {
    if (!production) return;
    setCreatingSheet(true);
    try {
      const res = await fetch("/api/call-sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productionId: production.id,
          shootDate: new Date().toISOString(),
          status: "DRAFT",
        }),
      });
      const data = await res.json();
      if (data.sheet) {
        router.push(`/production/${production.id}/call-sheets/${data.sheet.id}`);
      }
    } finally {
      setCreatingSheet(false);
    }
  }

  async function updateStatus(newStatus: ProductionStatus) {
    if (!production) return;
    setShowStatusDropdown(false);
    await fetch(`/api/productions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setProduction((p) => p ? { ...p, status: newStatus } : p);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9F9F7] flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!production) {
    return (
      <div className="min-h-screen bg-[#F9F9F7] flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Project not found.</p>
          <Link href="/production" className="text-[#D4A853] text-sm font-medium hover:underline">
            Back to Productions
          </Link>
        </div>
      </div>
    );
  }

  const style = PRODUCTION_STATUS_STYLES[production.status] || PRODUCTION_STATUS_STYLES.DRAFT;
  const allShootDates = [
    ...production.callSheets.map((cs) => parseISO(cs.shootDate)),
    ...production.shootDates.map((d) => parseISO(d)),
  ];

  return (
    <div className="min-h-screen bg-[#F9F9F7]">
      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Back */}
        <Link
          href="/production"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors"
        >
          <ArrowLeft size={15} />
          Productions
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center flex-shrink-0 mt-0.5">
              <Film size={22} className="text-[#D4A853]" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">{production.title}</h1>
              {production.campaign?.client?.name && (
                <p className="text-gray-500 text-sm mt-0.5">{production.campaign.client.name}</p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <div className="relative">
                  <button
                    onClick={() => setShowStatusDropdown((v) => !v)}
                    className={`text-xs font-medium px-2.5 py-1 rounded-full cursor-pointer ${style.bg} ${style.text}`}
                  >
                    {style.label}
                  </button>
                  {showStatusDropdown && (
                    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg z-20 overflow-hidden w-44">
                      {(Object.keys(PRODUCTION_STATUS_STYLES) as ProductionStatus[]).map((s) => {
                        const st = PRODUCTION_STATUS_STYLES[s];
                        return (
                          <button
                            key={s}
                            onClick={() => updateStatus(s)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors text-left"
                          >
                            <span className={`w-2 h-2 rounded-full ${st.bg.replace("bg-", "bg-").replace("-100", "-400")}`} />
                            {st.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={createCallSheet}
            disabled={creatingSheet}
            className="flex items-center gap-2 bg-[#D4A853] text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-[#c49843] transition-colors shadow-sm disabled:opacity-60"
          >
            {creatingSheet ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Plus size={16} />
            )}
            Create Call Sheet
          </button>
        </div>

        {/* Brief */}
        {production.brief && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
            <p className="text-sm text-gray-600 leading-relaxed">{production.brief}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Calendar */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-800">
                  {format(calendarMonth, "MMMM yyyy")}
                </h2>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCalendarMonth((m) => subMonths(m, 1))}
                    className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <button
                    onClick={() => setCalendarMonth((m) => addMonths(m, 1))}
                    className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
              <MiniCalendar month={calendarMonth} shootDates={allShootDates} />
            </div>
          </div>

          {/* Call sheets */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  <ClipboardList size={15} className="text-gray-400" />
                  Call Sheets
                  <span className="text-xs text-gray-400 font-normal">
                    ({production.callSheets.length})
                  </span>
                </h2>
              </div>

              {production.callSheets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-center px-6">
                  <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center mb-3">
                    <ClipboardList size={20} className="text-gray-300" />
                  </div>
                  <p className="text-sm text-gray-500 mb-1 font-medium">No call sheets yet</p>
                  <p className="text-xs text-gray-400 mb-5">
                    Create a call sheet to start planning your shoot.
                  </p>
                  <button
                    onClick={createCallSheet}
                    disabled={creatingSheet}
                    className="flex items-center gap-1.5 text-xs font-medium text-[#D4A853] hover:text-[#c49843] transition-colors"
                  >
                    <Plus size={13} />
                    Create Call Sheet
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {production.callSheets
                    .sort((a, b) => new Date(a.shootDate).getTime() - new Date(b.shootDate).getTime())
                    .map((cs) => {
                      const csStyle = CS_STATUS_STYLES[cs.status] || CS_STATUS_STYLES.DRAFT;
                      const title = getShootTitle(cs, production.title);
                      return (
                        <Link
                          key={cs.id}
                          href={`/production/${production.id}/call-sheets/${cs.id}`}
                          className="flex items-center justify-between px-5 py-4 hover:bg-gray-50/60 transition-colors group"
                        >
                          <div className="flex items-center gap-3">
                            <div className="text-center w-10">
                              <div className="text-[10px] font-semibold text-[#D4A853] uppercase leading-none">
                                {format(parseISO(cs.shootDate), "MMM")}
                              </div>
                              <div className="text-xl font-bold text-gray-800 leading-tight">
                                {format(parseISO(cs.shootDate), "d")}
                              </div>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-800 group-hover:text-[#D4A853] transition-colors">
                                {title}
                              </p>
                              <p className="text-xs text-gray-400 mt-0.5">{cs.callTime}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span
                              className={`text-xs font-medium px-2 py-0.5 rounded-full ${csStyle.bg} ${csStyle.text}`}
                            >
                              {csStyle.label}
                            </span>
                            <ChevronRight
                              size={15}
                              className="text-gray-300 group-hover:text-[#D4A853] transition-colors"
                            />
                          </div>
                        </Link>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showStatusDropdown && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setShowStatusDropdown(false)}
        />
      )}
    </div>
  );
}

function MiniCalendar({ month, shootDates }: { month: Date; shootDates: Date[] }) {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });
  const today = new Date();
  const dayLabels = ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <div>
      <div className="grid grid-cols-7 mb-1">
        {dayLabels.map((d, i) => (
          <div key={i} className="text-center text-[10px] font-semibold text-gray-400 py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map((day, i) => {
          const isShootDay = shootDates.some((sd) => isSameDay(sd, day));
          const isToday = isSameDay(day, today);
          const inMonth = isSameMonth(day, month);
          return (
            <div
              key={i}
              className="flex flex-col items-center justify-center py-1"
            >
              <div
                className={`
                  w-7 h-7 flex items-center justify-center rounded-lg text-xs font-medium transition-colors
                  ${!inMonth ? "text-gray-300" : isToday ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-50"}
                  ${isShootDay && inMonth ? "ring-2 ring-[#D4A853] ring-offset-1" : ""}
                `}
              >
                {format(day, "d")}
              </div>
              {isShootDay && inMonth && (
                <div className="w-1 h-1 rounded-full bg-[#D4A853] mt-0.5" />
              )}
            </div>
          );
        })}
      </div>
      {shootDates.filter((d) => isSameMonth(d, month)).length === 0 && (
        <p className="text-xs text-gray-400 text-center mt-3">No shoots this month</p>
      )}
    </div>
  );
}
