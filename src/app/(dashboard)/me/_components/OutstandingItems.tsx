"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ReceiptText } from "lucide-react";
import { formatGBP } from "./types";
import { ErrorState } from "@/components/ui/error-state";

interface OverviewSlice {
  xeroConnected: boolean;
  overdueReceivables: number;
  overdueReceivableCount: number;
  pendingApprovals: number;
}

// Outstanding finance items — overdue invoices + approvals waiting, from
// /api/finance/overview. Links through to the Finance portal for detail.
export function OutstandingItems() {
  const [data, setData] = useState<OverviewSlice | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    setData(null);
    try {
      const r = await fetch("/api/finance/overview");
      if (!r.ok) throw new Error(String(r.status));
      setData((await r.json()) as OverviewSlice);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
          Outstanding Items
        </h2>
        <ReceiptText className="h-4 w-4 text-[#2F4B8F] dark:text-[#5B7BC4] opacity-70" />
      </div>

      {failed ? (
        <div className="mt-2">
          <ErrorState compact title="Couldn't load finance items" onRetry={load} />
        </div>
      ) : !data ? (
        <div className="mt-3 space-y-2">
          <div className="h-4 w-3/4 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
        </div>
      ) : (
        <>
          <ul className="mt-2 space-y-2">
            <li className="flex items-baseline justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Overdue invoices</span>
              <span
                className={`font-semibold ${
                  data.overdueReceivableCount > 0 ? "text-red-500 dark:text-red-400" : "text-gray-900 dark:text-gray-100"
                }`}
              >
                {data.xeroConnected ? data.overdueReceivableCount : "—"}
                {data.xeroConnected && data.overdueReceivableCount > 0 && (
                  <span className="ml-1.5 text-xs font-medium text-gray-400 dark:text-gray-500">
                    {formatGBP(data.overdueReceivables)}
                  </span>
                )}
              </span>
            </li>
            <li className="flex items-baseline justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Pending approval</span>
              <span
                className={`font-semibold ${
                  data.pendingApprovals > 0 ? "text-amber-600 dark:text-amber-400" : "text-gray-900 dark:text-gray-100"
                }`}
              >
                {data.pendingApprovals}
              </span>
            </li>
          </ul>
          {!data.xeroConnected && (
            <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
              Connect Xero in Finance to track overdue invoices.
            </p>
          )}
          <Link
            href="/finance"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#2F4B8F] dark:text-[#5B7BC4] hover:underline"
          >
            View in Finance <ArrowUpRight className="h-3 w-3" />
          </Link>
        </>
      )}
    </section>
  );
}
