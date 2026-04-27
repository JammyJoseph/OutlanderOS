"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  ExternalLink,
  Users,
  Wallet,
  CalendarDays,
  Trash2,
  Check,
  ChevronDown,
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

const PRODUCTION_STATUS_STYLES: Record<
  ProductionStatus,
  { bg: string; text: string; dot: string; label: string }
> = {
  DRAFT: { bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400", label: "Planning" },
  BRIEFED: { bg: "bg-blue-100", text: "text-blue-700", dot: "bg-blue-400", label: "Briefed" },
  PRE_PRODUCTION: {
    bg: "bg-purple-100",
    text: "text-purple-700",
    dot: "bg-purple-400",
    label: "Pre-Production",
  },
  SHOOTING: {
    bg: "bg-amber-100",
    text: "text-amber-700",
    dot: "bg-[#D4A853]",
    label: "Shooting",
  },
  POST_PRODUCTION: {
    bg: "bg-orange-100",
    text: "text-orange-700",
    dot: "bg-orange-400",
    label: "Wrap",
  },
  DELIVERED: {
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    dot: "bg-emerald-400",
    label: "Complete",
  },
  ARCHIVED: { bg: "bg-gray-100", text: "text-gray-400", dot: "bg-gray-300", label: "Archived" },
};

const CS_STATUS_STYLES: Record<CallSheetStatus, { bg: string; text: string; label: string }> = {
  DRAFT: { bg: "bg-gray-100", text: "text-gray-500", label: "Draft" },
  SAVED: { bg: "bg-blue-100", text: "text-blue-700", label: "Saved" },
  PUBLISHED: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Published" },
};

const STATUS_OPTIONS: ProductionStatus[] = [
  "DRAFT",
  "PRE_PRODUCTION",
  "SHOOTING",
  "POST_PRODUCTION",
  "DELIVERED",
];

interface CallSheet {
  id: string;
  shootDate: string;
  callTime: string;
  notes: string | null;
  status: CallSheetStatus;
  location?: { address?: string } | null;
}

interface CrewMember {
  id: string;
  role: string;
  contact: { id: string; name: string; email?: string | null; phone?: string | null };
}

interface Production {
  id: string;
  title: string;
  status: ProductionStatus;
  brief: string | null;
  description: string | null;
  figmaUrl: string | null;
  clientName: string | null;
  budgetTotal: number | null;
  budgetActual: number | null;
  shootDates: string[];
  campaign: { title: string; client: { name: string } } | null;
  callSheets: CallSheet[];
  crew: CrewMember[];
}

function getShootTitle(cs: CallSheet, productionTitle: string): string {
  if (cs.notes) {
    try {
      const parsed = JSON.parse(cs.notes);
      if (parsed.shootTitle) return parsed.shootTitle;
    } catch {}
  }
  return `${productionTitle} — ${format(parseISO(cs.shootDate), "d MMM")}`;
}

function getClient(p: Production): string {
  return p.clientName || p.campaign?.client?.name || "";
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [production, setProduction] = useState<Production | null>(null);
  const [loading, setLoading] = useState(true);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [creatingSheet, setCreatingSheet] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  // Editable form fields (mirror the production)
  const [title, setTitle] = useState("");
  const [client, setClient] = useState("");
  const [description, setDescription] = useState("");
  const [figmaUrl, setFigmaUrl] = useState("");
  const [budget, setBudget] = useState("");
  const [shootDates, setShootDates] = useState<string[]>([]);

  // Hold latest snapshot of editable fields for save
  const fieldsRef = useRef({
    title,
    client,
    description,
    figmaUrl,
    budget,
    shootDates,
  });
  useEffect(() => {
    fieldsRef.current = { title, client, description, figmaUrl, budget, shootDates };
  }, [title, client, description, figmaUrl, budget, shootDates]);

  const load = useCallback(() => {
    fetch(`/api/productions/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.production) {
          const p: Production = d.production;
          setProduction(p);
          setTitle(p.title);
          setClient(p.clientName || p.campaign?.client?.name || "");
          setDescription(p.description || p.brief || "");
          setFigmaUrl(p.figmaUrl || "");
          setBudget(p.budgetTotal != null ? String(p.budgetTotal) : "");
          setShootDates((p.shootDates ?? []).map((d) => d.split("T")[0]));
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Debounced save when fields change
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function scheduleSave() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => savePatch(), 700);
  }

  async function savePatch(patch?: Record<string, unknown>) {
    if (!production) return;
    const f = fieldsRef.current;
    const body: Record<string, unknown> = patch ?? {
      title: f.title,
      clientName: f.client,
      description: f.description,
      figmaUrl: f.figmaUrl,
      budgetTotal: f.budget === "" ? null : Number(f.budget),
      shootDates: (f.shootDates ?? []).filter(Boolean),
    };
    try {
      const res = await fetch(`/api/productions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.production) {
        setProduction((prev) => (prev ? { ...prev, ...data.production } : data.production));
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 1200);
      }
    } catch {}
  }

  async function createCallSheet() {
    if (!production) return;
    setCreatingSheet(true);
    try {
      // Use first available unscheduled shoot date, or today
      const usedDays = new Set(
        (production.callSheets ?? []).map((cs) => cs.shootDate.split("T")[0])
      );
      const candidate = (shootDates ?? []).find((d) => d && !usedDays.has(d));
      const shootDate = candidate || new Date().toISOString().split("T")[0];

      const res = await fetch("/api/call-sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productionId: production.id,
          shootDate: new Date(shootDate + "T08:00:00").toISOString(),
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
    setProduction((p) => (p ? { ...p, status: newStatus } : p));
    await savePatch({ status: newStatus });
  }

  async function deleteProject() {
    if (!production) return;
    if (!confirm("Delete this project? This will also remove its call sheets.")) return;
    await fetch(`/api/productions/${id}`, { method: "DELETE" });
    router.push("/production");
  }

  function updateDate(i: number, value: string) {
    setShootDates((prev) => {
      const next = [...prev];
      next[i] = value;
      return next;
    });
    scheduleSave();
  }

  function addDate() {
    setShootDates((prev) => [...prev, ""]);
  }

  function removeDate(i: number) {
    setShootDates((prev) => prev.filter((_, j) => j !== i));
    scheduleSave();
  }

  const allShootDates = useMemo(() => {
    if (!production) return [] as Date[];
    const out: Date[] = [
      ...(production.callSheets ?? []).map((cs) => parseISO(cs.shootDate)),
      ...(production.shootDates ?? []).map((d) => parseISO(d)),
    ];
    return out;
  }, [production]);

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
          <Link
            href="/production"
            className="text-[#D4A853] text-sm font-medium hover:underline"
          >
            Back to Productions
          </Link>
        </div>
      </div>
    );
  }

  const style = PRODUCTION_STATUS_STYLES[production.status] || PRODUCTION_STATUS_STYLES.DRAFT;

  return (
    <div className="min-h-screen bg-[#F9F9F7]">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Back nav */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/production"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft size={15} />
            Productions
          </Link>
          <div className="flex items-center gap-2">
            {savedFlash && (
              <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                <Check size={12} /> Saved
              </span>
            )}
            <button
              onClick={deleteProject}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors px-2 py-1"
            >
              Delete
            </button>
          </div>
        </div>

        {/* Header card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-5">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center flex-shrink-0 mt-0.5">
              <Film size={22} className="text-[#D4A853]" />
            </div>
            <div className="flex-1 min-w-0">
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  scheduleSave();
                }}
                placeholder="Untitled Project"
                className="text-2xl font-semibold text-gray-900 tracking-tight bg-transparent border-none outline-none w-full placeholder-gray-300 -ml-1 px-1 rounded-md focus:bg-amber-50/40"
              />
              <input
                type="text"
                value={client}
                onChange={(e) => {
                  setClient(e.target.value);
                  scheduleSave();
                }}
                placeholder="Client name"
                className="text-sm text-gray-500 bg-transparent border-none outline-none w-full placeholder-gray-300 -ml-1 px-1 mt-0.5 rounded-md focus:bg-amber-50/40"
              />
              <div className="flex items-center gap-2 mt-3">
                <div className="relative">
                  <button
                    onClick={() => setShowStatusDropdown((v) => !v)}
                    className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full cursor-pointer ${style.bg} ${style.text}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                    {style.label}
                    <ChevronDown size={12} />
                  </button>
                  {showStatusDropdown && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowStatusDropdown(false)}
                      />
                      <div className="absolute top-full left-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg z-20 overflow-hidden w-48 py-1">
                        {STATUS_OPTIONS.map((s) => {
                          const st = PRODUCTION_STATUS_STYLES[s];
                          return (
                            <button
                              key={s}
                              onClick={() => updateStatus(s)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors text-left"
                            >
                              <span className={`w-2 h-2 rounded-full ${st.dot}`} />
                              {st.label}
                              {s === production.status && (
                                <Check size={13} className="ml-auto text-[#D4A853]" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
                {figmaUrl && (
                  <a
                    href={figmaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#D4A853] hover:underline"
                  >
                    Figma <ExternalLink size={11} />
                  </a>
                )}
              </div>
            </div>
            <button
              onClick={createCallSheet}
              disabled={creatingSheet}
              className="flex items-center gap-2 bg-[#D4A853] text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-[#c49843] transition-colors shadow-sm disabled:opacity-60 shrink-0"
            >
              {creatingSheet ? <Loader2 size={15} className="animate-spin" /> : <Plus size={16} />}
              Create Call Sheet
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  scheduleSave();
                }}
                rows={3}
                placeholder="What is this project about?"
                className="w-full px-3 py-2 rounded-xl border border-gray-100 text-sm resize-none bg-gray-50/50 hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853] transition-colors"
              />
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">
                  Figma Link
                </label>
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
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">
                  Budget (£)
                </label>
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
            </div>
          </div>
        </div>

        {/* Calendar + Shoot dates / Crew */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 mb-5">
          {/* Calendar */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden h-full">
              <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  <CalendarDays size={15} className="text-[#D4A853]" />
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
              <div className="p-4">
                <MiniCalendar month={calendarMonth} shootDates={allShootDates} />
              </div>
            </div>
          </div>

          {/* Shoot dates editor + Crew */}
          <div className="lg:col-span-3 space-y-5">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  <CalendarDays size={15} className="text-[#D4A853]" />
                  Shoot Dates
                </h2>
                <button
                  onClick={addDate}
                  className="flex items-center gap-1 text-xs font-medium text-[#D4A853] hover:text-[#c49843] transition-colors"
                >
                  <Plus size={13} /> Add date
                </button>
              </div>
              <div className="p-5">
                {(shootDates ?? []).length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-xs text-gray-400">No shoot dates yet.</p>
                    <button
                      onClick={addDate}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#D4A853] hover:text-[#c49843] transition-colors"
                    >
                      <Plus size={12} /> Add a date
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(shootDates ?? []).map((d, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="date"
                          value={d}
                          onChange={(e) => updateDate(i, e.target.value)}
                          className="flex-1 px-3 py-2 rounded-xl border border-gray-100 text-sm bg-gray-50/50 hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853] transition-colors"
                        />
                        <button
                          onClick={() => removeDate(i)}
                          className="p-2 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Crew */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50">
                <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  <Users size={15} className="text-[#D4A853]" />
                  Crew & Team
                  <span className="text-xs text-gray-400 font-normal">
                    ({(production.crew ?? []).length})
                  </span>
                </h2>
              </div>
              {(production.crew ?? []).length === 0 ? (
                <div className="px-5 py-6 text-center">
                  <p className="text-xs text-gray-400">
                    Crew added through call sheets will appear here.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {(production.crew ?? []).map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between px-5 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {m.contact?.name || "—"}
                        </p>
                        <p className="text-xs text-gray-400">{m.role}</p>
                      </div>
                      {m.contact?.email && (
                        <a
                          href={`mailto:${m.contact.email}`}
                          className="text-xs text-gray-500 hover:text-[#D4A853]"
                        >
                          {m.contact.email}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Call sheets */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <ClipboardList size={15} className="text-[#D4A853]" />
              Call Sheets
              <span className="text-xs text-gray-400 font-normal">
                ({(production.callSheets ?? []).length})
              </span>
            </h2>
            <button
              onClick={createCallSheet}
              disabled={creatingSheet}
              className="flex items-center gap-1 text-xs font-medium text-[#D4A853] hover:text-[#c49843] transition-colors disabled:opacity-60"
            >
              {creatingSheet ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              New
            </button>
          </div>

          {(production.callSheets ?? []).length === 0 ? (
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
              {(production.callSheets ?? [])
                .slice()
                .sort(
                  (a, b) => new Date(a.shootDate).getTime() - new Date(b.shootDate).getTime()
                )
                .map((cs) => {
                  const csStyle = CS_STATUS_STYLES[cs.status] || CS_STATUS_STYLES.DRAFT;
                  const sheetTitle = getShootTitle(cs, production.title);
                  const addr = (cs.location as { address?: string } | null)?.address;
                  return (
                    <Link
                      key={cs.id}
                      href={`/production/${production.id}/call-sheets/${cs.id}`}
                      className="flex items-center justify-between px-5 py-4 hover:bg-gray-50/60 transition-colors group"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="text-center w-11 shrink-0">
                          <div className="text-[10px] font-semibold text-[#D4A853] uppercase leading-none">
                            {format(parseISO(cs.shootDate), "MMM")}
                          </div>
                          <div className="text-xl font-bold text-gray-800 leading-tight">
                            {format(parseISO(cs.shootDate), "d")}
                          </div>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 group-hover:text-[#D4A853] transition-colors truncate">
                            {sheetTitle}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5 truncate">
                            {cs.callTime || "—"} {addr ? `· ${addr}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
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
          <div
            key={i}
            className="text-center text-[10px] font-semibold text-gray-400 py-1"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {(days ?? []).map((day, i) => {
          const isShootDay = (shootDates ?? []).some((sd) => isSameDay(sd, day));
          const isCurrentDay = isSameDay(day, today);
          const inMonth = isSameMonth(day, month);
          return (
            <div key={i} className="flex flex-col items-center justify-center py-1">
              <div
                className={`
                  w-7 h-7 flex items-center justify-center rounded-lg text-xs font-medium transition-colors
                  ${
                    !inMonth
                      ? "text-gray-300"
                      : isCurrentDay
                      ? "bg-gray-900 text-white"
                      : "text-gray-700 hover:bg-gray-50"
                  }
                  ${
                    isShootDay && inMonth
                      ? "ring-2 ring-[#D4A853] ring-offset-1"
                      : ""
                  }
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
      {(shootDates ?? []).filter((d) => isSameMonth(d, month)).length === 0 && (
        <p className="text-xs text-gray-400 text-center mt-3">No shoots this month</p>
      )}
    </div>
  );
}
