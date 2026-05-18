"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Film,
  CalendarHeart,
  FolderKanban,
  ChevronRight,
  Sparkles,
} from "lucide-react";

interface DigestItem {
  id: string;
  kind: string;
  group: string;
  label: string;
  link: string;
  daysOverdue?: number;
  priority?: string;
}

interface Digest {
  text: string;
  counts: { overdue: number; dueToday: number; completedYesterday: number };
  items: DigestItem[];
}

// Overdue urgency → border + background tone (amber → red → red pulse).
function overdueTone(days: number): string {
  if (days >= 7) return "border-red-300 bg-red-50";
  if (days >= 3) return "border-red-200 bg-red-50/60";
  return "border-amber-200 bg-amber-50/70";
}

function ItemRow({ item }: { item: DigestItem }) {
  const isOverdue = item.group === "overdue";
  const days = item.daysOverdue ?? 0;
  const tone = isOverdue
    ? overdueTone(days)
    : "border-gray-100 bg-white hover:bg-gray-50";

  return (
    <Link
      href={item.link}
      className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 transition-colors ${tone}`}
    >
      {isOverdue && days >= 7 && (
        <span className="h-2 w-2 shrink-0 rounded-full bg-red-500 animate-pulse" />
      )}
      <span className="min-w-0 flex-1 truncate text-[13px] text-gray-800">
        {item.label}
      </span>
      {isOverdue && (
        <span
          className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
            days >= 3
              ? "bg-red-100 text-red-700"
              : "bg-amber-100 text-amber-700"
          }`}
        >
          {days}d overdue
        </span>
      )}
      {item.priority === "URGENT" && !isOverdue && (
        <span className="shrink-0 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
          URGENT
        </span>
      )}
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-300" />
    </Link>
  );
}

const SECTIONS: {
  key: string;
  label: string;
  icon: typeof AlertCircle;
  color: string;
}[] = [
  { key: "overdue", label: "Overdue", icon: AlertCircle, color: "text-red-600" },
  { key: "today", label: "Due Today", icon: CalendarClock, color: "text-amber-600" },
  { key: "week", label: "This Week", icon: CalendarClock, color: "text-gray-500" },
  { key: "project", label: "Projects Needing Attention", icon: FolderKanban, color: "text-amber-600" },
  { key: "shoot", label: "Production Shoots", icon: Film, color: "text-blue-600" },
  { key: "event", label: "Cultural Events", icon: CalendarHeart, color: "text-purple-600" },
  { key: "completed", label: "Completed Yesterday", icon: CheckCircle2, color: "text-green-600" },
];

export function AutoPingDigestCard() {
  const [digest, setDigest] = useState<Digest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auto-ping/digest", { method: "POST" })
      .then((r) => {
        if (!r.ok) throw new Error("digest failed");
        return r.json();
      })
      .then((data) => {
        if (!cancelled) setDigest(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = digest?.counts;

  return (
    <div className="mb-6 rounded-2xl border border-amber-100 bg-gradient-to-b from-amber-50/80 to-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-[#D4A853]" />
        <h2 className="text-sm font-semibold text-gray-900">Your daily briefing</h2>
      </div>

      {loading && (
        <p className="animate-pulse text-sm text-gray-400">
          Generating your daily briefing…
        </p>
      )}

      {error && !loading && (
        <p className="text-sm text-gray-500">
          Your briefing couldn&apos;t be generated right now — your tasks and
          deadlines are still tracked below.
        </p>
      )}

      {digest && !loading && (
        <>
          <p className="whitespace-pre-line text-[14px] leading-relaxed text-gray-700">
            {digest.text}
          </p>

          {counts && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-amber-100 pt-4">
              <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">
                {counts.overdue} overdue
              </span>
              <span className="text-gray-300">|</span>
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">
                {counts.dueToday} due today
              </span>
              <span className="text-gray-300">|</span>
              <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-700">
                {counts.completedYesterday} completed yesterday
              </span>
            </div>
          )}

          <div className="mt-4 space-y-4">
            {SECTIONS.map((section) => {
              const items = digest.items.filter((i) => i.group === section.key);
              if (items.length === 0) return null;
              const Icon = section.icon;
              return (
                <div key={section.key}>
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <Icon className={`h-3.5 w-3.5 ${section.color}`} />
                    <h3 className="text-xs font-semibold text-gray-900">
                      {section.label}
                    </h3>
                    <span className="text-[11px] text-gray-400">
                      ({items.length})
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {items.map((item) => (
                      <ItemRow key={`${section.key}-${item.id}`} item={item} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
