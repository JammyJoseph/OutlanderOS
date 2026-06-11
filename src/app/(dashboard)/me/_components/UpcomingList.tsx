"use client";

import Link from "next/link";
import { PORTAL_COLORS, type UpcomingItem } from "./types";

interface Props {
  items: UpcomingItem[];
}

const PORTAL_LABELS: Record<UpcomingItem["portal"], string> = {
  commercial: "Commercial",
  production: "Production",
  print: "Print",
  personal: "Task",
};

function formatDate(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((new Date(date).setHours(0, 0, 0, 0) - today.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

// Next few dated items across all portals, soonest first.
export function UpcomingList({ items }: Props) {
  return (
    <section className="rounded-xl border border-gray-100 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-4 py-3">
        <h2 className="text-sm font-bold text-gray-900">Upcoming</h2>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-gray-400">
          Nothing on the horizon yet.
        </p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {items.slice(0, 3).map((item) => {
            const colors = PORTAL_COLORS[item.portal] ?? PORTAL_COLORS.personal;
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-gray-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-gray-800">{item.title}</div>
                    <div className="truncate text-xs text-gray-400">
                      {formatDate(item.date)}
                      {item.context ? ` · ${item.context}` : ""}
                    </div>
                  </div>
                  <span
                    className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                    style={{ backgroundColor: colors.bg, color: colors.text }}
                  >
                    {PORTAL_LABELS[item.portal]}
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
