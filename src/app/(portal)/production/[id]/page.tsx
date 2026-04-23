"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Film,
  Calendar,
  DollarSign,
  Users,
  ClipboardList,
  ExternalLink,
  Clock,
  MapPin,
  ChevronRight,
  Loader2,
  Package,
  TrendingUp,
  Edit2,
  X,
  Check,
} from "lucide-react";
import { format, isAfter } from "date-fns";

type ProductionStatus =
  | "DRAFT"
  | "BRIEFED"
  | "PRE_PRODUCTION"
  | "SHOOTING"
  | "POST_PRODUCTION"
  | "DELIVERED"
  | "ARCHIVED";

const STATUS_STYLES: Record<ProductionStatus, { bg: string; text: string; label: string }> = {
  DRAFT: { bg: "bg-gray-100", text: "text-gray-600", label: "Draft" },
  BRIEFED: { bg: "bg-blue-100", text: "text-blue-700", label: "Briefed" },
  PRE_PRODUCTION: { bg: "bg-purple-100", text: "text-purple-700", label: "Pre-Production" },
  SHOOTING: { bg: "bg-amber-100", text: "text-amber-700", label: "Shooting" },
  POST_PRODUCTION: { bg: "bg-orange-100", text: "text-orange-700", label: "Post" },
  DELIVERED: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Delivered" },
  ARCHIVED: { bg: "bg-gray-100", text: "text-gray-400", label: "Archived" },
};

const BUDGET_CATEGORIES = ["Crew", "Studio", "Equipment", "Travel", "Catering", "Post"];

interface CallSheetSummary {
  id: string;
  shootDate: string;
  callTime: string;
  location: { address?: string };
  notes: string | null;
  distributedAt: string | null;
}

interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
}

interface Production {
  id: string;
  title: string;
  brief: string | null;
  status: ProductionStatus;
  budgetTotal: number | null;
  budgetActual: number | null;
  marginTarget: number | null;
  shootDates: string[];
  campaign: {
    id: string;
    title: string;
    client: { id: string; name: string };
  } | null;
  crew: { id: string; role: string; confirmed: boolean; contact: { name: string; email?: string } }[];
  callSheets: CallSheetSummary[];
  expenses: Expense[];
}

function shootTitle(sheet: CallSheetSummary) {
  try {
    if (sheet.notes?.startsWith("{")) {
      const m = JSON.parse(sheet.notes);
      if (m.shootTitle) return m.shootTitle;
    }
  } catch {}
  return format(new Date(sheet.shootDate), "EEE d MMM yyyy");
}

function sheetStatus(sheet: CallSheetSummary): string {
  if (sheet.distributedAt) return "Sent";
  try {
    if (sheet.notes?.startsWith("{")) {
      const m = JSON.parse(sheet.notes);
      if (m.status) return m.status;
    }
  } catch {}
  return "Draft";
}

const SHEET_STATUS_BADGE: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-600",
  Sent: "bg-blue-100 text-blue-700",
  Confirmed: "bg-emerald-100 text-emerald-700",
};

export default function ProductionDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [production, setProduction] = useState<Production | null>(null);
  const [loading, setLoading] = useState(true);
  const [figmaUrl, setFigmaUrl] = useState("");
  const [editingBrief, setEditingBrief] = useState(false);
  const [briefDraft, setBriefDraft] = useState("");
  const [savingBrief, setSavingBrief] = useState(false);
  const [savedBrief, setSavedBrief] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/productions/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setProduction(data.production);
        setBriefDraft(data.production?.brief || "");
        setLoading(false);
      });
  }, [id]);

  async function saveBrief() {
    if (!production) return;
    setSavingBrief(true);
    try {
      await fetch(`/api/productions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: briefDraft }),
      });
      setProduction((p) => (p ? { ...p, brief: briefDraft } : p));
      setEditingBrief(false);
      setSavedBrief(true);
      setTimeout(() => setSavedBrief(false), 2000);
    } finally {
      setSavingBrief(false);
    }
  }

  async function updateStatus(status: ProductionStatus) {
    if (!production) return;
    await fetch(`/api/productions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setProduction((p) => (p ? { ...p, status } : p));
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#D4A853]" />
      </div>
    );
  }

  if (!production) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-sm text-gray-500">Production not found.</p>
        <Link
          href="/production"
          className="rounded-lg bg-[#D4A853] px-4 py-2 text-xs font-semibold text-white"
        >
          Back to Overview
        </Link>
      </div>
    );
  }

  const s = STATUS_STYLES[production.status];
  const upcomingSheets = production.callSheets.filter((cs) =>
    isAfter(new Date(cs.shootDate), new Date())
  );
  const totalExpenses = production.expenses.reduce((sum, e) => sum + e.amount, 0);

  // Group expenses by category
  const expensesByCategory = BUDGET_CATEGORIES.map((cat) => ({
    category: cat,
    amount: production.expenses
      .filter((e) => e.category.toLowerCase() === cat.toLowerCase())
      .reduce((sum, e) => sum + e.amount, 0),
  }));

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/production"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-sm font-semibold text-gray-900">{production.title}</h1>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.bg} ${s.text}`}>
                {s.label}
              </span>
            </div>
            {production.campaign && (
              <p className="truncate text-xs text-gray-400">
                {production.campaign.client.name} — {production.campaign.title}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={production.status}
            onChange={(e) => updateStatus(e.target.value as ProductionStatus)}
            className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-600 focus:border-[#D4A853] focus:outline-none"
          >
            {Object.entries(STATUS_STYLES).map(([key, val]) => (
              <option key={key} value={key}>
                {val.label}
              </option>
            ))}
          </select>
          <Link
            href="/production/call-sheets"
            className="flex items-center gap-1.5 rounded-lg bg-[#D4A853] px-3 py-2 text-xs font-semibold text-white hover:bg-[#C49843]"
          >
            <ClipboardList className="h-3.5 w-3.5" />
            New Call Sheet
          </Link>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-4xl space-y-5">
          {/* Top info row */}
          <div className="grid grid-cols-3 gap-4">
            {production.budgetTotal != null && (
              <div className="card-apple flex items-center gap-3 p-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50">
                  <DollarSign className="h-4.5 w-4.5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-gray-400">Budget</p>
                  <p className="text-base font-bold text-gray-900">
                    £{production.budgetTotal.toLocaleString()}
                  </p>
                </div>
              </div>
            )}
            <div className="card-apple flex items-center gap-3 p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50">
                <ClipboardList className="h-4.5 w-4.5 text-blue-600" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-400">Call Sheets</p>
                <p className="text-base font-bold text-gray-900">{production.callSheets.length}</p>
              </div>
            </div>
            <div className="card-apple flex items-center gap-3 p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50">
                <Users className="h-4.5 w-4.5 text-amber-600" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-400">Crew</p>
                <p className="text-base font-bold text-gray-900">{production.crew.length}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-5">
            {/* Left: Brief + Call Sheets */}
            <div className="col-span-2 space-y-4">
              {/* Brief */}
              <div className="card-apple p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Brief
                  </h2>
                  {!editingBrief && (
                    <button
                      onClick={() => setEditingBrief(true)}
                      className="flex items-center gap-1 rounded px-2 py-1 text-[10px] text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                    >
                      <Edit2 className="h-3 w-3" />
                      Edit
                    </button>
                  )}
                </div>
                {editingBrief ? (
                  <div className="space-y-3">
                    <textarea
                      rows={5}
                      value={briefDraft}
                      onChange={(e) => setBriefDraft(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#D4A853] focus:outline-none"
                      placeholder="Creative brief, deliverables, requirements…"
                    />
                    <div className="flex items-center gap-2">
                      {savedBrief && (
                        <span className="flex items-center gap-1 text-xs text-emerald-600">
                          <Check className="h-3.5 w-3.5" /> Saved
                        </span>
                      )}
                      <div className="ml-auto flex gap-2">
                        <button
                          onClick={() => { setEditingBrief(false); setBriefDraft(production.brief || ""); }}
                          className="rounded-lg px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={saveBrief}
                          disabled={savingBrief}
                          className="flex items-center gap-1.5 rounded-lg bg-[#D4A853] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#C49843] disabled:opacity-50"
                        >
                          {savingBrief && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                          Save
                        </button>
                      </div>
                    </div>
                  </div>
                ) : production.brief ? (
                  <p className="whitespace-pre-wrap text-sm text-gray-700">{production.brief}</p>
                ) : (
                  <button
                    onClick={() => setEditingBrief(true)}
                    className="text-xs text-gray-400 hover:text-[#D4A853]"
                  >
                    + Add brief…
                  </button>
                )}
              </div>

              {/* Call Sheets */}
              <div className="card-apple p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Call Sheets
                  </h2>
                  <Link
                    href="/production/call-sheets"
                    className="text-[10px] text-[#D4A853] hover:underline"
                  >
                    + New call sheet
                  </Link>
                </div>
                {production.callSheets.length === 0 ? (
                  <p className="py-4 text-center text-xs text-gray-400">
                    No call sheets yet for this production.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {production.callSheets
                      .sort(
                        (a, b) =>
                          new Date(a.shootDate).getTime() - new Date(b.shootDate).getTime()
                      )
                      .map((sheet) => {
                        const status = sheetStatus(sheet);
                        return (
                          <Link
                            key={sheet.id}
                            href={`/production/call-sheets/${sheet.id}`}
                            className="group flex items-center gap-3 rounded-xl p-3 hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg bg-amber-50 text-center">
                              <span className="text-[8px] font-bold uppercase tracking-wider text-amber-600">
                                {format(new Date(sheet.shootDate), "MMM")}
                              </span>
                              <span className="text-sm font-bold leading-none text-amber-700">
                                {format(new Date(sheet.shootDate), "d")}
                              </span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-sm font-medium text-gray-800">
                                  {shootTitle(sheet)}
                                </p>
                                <span
                                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${SHEET_STATUS_BADGE[status]}`}
                                >
                                  {status}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-gray-400">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {sheet.callTime}
                                </span>
                                {sheet.location?.address && (
                                  <span className="flex items-center gap-1 truncate">
                                    <MapPin className="h-3 w-3 shrink-0" />
                                    <span className="truncate">{sheet.location.address}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                            <ChevronRight className="h-4 w-4 shrink-0 text-gray-300 group-hover:text-gray-500 transition-colors" />
                          </Link>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Figma deck */}
              <div className="card-apple p-5">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Figma Deck
                </h2>
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={figmaUrl}
                    onChange={(e) => setFigmaUrl(e.target.value)}
                    className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#D4A853] focus:outline-none"
                    placeholder="Paste Figma or deck URL…"
                  />
                  {figmaUrl && (
                    <a
                      href={figmaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-200"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Right column */}
            <div className="space-y-4">
              {/* Team */}
              <div className="card-apple p-5">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Team
                </h2>
                {production.crew.length === 0 ? (
                  <p className="text-xs text-gray-400">No crew assigned</p>
                ) : (
                  <div className="space-y-2">
                    {production.crew.map((member) => (
                      <div key={member.id} className="flex items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-500">
                          {member.contact.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-gray-700">
                            {member.contact.name}
                          </p>
                          <p className="text-[10px] text-gray-400">{member.role}</p>
                        </div>
                        {member.confirmed && (
                          <span className="ml-auto shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">
                            ✓
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Budget breakdown */}
              {production.expenses.length > 0 && (
                <div className="card-apple p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Budget Breakdown
                    </h2>
                    {production.budgetTotal != null && (
                      <span className="text-[10px] text-gray-400">
                        of £{production.budgetTotal.toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {expensesByCategory
                      .filter((e) => e.amount > 0)
                      .map(({ category, amount }) => (
                        <div key={category} className="flex items-center justify-between">
                          <span className="text-xs text-gray-600">{category}</span>
                          <span className="text-xs font-medium text-gray-800">
                            £{amount.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    <div className="border-t border-gray-100 pt-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-700">Total Spent</span>
                      <span className="text-xs font-bold text-gray-900">
                        £{totalExpenses.toLocaleString()}
                      </span>
                    </div>
                    {production.budgetTotal != null && totalExpenses > 0 && (
                      <div className="mt-2">
                        <div className="h-1.5 w-full rounded-full bg-gray-100">
                          <div
                            className="h-1.5 rounded-full bg-[#D4A853]"
                            style={{
                              width: `${Math.min((totalExpenses / production.budgetTotal) * 100, 100)}%`,
                            }}
                          />
                        </div>
                        <p className="mt-1 text-right text-[10px] text-gray-400">
                          {Math.round((totalExpenses / production.budgetTotal) * 100)}% used
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Timeline */}
              {production.shootDates.length > 0 && (
                <div className="card-apple p-5">
                  <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Shoot Dates
                  </h2>
                  <div className="space-y-1.5">
                    {production.shootDates
                      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
                      .map((date) => {
                        const d = new Date(date);
                        const isPast = !isAfter(d, new Date());
                        return (
                          <div key={date} className="flex items-center gap-2">
                            <div
                              className={`flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold ${
                                isPast ? "bg-gray-100 text-gray-400" : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {format(d, "d")}
                            </div>
                            <span
                              className={`text-xs ${isPast ? "text-gray-400" : "text-gray-700"}`}
                            >
                              {format(d, "EEE d MMM yyyy")}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
