"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, Clapperboard, FileText, PackageCheck, Briefcase } from "lucide-react";

interface Deadline {
  id: string;
  title: string;
  date: string;
  portal: "commercial" | "production";
  project: string;
  type: string;
  href: string;
  daysUntil: number;
  urgency: "overdue" | "soon" | "later";
}

const TYPE_ICON: Record<string, React.ElementType> = {
  shoot: Clapperboard,
  brief: FileText,
  deliverable: PackageCheck,
  deal: Briefcase,
};

// Urgency colour coding: red overdue, amber this week, grey later.
const URGENCY: Record<Deadline["urgency"], { dot: string; chip: string; label: (d: number) => string }> = {
  overdue: {
    dot: "bg-red-500",
    chip: "bg-red-50 text-red-600",
    label: (d) => `${Math.abs(d)}d overdue`,
  },
  soon: {
    dot: "bg-amber-500",
    chip: "bg-amber-50 text-amber-600",
    label: (d) => (d === 0 ? "Today" : d === 1 ? "Tomorrow" : `in ${d}d`),
  },
  later: {
    dot: "bg-gray-300",
    chip: "bg-gray-100 text-gray-500",
    label: (d) => `in ${d}d`,
  },
};

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// Aggregated deadlines across portals — production shoots, commercial briefs,
// deliverables and deal due dates. Sits alongside the ACTION/TRACK panel.
export function DeadlinesPanel() {
  const [items, setItems] = useState<Deadline[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/deadlines")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((json: Deadline[]) => {
        if (!cancelled) setItems(Array.isArray(json) ? json : []);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          <CalendarClock className="h-3.5 w-3.5" /> Deadlines
        </h2>
        {items && items.length > 0 && (
          <span className="text-[11px] font-semibold text-gray-400">{items.length}</span>
        )}
      </div>

      {error ? (
        <p className="mt-3 text-xs text-gray-400">Couldn&apos;t load deadlines right now.</p>
      ) : !items ? (
        <div className="mt-3 space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="mt-3 text-xs text-gray-400">No upcoming deadlines across the portals. 🎉</p>
      ) : (
        <ul className="mt-2 divide-y divide-gray-50">
          {items.map((d) => {
            const Icon = TYPE_ICON[d.type] ?? CalendarClock;
            const u = URGENCY[d.urgency];
            return (
              <li key={d.id}>
                <Link
                  href={d.href}
                  className="flex items-center gap-3 py-2.5 transition-colors hover:bg-gray-50/60"
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${u.dot}`} />
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-400">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-gray-800">
                      {d.title}
                    </span>
                    <span className="block truncate text-[11px] text-gray-400">
                      {dateLabel(d.date)} ·{" "}
                      <span className="capitalize">{d.portal}</span>
                      {d.project ? ` · ${d.project}` : ""}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${u.chip}`}
                  >
                    {u.label(d.daysUntil)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
