"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, AlarmClock } from "lucide-react";

interface Deadline {
  id: string;
  title: string;
  dueDate: string;
  status: string;
  priority: string;
}

const DAY_MS = 86_400_000;

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function bucketCounts(deadlines: Deadline[]) {
  let overdue = 0;
  let today = 0;
  const now = new Date();
  const todayStart = startOfDay(now).getTime();
  for (const d of deadlines) {
    if (d.status === "COMPLETED") continue;
    const dueStart = startOfDay(new Date(d.dueDate)).getTime();
    const diffDays = Math.round((dueStart - todayStart) / DAY_MS);
    if (diffDays < 0) overdue++;
    else if (diffDays === 0) today++;
  }
  return { overdue, today };
}

export function NotificationBell({ tone = "light" }: { tone?: "light" | "dark" }) {
  const [counts, setCounts] = useState({ overdue: 0, today: 0 });
  const [open, setOpen] = useState(false);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/deadlines");
        const data = await res.json();
        if (!cancelled && Array.isArray(data)) {
          setDeadlines(data);
          setCounts(bucketCounts(data));
        }
      } catch {
        // silent
      }
    }
    load();
    const t = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const total = counts.overdue + counts.today;
  const badgeColor =
    counts.overdue > 0
      ? "bg-red-500 text-white"
      : counts.today > 0
      ? "bg-[#D4A853] text-black"
      : "bg-gray-400 text-white";

  const buttonBase =
    tone === "dark"
      ? "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
      : "text-gray-500 hover:bg-gray-100 hover:text-gray-900";

  const upcoming = deadlines
    .filter((d) => d.status !== "COMPLETED")
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 6);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`relative flex h-8 w-8 items-center justify-center rounded-lg ${buttonBase}`}
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {total > 0 && (
          <span
            className={`absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${badgeColor}`}
          >
            {total}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-9 z-50 w-80 rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
            <div className="border-b border-gray-100 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                Deadline Alerts
              </p>
              <div className="mt-2 flex items-center gap-3 text-xs">
                {counts.overdue > 0 ? (
                  <span className="flex items-center gap-1 font-semibold text-red-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                    {counts.overdue} overdue
                  </span>
                ) : null}
                {counts.today > 0 ? (
                  <span className="flex items-center gap-1 font-semibold text-amber-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    {counts.today} due today
                  </span>
                ) : null}
                {total === 0 && (
                  <span className="text-gray-400">All caught up.</span>
                )}
              </div>
            </div>

            <ul className="max-h-72 overflow-y-auto">
              {upcoming.length === 0 ? (
                <li className="px-4 py-6 text-center text-xs text-gray-400">
                  No active deadlines.
                </li>
              ) : (
                upcoming.map((d) => {
                  const dueStart = startOfDay(new Date(d.dueDate)).getTime();
                  const todayStart = startOfDay(new Date()).getTime();
                  const dayDiff = Math.round((dueStart - todayStart) / DAY_MS);
                  const tone =
                    dayDiff < 0
                      ? "text-red-600 font-bold"
                      : dayDiff === 0
                      ? "text-amber-600 font-semibold"
                      : "text-gray-500";
                  const label =
                    dayDiff < 0
                      ? `${Math.abs(dayDiff)}d overdue`
                      : dayDiff === 0
                      ? "Today"
                      : `${dayDiff}d`;
                  return (
                    <li key={d.id}>
                      <Link
                        href="/me"
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50"
                      >
                        <AlarmClock className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                        <span className="flex-1 truncate text-xs text-gray-800">
                          {d.title}
                        </span>
                        <span className={`text-[10px] uppercase tracking-wide ${tone}`}>
                          {label}
                        </span>
                      </Link>
                    </li>
                  );
                })
              )}
            </ul>

            <div className="border-t border-gray-100 px-4 py-2">
              <Link
                href="/me"
                onClick={() => setOpen(false)}
                className="text-xs font-medium text-gray-700 hover:text-gray-900"
              >
                View all deadlines →
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
