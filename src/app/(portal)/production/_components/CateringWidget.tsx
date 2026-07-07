"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UtensilsCrossed, BellRing, Check, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";

interface CateringShoot {
  callSheetId: string;
  productionId: string;
  productionTitle: string;
  shootTitle: string | null;
  shootDate: string;
  billingType: "EDITORIAL" | "PAID";
  returned: number;
  total: number;
}

// Dietary-form readiness for upcoming shoots. The nudge button spins up an
// ACTION task to chase the outstanding forms (honest + trackable, rather than
// pretending to send emails we can't send).
export default function CateringWidget() {
  const [shoots, setShoots] = useState<CateringShoot[]>([]);
  const [loading, setLoading] = useState(true);
  const [nudged, setNudged] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/production/catering-status")
      .then((r) => r.json())
      .then((d) => setShoots(Array.isArray(d.shoots) ? d.shoots : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function nudge(s: CateringShoot) {
    setBusyId(s.callSheetId);
    try {
      const missing = Math.max(0, s.total - s.returned);
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Chase ${missing || "outstanding"} dietary form${missing === 1 ? "" : "s"} — ${s.productionTitle} (${format(parseISO(s.shootDate), "d MMM")})`,
          taskType: "ACTION",
          productionId: s.productionId,
        }),
      });
      setNudged((prev) => new Set(prev).add(s.callSheetId));
    } finally {
      setBusyId(null);
    }
  }

  // Only surface shoots that still have outstanding forms (or no roster yet).
  const outstanding = shoots.filter((s) => s.total === 0 || s.returned < s.total);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm h-full overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50 dark:border-gray-800">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
          <UtensilsCrossed size={15} className="text-[#9C7C2E]" />
          Catering Readiness
        </h2>
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
          Dietary forms for upcoming shoots
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 size={18} className="animate-spin text-gray-400 dark:text-gray-500" />
        </div>
      ) : shoots.length === 0 ? (
        <div className="px-5 py-10 text-center text-xs text-gray-400 dark:text-gray-500">
          No upcoming shoots.
        </div>
      ) : outstanding.length === 0 ? (
        <div className="px-5 py-10 text-center text-xs text-emerald-600 dark:text-emerald-400 flex flex-col items-center gap-2">
          <Check size={20} />
          All dietary forms returned.
        </div>
      ) : (
        <div className="divide-y divide-gray-50 dark:divide-gray-800">
          {outstanding.map((s) => {
            const pct = s.total > 0 ? Math.round((s.returned / s.total) * 100) : 0;
            const complete = s.total > 0 && s.returned >= s.total;
            const done = nudged.has(s.callSheetId);
            return (
              <div key={s.callSheetId} className="px-5 py-3">
                <div className="flex items-center justify-between gap-2">
                  <Link
                    href={`/production/${s.productionId}/call-sheets/${s.callSheetId}`}
                    className="min-w-0 flex items-center gap-2 group"
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: s.billingType === "PAID" ? "#9C7C2E" : "#2E5E44" }}
                    />
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate group-hover:text-[#9C7C2E] transition-colors">
                      {s.productionTitle}
                    </span>
                    <span className="text-[11px] text-gray-400 dark:text-gray-500 shrink-0">
                      {format(parseISO(s.shootDate), "d MMM")}
                    </span>
                  </Link>
                  <button
                    onClick={() => nudge(s)}
                    disabled={done || busyId === s.callSheetId}
                    title="Create a task to chase the outstanding dietary forms"
                    className={`shrink-0 inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg transition-colors ${
                      done
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-gray-500 dark:text-gray-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 hover:text-[#9C7C2E]"
                    } disabled:opacity-60`}
                  >
                    {busyId === s.callSheetId ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : done ? (
                      <Check size={12} />
                    ) : (
                      <BellRing size={12} />
                    )}
                    {done ? "Chasing" : "Nudge"}
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        complete ? "bg-emerald-500" : "bg-[#9C7C2E]"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 tabular-nums shrink-0">
                    {s.total > 0 ? `${s.returned}/${s.total}` : "No roster"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
