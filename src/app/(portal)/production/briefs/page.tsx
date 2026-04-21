"use client";

import { useState, useEffect } from "react";
import { FileText, Plus, ChevronDown, ChevronUp, X } from "lucide-react";
import Link from "next/link";

type ProductionStatus =
  | "DRAFT"
  | "BRIEFED"
  | "PRE_PRODUCTION"
  | "SHOOTING"
  | "POST_PRODUCTION"
  | "DELIVERED"
  | "ARCHIVED";

const PIPELINE: { status: ProductionStatus; label: string }[] = [
  { status: "DRAFT", label: "Draft" },
  { status: "BRIEFED", label: "Approved" },
  { status: "PRE_PRODUCTION", label: "Pre-Prod" },
  { status: "SHOOTING", label: "Shooting" },
  { status: "POST_PRODUCTION", label: "Post" },
  { status: "DELIVERED", label: "Delivered" },
];

const STATUS_STYLES: Record<ProductionStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  BRIEFED: "bg-blue-100 text-blue-700",
  PRE_PRODUCTION: "bg-purple-100 text-purple-700",
  SHOOTING: "bg-amber-100 text-amber-700",
  POST_PRODUCTION: "bg-orange-100 text-orange-700",
  DELIVERED: "bg-emerald-100 text-emerald-700",
  ARCHIVED: "bg-gray-100 text-gray-400",
};

interface Production {
  id: string;
  title: string;
  brief: string | null;
  status: ProductionStatus;
  budgetTotal: number | null;
  budgetActual: number | null;
  marginTarget: number | null;
  shootDates: string[];
  campaign: { id: string; title: string; client: { id: string; name: string } } | null;
  crew: { id: string; role: string; contact: { name: string } }[];
  callSheets: { id: string; shootDate: string }[];
}

export default function BriefsPage() {
  const [productions, setProductions] = useState<Production[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", brief: "", budgetTotal: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/productions")
      .then((r) => r.json())
      .then((d) => setProductions(d.productions ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/productions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          brief: form.brief,
          budgetTotal: form.budgetTotal ? parseFloat(form.budgetTotal) : null,
        }),
      });
      const data = await res.json();
      if (data.production) {
        setProductions((prev) => [data.production, ...prev]);
        setShowCreate(false);
        setForm({ title: "", brief: "", budgetTotal: "" });
      }
    } finally {
      setSaving(false);
    }
  }

  const pipelineStatuses = PIPELINE.map((p) => p.status);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Production Briefs</h1>
          <p className="text-xs text-gray-500">All productions and approval status</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-lg bg-[#D4A853] px-3 py-2 text-xs font-semibold text-white hover:bg-[#C49843]"
        >
          <Plus className="h-3.5 w-3.5" />
          Create Brief
        </button>
      </div>

      {/* Pipeline indicator */}
      <div className="border-b border-gray-100 bg-gray-50 px-6 py-2">
        <div className="flex items-center">
          {PIPELINE.map((step, i) => {
            const count = productions.filter((p) => p.status === step.status).length;
            return (
              <div key={step.status} className="flex items-center">
                <div className="flex items-center gap-1.5 px-3 py-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    {step.label}
                  </span>
                  {count > 0 && (
                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
                      {count}
                    </span>
                  )}
                </div>
                {i < PIPELINE.length - 1 && (
                  <span className="text-gray-300">›</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card-apple h-20 animate-pulse bg-gray-100" />
            ))}
          </div>
        ) : productions.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
              <FileText className="h-8 w-8 text-gray-400" />
            </div>
            <h2 className="text-sm font-semibold text-gray-700">No briefs yet</h2>
            <p className="mt-1 max-w-xs text-xs text-gray-400">
              Create your first production brief to kick off a shoot.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-4 flex items-center gap-1.5 rounded-lg bg-[#D4A853] px-4 py-2 text-xs font-semibold text-white hover:bg-[#C49843]"
            >
              <Plus className="h-3.5 w-3.5" />
              Create Brief
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {productions.map((prod) => {
              const stepIndex = pipelineStatuses.indexOf(prod.status);
              const isExpanded = expanded === prod.id;
              const pipelineLabel = PIPELINE.find((p) => p.status === prod.status)?.label ?? prod.status;

              return (
                <div key={prod.id} className="card-apple overflow-hidden">
                  <button
                    className="flex w-full items-center justify-between p-4 text-left"
                    onClick={() => setExpanded(isExpanded ? null : prod.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
                        <FileText className="h-4 w-4 text-gray-500" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{prod.title}</p>
                        <p className="text-xs text-gray-500">
                          {prod.campaign
                            ? `${prod.campaign.client.name} — ${prod.campaign.title}`
                            : "No campaign linked"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${STATUS_STYLES[prod.status]}`}
                      >
                        {pipelineLabel}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-gray-100 px-4 pb-4 pt-3">
                      {/* Pipeline progress bar */}
                      <div className="mb-4">
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                          Pipeline
                        </p>
                        <div className="flex items-center gap-1">
                          {PIPELINE.map((step, i) => {
                            const done = i <= stepIndex;
                            const active = i === stepIndex;
                            return (
                              <div key={step.status} className="flex flex-1 flex-col items-center gap-1">
                                <div
                                  className={`h-1.5 w-full rounded-full ${done ? "bg-[#D4A853]" : "bg-gray-200"}`}
                                />
                                <span
                                  className={`text-[9px] font-medium ${
                                    active
                                      ? "text-[#D4A853]"
                                      : done
                                      ? "text-gray-500"
                                      : "text-gray-300"
                                  }`}
                                >
                                  {step.label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                            Brief
                          </p>
                          <p className="text-xs text-gray-600">{prod.brief || "No brief added yet."}</p>
                        </div>
                        <div>
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                            Budget
                          </p>
                          <p className="text-xs text-gray-600">
                            {prod.budgetTotal != null
                              ? `£${prod.budgetTotal.toLocaleString()} total`
                              : "No budget set"}
                          </p>
                          {prod.budgetActual != null && (
                            <p className="text-xs text-gray-400">
                              £{prod.budgetActual.toLocaleString()} actual
                            </p>
                          )}
                        </div>
                        <div>
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                            Crew ({prod.crew.length})
                          </p>
                          {prod.crew.length === 0 ? (
                            <p className="text-xs text-gray-400">No crew assigned</p>
                          ) : (
                            <div className="space-y-0.5">
                              {prod.crew.map((m) => (
                                <p key={m.id} className="text-xs text-gray-600">
                                  {m.contact.name}{" "}
                                  <span className="text-gray-400">· {m.role}</span>
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                            Shoot Dates
                          </p>
                          {prod.shootDates.length === 0 ? (
                            <p className="text-xs text-gray-400">No shoot dates set</p>
                          ) : (
                            <div className="space-y-0.5">
                              {prod.shootDates.map((d, i) => (
                                <p key={i} className="text-xs text-gray-600">
                                  {new Date(d).toLocaleDateString("en-GB", {
                                    weekday: "short",
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  })}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {prod.callSheets.length > 0 && (
                        <div className="mt-3">
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                            Call Sheets
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {prod.callSheets.map((cs) => (
                              <Link
                                key={cs.id}
                                href="/production/call-sheets"
                                className="rounded-lg bg-gray-100 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-200"
                              >
                                {new Date(cs.shootDate).toLocaleDateString("en-GB", {
                                  day: "numeric",
                                  month: "short",
                                })}
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">New Production Brief</h2>
              <button
                onClick={() => setShowCreate(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Title *</label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#D4A853] focus:outline-none"
                  placeholder="e.g. Summer Shoot"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Brief</label>
                <textarea
                  rows={3}
                  value={form.brief}
                  onChange={(e) => setForm((f) => ({ ...f, brief: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#D4A853] focus:outline-none"
                  placeholder="Concept, deliverables, requirements…"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Budget (£)</label>
                <input
                  type="number"
                  min="0"
                  value={form.budgetTotal}
                  onChange={(e) => setForm((f) => ({ ...f, budgetTotal: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#D4A853] focus:outline-none"
                  placeholder="0"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-lg px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-[#D4A853] px-4 py-2 text-xs font-semibold text-white hover:bg-[#C49843] disabled:opacity-50"
                >
                  {saving ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
