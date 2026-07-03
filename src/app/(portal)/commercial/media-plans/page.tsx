"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, FileText, ChevronRight, Trash2 } from "lucide-react";
import { useConfirm } from "@/components/ui/confirm-provider";

interface MediaPlan {
  id: string;
  clientName: string;
  campaignName: string;
  flightStart: string | null;
  flightEnd: string | null;
  currency: string;
  status: string;
  createdAt: string;
  lineItems: { netCost: number }[];
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  sent: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function fmtMoney(n: number, currency: string) {
  const symbol = currency === "USD" ? "$" : currency === "EUR" ? "€" : "£";
  return symbol + n.toLocaleString("en-GB", { maximumFractionDigits: 0 });
}

export default function MediaPlansListPage() {
  const [plans, setPlans] = useState<MediaPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const confirm = useConfirm();

  async function load() {
    try {
      const res = await fetch("/api/media-plans");
      if (res.ok) setPlans(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function deletePlan(id: string) {
    const ok = await confirm({
      title: "Delete media plan?",
      message: "This permanently deletes the media plan. This cannot be undone.",
      confirmLabel: "Delete",
      confirmVariant: "danger",
    });
    if (!ok) return;
    await fetch(`/api/media-plans/${id}`, { method: "DELETE" });
    setPlans((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-6 py-3">
        <div>
          <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100">Media Plans</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">{plans.length} plans</p>
        </div>
        <Link
          href="/commercial/media-plans/new"
          className="flex items-center gap-2 rounded-lg bg-[#ffd700] px-4 py-2 text-sm font-medium text-black hover:bg-[#e6c200] transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Media Plan
        </Link>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
            ))}
          </div>
        ) : plans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <FileText className="mb-4 h-12 w-12 text-gray-300" />
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">No media plans yet</p>
            <p className="mt-1 text-xs text-gray-400">
              Create your first media plan to get started
            </p>
            <Link
              href="/commercial/media-plans/new"
              className="mt-4 rounded-lg bg-[#ffd700] px-4 py-2 text-sm font-medium text-black hover:bg-[#e6c200] transition-colors"
            >
              New Media Plan
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Client / Campaign
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Flight Dates
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Lines
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Total Net
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {plans.map((plan) => {
                  const totalNet = plan.lineItems.reduce((s, li) => s + li.netCost, 0);
                  return (
                    <tr
                      key={plan.id}
                      className="group border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <td className="px-4 py-3">
                        <Link href={`/commercial/media-plans/${plan.id}`} className="block">
                          <p className="font-medium text-gray-900 dark:text-gray-100">{plan.clientName}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{plan.campaignName}</p>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">
                        {fmtDate(plan.flightStart)}
                        {plan.flightEnd ? ` → ${fmtDate(plan.flightEnd)}` : ""}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">
                        {plan.lineItems.length}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono font-semibold text-gray-900 dark:text-gray-100">
                        {fmtMoney(totalNet, plan.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${
                            STATUS_COLORS[plan.status] ?? "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {plan.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link
                            href={`/commercial/media-plans/${plan.id}`}
                            className="rounded p-1 text-gray-400 hover:text-gray-700 transition-colors"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                          <button
                            onClick={() => deletePlan(plan.id)}
                            className="rounded p-1 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
