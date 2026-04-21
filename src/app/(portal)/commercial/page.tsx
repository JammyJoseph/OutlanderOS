"use client";

import { useState, useEffect } from "react";
import { Plus, X, DollarSign } from "lucide-react";

type CampaignStatus =
  | "BRIEF_RECEIVED"
  | "BRIEF_RESPONDED"
  | "BOOKED"
  | "LIVE"
  | "DELIVERED"
  | "PAID";

type CampaignType =
  | "SUPPLIED_ASSET"
  | "BESPOKE_PRODUCTION"
  | "WHITE_LABEL"
  | "EDITORIAL_FEATURE"
  | "PRINT_AD";

interface Campaign {
  id: string;
  title: string;
  status: CampaignStatus;
  type: CampaignType;
  value?: number;
  currency: string;
  timelineEnd?: string;
  client: { id: string; name: string };
}

const COLUMNS: { key: CampaignStatus; label: string; color: string }[] = [
  { key: "BRIEF_RECEIVED", label: "Brief Received", color: "bg-gray-100" },
  { key: "BRIEF_RESPONDED", label: "Brief Responded", color: "bg-blue-50" },
  { key: "BOOKED", label: "Booked", color: "bg-amber-50" },
  { key: "LIVE", label: "Live", color: "bg-green-50" },
  { key: "DELIVERED", label: "Delivered", color: "bg-purple-50" },
  { key: "PAID", label: "Paid", color: "bg-emerald-50" },
];

const TYPE_LABELS: Record<CampaignType, string> = {
  SUPPLIED_ASSET: "Supplied",
  BESPOKE_PRODUCTION: "Bespoke",
  WHITE_LABEL: "White Label",
  EDITORIAL_FEATURE: "Editorial",
  PRINT_AD: "Print Ad",
};

const TYPE_COLORS: Record<CampaignType, string> = {
  SUPPLIED_ASSET: "bg-gray-100 text-gray-600",
  BESPOKE_PRODUCTION: "bg-blue-100 text-blue-700",
  WHITE_LABEL: "bg-purple-100 text-purple-700",
  EDITORIAL_FEATURE: "bg-amber-100 text-amber-700",
  PRINT_AD: "bg-pink-100 text-pink-700",
};

function fmt(n: number, currency: string): string {
  const symbol = currency === "USD" ? "$" : currency === "EUR" ? "€" : "£";
  return symbol + n.toLocaleString("en-GB", { maximumFractionDigits: 0 });
}

function KanbanCard({
  campaign,
  onMove,
}: {
  campaign: Campaign;
  onMove: (id: string, newStatus: CampaignStatus) => void;
}) {
  const currentIdx = COLUMNS.findIndex((c) => c.key === campaign.status);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      <div className="mb-1 flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-gray-900 leading-snug">
          {campaign.client.name}
        </p>
        {campaign.value && (
          <span className="shrink-0 text-xs font-mono font-semibold text-gray-700">
            {fmt(campaign.value, campaign.currency)}
          </span>
        )}
      </div>
      <p className="mb-2 text-xs text-gray-500 truncate">{campaign.title}</p>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${TYPE_COLORS[campaign.type]}`}>
          {TYPE_LABELS[campaign.type]}
        </span>
        {campaign.timelineEnd && (
          <span className="text-[10px] text-gray-400">
            {new Date(campaign.timelineEnd).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
            })}
          </span>
        )}
      </div>
      {/* Move buttons */}
      <div className="mt-2 flex gap-1">
        {currentIdx > 0 && (
          <button
            onClick={() => onMove(campaign.id, COLUMNS[currentIdx - 1].key)}
            className="flex-1 rounded text-[10px] border border-gray-200 py-0.5 text-gray-400 hover:bg-gray-50 transition-colors"
          >
            ← Back
          </button>
        )}
        {currentIdx < COLUMNS.length - 1 && (
          <button
            onClick={() => onMove(campaign.id, COLUMNS[currentIdx + 1].key)}
            className="flex-1 rounded text-[10px] border border-amber-200 py-0.5 text-amber-600 hover:bg-amber-50 transition-colors"
          >
            Advance →
          </button>
        )}
      </div>
    </div>
  );
}

interface NewCampaignForm {
  clientName: string;
  title: string;
  type: CampaignType;
  value: string;
  currency: string;
}

export default function CommercialPipelinePage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<NewCampaignForm>({
    clientName: "",
    title: "",
    type: "SUPPLIED_ASSET",
    value: "",
    currency: "GBP",
  });

  async function loadCampaigns() {
    try {
      const res = await fetch("/api/campaigns");
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data);
      }
    } catch {
      // silently fail — show empty state
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCampaigns();
  }, []);

  async function handleMove(id: string, newStatus: CampaignStatus) {
    setCampaigns((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: newStatus } : c))
    );
    await fetch(`/api/campaigns/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.clientName.trim() || !form.title.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: form.clientName,
          title: form.title,
          type: form.type,
          value: form.value ? parseFloat(form.value) : undefined,
          currency: form.currency,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setCampaigns((prev) => [...prev, created]);
        setForm({ clientName: "", title: "", type: "SUPPLIED_ASSET", value: "", currency: "GBP" });
        setShowForm(false);
      }
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  }

  const grouped = COLUMNS.reduce<Record<CampaignStatus, Campaign[]>>(
    (acc, col) => {
      acc[col.key] = campaigns.filter((c) => c.status === col.key);
      return acc;
    },
    {} as Record<CampaignStatus, Campaign[]>
  );

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Campaign Pipeline</h1>
          <p className="text-xs text-gray-500">{campaigns.length} campaigns</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-lg bg-[#D4A853] px-4 py-2 text-sm font-medium text-white hover:bg-[#C49843] transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Campaign
        </button>
      </div>

      {/* Kanban board */}
      <div className="flex flex-1 overflow-x-auto gap-4 p-4">
        {COLUMNS.map((col) => {
          const cards = grouped[col.key] ?? [];
          return (
            <div key={col.key} className="flex w-[220px] shrink-0 flex-col">
              <div className={`mb-3 flex items-center justify-between rounded-lg px-3 py-2 ${col.color}`}>
                <span className="text-xs font-semibold text-gray-700">
                  {col.label}
                </span>
                <span className="rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] font-bold text-gray-600">
                  {cards.length}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-2">
                {loading ? (
                  <div className="h-20 animate-pulse rounded-lg bg-gray-100" />
                ) : cards.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-200 px-3 py-4 text-center text-xs text-gray-300">
                    Empty
                  </div>
                ) : (
                  cards.map((c) => (
                    <KanbanCard key={c.id} campaign={c} onMove={handleMove} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Campaign modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">New Campaign</h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Client Name *
                </label>
                <input
                  type="text"
                  value={form.clientName}
                  onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#D4A853] focus:outline-none"
                  placeholder="e.g. Nike"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Campaign Title *
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#D4A853] focus:outline-none"
                  placeholder="e.g. Spring/Summer Campaign"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Type
                </label>
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as CampaignType }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#D4A853] focus:outline-none"
                >
                  {Object.entries(TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    Value
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                    <input
                      type="number"
                      value={form.value}
                      onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 py-2 pl-8 pr-3 text-sm focus:border-[#D4A853] focus:outline-none"
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="w-24">
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    Currency
                  </label>
                  <select
                    value={form.currency}
                    onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#D4A853] focus:outline-none"
                  >
                    <option value="GBP">GBP</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 rounded-lg border border-gray-200 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-lg bg-[#D4A853] py-2 text-sm font-medium text-white hover:bg-[#C49843] disabled:opacity-50 transition-colors"
                >
                  {submitting ? "Creating…" : "Create Campaign"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
