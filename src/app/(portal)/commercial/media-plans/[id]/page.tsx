"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Plus, Trash2, ChevronLeft, Download, Share2 } from "lucide-react";
import Link from "next/link";

interface LineItem {
  _key: string;
  id?: string;
  site: string;
  startDate: string;
  endDate: string;
  placement: string;
  rate: number;
  rateType: "Flat Fee" | "CPM" | "CPC";
  discount: number;
  units: number;
  grossCost: number;
  netCost: number;
  projectedCreative: string;
  deliveryStatus: "planned" | "delivered" | "cancelled";
  sortOrder: number;
}

interface MediaPlan {
  id: string;
  clientName: string;
  campaignName: string;
  flightStart: string | null;
  flightEnd: string | null;
  currency: string;
  contactName: string | null;
  contactEmail: string | null;
  status: string;
  lineItems: Array<Omit<LineItem, "_key">>;
}

function calcCosts(rate: number, units: number, discount: number) {
  const gross = rate * units;
  const net = gross * (1 - discount / 100);
  return { grossCost: gross, netCost: net };
}

function newLine(sortOrder: number): LineItem {
  return {
    _key: Math.random().toString(36).slice(2),
    site: "",
    startDate: "",
    endDate: "",
    placement: "",
    rate: 0,
    rateType: "Flat Fee",
    discount: 0,
    units: 1,
    grossCost: 0,
    netCost: 0,
    projectedCreative: "",
    deliveryStatus: "planned",
    sortOrder,
  };
}

function monthLabel(dateStr: string) {
  if (!dateStr) return "No date";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
}

function groupByMonth(items: LineItem[]) {
  const groups: Record<string, LineItem[]> = {};
  for (const item of items) {
    const key = item.startDate
      ? new Date(item.startDate).toISOString().slice(0, 7)
      : "nodatea";
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }
  const sorted = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  return sorted.map(([key, items]) => ({
    key,
    label: key === "nodatea" ? "No date" : monthLabel(items[0].startDate),
    items,
  }));
}

const DELIVERY_COLORS = {
  planned: "bg-gray-100 text-gray-600",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-600",
};

const STATUS_OPTIONS = ["draft", "sent", "approved"];

export default function MediaPlanEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const [header, setHeader] = useState({
    clientName: "",
    campaignName: "",
    flightStart: "",
    flightEnd: "",
    currency: "GBP",
    contactName: "",
    contactEmail: "",
    status: "draft",
  });

  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/media-plans/${id}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (res.ok) {
        const plan: MediaPlan = await res.json();
        setHeader({
          clientName: plan.clientName,
          campaignName: plan.campaignName,
          flightStart: plan.flightStart
            ? new Date(plan.flightStart).toISOString().slice(0, 10)
            : "",
          flightEnd: plan.flightEnd
            ? new Date(plan.flightEnd).toISOString().slice(0, 10)
            : "",
          currency: plan.currency,
          contactName: plan.contactName ?? "",
          contactEmail: plan.contactEmail ?? "",
          status: plan.status,
        });
        setLineItems(
          plan.lineItems.map((li) => ({
            ...li,
            _key: li.id ?? Math.random().toString(36).slice(2),
            startDate: li.startDate
              ? new Date(li.startDate as unknown as string).toISOString().slice(0, 10)
              : "",
            endDate: li.endDate
              ? new Date(li.endDate as unknown as string).toISOString().slice(0, 10)
              : "",
            projectedCreative: li.projectedCreative ?? "",
          }))
        );
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  function updateHeader(key: keyof typeof header, value: string) {
    setHeader((h) => ({ ...h, [key]: value }));
  }

  function updateLine(key: string, field: keyof LineItem, raw: string | number) {
    setLineItems((prev) =>
      prev.map((li) => {
        if (li._key !== key) return li;
        const updated = { ...li, [field]: raw };
        if (["rate", "units", "discount"].includes(field as string)) {
          const costs = calcCosts(
            field === "rate" ? Number(raw) : li.rate,
            field === "units" ? Number(raw) : li.units,
            field === "discount" ? Number(raw) : li.discount
          );
          return { ...updated, ...costs };
        }
        return updated;
      })
    );
  }

  function removeLine(key: string) {
    setLineItems((prev) => prev.filter((li) => li._key !== key));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/media-plans/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...header,
          lineItems: lineItems.map(({ _key, id: _id, ...rest }, idx) => ({
            ...rest,
            sortOrder: idx,
          })),
        }),
      });
      if (!res.ok) throw new Error("Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#ffd700] border-t-transparent" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-sm text-gray-500">Media plan not found.</p>
        <Link
          href="/commercial/media-plans"
          className="text-sm text-[#ffd700] hover:underline"
        >
          Back to Media Plans
        </Link>
      </div>
    );
  }

  const currencySymbol =
    header.currency === "USD" ? "$" : header.currency === "EUR" ? "€" : "£";
  const fmt = (n: number) =>
    currencySymbol +
    n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const grandTotalGross = lineItems.reduce((s, li) => s + li.grossCost, 0);
  const grandTotalNet = lineItems.reduce((s, li) => s + li.netCost, 0);
  const monthGroups = groupByMonth(lineItems);

  const inputCls =
    "w-full rounded border border-gray-200 px-2 py-1.5 text-sm focus:border-[#ffd700] focus:outline-none";

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div className="flex items-center gap-3">
          <Link
            href="/commercial/media-plans"
            className="text-gray-400 hover:text-gray-700 transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-base font-semibold text-gray-900">
              {header.clientName || "Media Plan"}
            </h1>
            <p className="text-xs text-gray-500">{header.campaignName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            disabled
            title="Export PDF — coming soon"
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-400 cursor-not-allowed"
          >
            <Download className="h-3.5 w-3.5" />
            Export PDF
          </button>
          <button
            disabled
            title="Share with Client — coming soon"
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-400 cursor-not-allowed"
          >
            <Share2 className="h-3.5 w-3.5" />
            Share
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-[#ffd700] px-4 py-2 text-sm font-medium text-black hover:bg-[#e6c200] disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {/* Header form */}
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">Plan Details</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Client *</label>
              <input
                type="text"
                value={header.clientName}
                onChange={(e) => updateHeader("clientName", e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Campaign Name *
              </label>
              <input
                type="text"
                value={header.campaignName}
                onChange={(e) => updateHeader("campaignName", e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Status</label>
              <select
                value={header.status}
                onChange={(e) => updateHeader("status", e.target.value)}
                className={inputCls}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s} className="capitalize">
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Flight Start
              </label>
              <input
                type="date"
                value={header.flightStart}
                onChange={(e) => updateHeader("flightStart", e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Flight End
              </label>
              <input
                type="date"
                value={header.flightEnd}
                onChange={(e) => updateHeader("flightEnd", e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Currency</label>
              <select
                value={header.currency}
                onChange={(e) => updateHeader("currency", e.target.value)}
                className={inputCls}
              >
                <option value="GBP">GBP £</option>
                <option value="USD">USD $</option>
                <option value="EUR">EUR €</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Contact Name
              </label>
              <input
                type="text"
                value={header.contactName}
                onChange={(e) => updateHeader("contactName", e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Contact Email
              </label>
              <input
                type="email"
                value={header.contactEmail}
                onChange={(e) => updateHeader("contactEmail", e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
        </div>

        {/* Line items grouped by month */}
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-gray-700">Line Items</h2>
            <button
              onClick={() =>
                setLineItems((prev) => [...prev, newLine(prev.length)])
              }
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Line Item
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {[
                    "Site / Platform",
                    "Start",
                    "End",
                    "Placement",
                    "Rate",
                    "Type",
                    "Disc %",
                    "Units",
                    "Gross",
                    "Net",
                    "Creative",
                    "Status",
                    "",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthGroups.map((group) => (
                  <>
                    <tr key={`month-${group.key}`} className="bg-amber-50/50">
                      <td
                        colSpan={13}
                        className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-700"
                      >
                        {group.label}
                        <span className="ml-3 font-normal text-amber-600">
                          {fmt(
                            group.items.reduce((s, li) => s + li.netCost, 0)
                          )}{" "}
                          net
                        </span>
                      </td>
                    </tr>
                    {group.items.map((li) => (
                      <tr
                        key={li._key}
                        className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                      >
                        <td className="px-3 py-2 min-w-[160px]">
                          <input
                            value={li.site}
                            onChange={(e) =>
                              updateLine(li._key, "site", e.target.value)
                            }
                            className="w-full rounded border-0 bg-transparent px-1 py-0.5 text-xs focus:bg-white focus:border focus:border-[#ffd700] focus:outline-none"
                            placeholder="e.g. Outlander IG"
                          />
                        </td>
                        <td className="px-3 py-2 min-w-[110px]">
                          <input
                            type="date"
                            value={li.startDate}
                            onChange={(e) =>
                              updateLine(li._key, "startDate", e.target.value)
                            }
                            className="w-full rounded border-0 bg-transparent px-1 py-0.5 text-xs focus:bg-white focus:border focus:border-[#ffd700] focus:outline-none"
                          />
                        </td>
                        <td className="px-3 py-2 min-w-[110px]">
                          <input
                            type="date"
                            value={li.endDate}
                            onChange={(e) =>
                              updateLine(li._key, "endDate", e.target.value)
                            }
                            className="w-full rounded border-0 bg-transparent px-1 py-0.5 text-xs focus:bg-white focus:border focus:border-[#ffd700] focus:outline-none"
                          />
                        </td>
                        <td className="px-3 py-2 min-w-[140px]">
                          <input
                            value={li.placement}
                            onChange={(e) =>
                              updateLine(li._key, "placement", e.target.value)
                            }
                            className="w-full rounded border-0 bg-transparent px-1 py-0.5 text-xs focus:bg-white focus:border focus:border-[#ffd700] focus:outline-none"
                            placeholder="Post type"
                          />
                        </td>
                        <td className="px-3 py-2 min-w-[80px]">
                          <input
                            type="number"
                            value={li.rate || ""}
                            onChange={(e) =>
                              updateLine(
                                li._key,
                                "rate",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-full rounded border-0 bg-transparent px-1 py-0.5 text-xs text-right focus:bg-white focus:border focus:border-[#ffd700] focus:outline-none"
                            placeholder="0"
                            min={0}
                          />
                        </td>
                        <td className="px-3 py-2 min-w-[90px]">
                          <select
                            value={li.rateType}
                            onChange={(e) =>
                              updateLine(
                                li._key,
                                "rateType",
                                e.target.value as LineItem["rateType"]
                              )
                            }
                            className="w-full rounded border-0 bg-transparent px-1 py-0.5 text-xs focus:bg-white focus:border focus:border-[#ffd700] focus:outline-none"
                          >
                            <option>Flat Fee</option>
                            <option>CPM</option>
                            <option>CPC</option>
                          </select>
                        </td>
                        <td className="px-3 py-2 min-w-[60px]">
                          <input
                            type="number"
                            value={li.discount || ""}
                            onChange={(e) =>
                              updateLine(
                                li._key,
                                "discount",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-full rounded border-0 bg-transparent px-1 py-0.5 text-xs text-right focus:bg-white focus:border focus:border-[#ffd700] focus:outline-none"
                            placeholder="0"
                            min={0}
                            max={100}
                          />
                        </td>
                        <td className="px-3 py-2 min-w-[60px]">
                          <input
                            type="number"
                            value={li.units || ""}
                            onChange={(e) =>
                              updateLine(
                                li._key,
                                "units",
                                parseInt(e.target.value) || 1
                              )
                            }
                            className="w-full rounded border-0 bg-transparent px-1 py-0.5 text-xs text-right focus:bg-white focus:border focus:border-[#ffd700] focus:outline-none"
                            placeholder="1"
                            min={1}
                          />
                        </td>
                        <td className="px-3 py-2 min-w-[80px] text-right font-mono text-gray-600">
                          {fmt(li.grossCost)}
                        </td>
                        <td className="px-3 py-2 min-w-[80px] text-right font-mono font-semibold text-gray-900">
                          {fmt(li.netCost)}
                        </td>
                        <td className="px-3 py-2 min-w-[130px]">
                          <input
                            value={li.projectedCreative}
                            onChange={(e) =>
                              updateLine(
                                li._key,
                                "projectedCreative",
                                e.target.value
                              )
                            }
                            className="w-full rounded border-0 bg-transparent px-1 py-0.5 text-xs focus:bg-white focus:border focus:border-[#ffd700] focus:outline-none"
                            placeholder="Creative brief"
                          />
                        </td>
                        <td className="px-3 py-2 min-w-[90px]">
                          <select
                            value={li.deliveryStatus}
                            onChange={(e) =>
                              updateLine(
                                li._key,
                                "deliveryStatus",
                                e.target.value as LineItem["deliveryStatus"]
                              )
                            }
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold border-0 cursor-pointer ${
                              DELIVERY_COLORS[li.deliveryStatus]
                            }`}
                          >
                            <option value="planned">Planned</option>
                            <option value="delivered">Delivered</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => removeLine(li._key)}
                            className="text-gray-300 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </>
                ))}

                {lineItems.length === 0 && (
                  <tr>
                    <td
                      colSpan={13}
                      className="px-3 py-8 text-center text-xs text-gray-400"
                    >
                      No line items yet. Click &ldquo;Add Line Item&rdquo; to get started.
                    </td>
                  </tr>
                )}

                {/* Grand total */}
                {lineItems.length > 0 && (
                  <tr className="border-t-2 border-gray-200 bg-gray-50">
                    <td
                      colSpan={8}
                      className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide"
                    >
                      Grand Total
                    </td>
                    <td className="px-3 py-2 text-right text-xs font-mono font-semibold text-gray-600">
                      {fmt(grandTotalGross)}
                    </td>
                    <td className="px-3 py-2 text-right text-xs font-mono font-bold text-gray-900">
                      {fmt(grandTotalNet)}
                    </td>
                    <td colSpan={3} />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
