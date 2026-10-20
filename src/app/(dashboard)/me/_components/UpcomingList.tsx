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
  if (diff === 1) return "Tmrw";
  if (diff < 7) return date.toLocaleDateString("en-GB", { weekday: "short" });
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// Next few dated items across all portals, soonest first. Sits inside the
// "This week" card, under the days.
export function UpcomingList({ items }: Props) {
  if (items.length === 0) {
    return <p className="mt-5 border-t border-line pt-4 text-[15px] text-muted-foreground">Nothing on the horizon yet.</p>;
  }
  return (
    <ul className="mt-4">
      {items.slice(0, 4).map((item) => (
        <li key={item.id} className="border-t border-line">
          <Link href={item.href} className="flex items-start gap-4 py-3.5 hover:[&_.t]:underline">
            <span className="w-12 shrink-0 text-sm text-muted-foreground">{formatDate(item.date)}</span>
            <span className="min-w-0 flex-1">
              <span className="t block font-semibold leading-snug">{item.title}</span>
              <span className="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground">
                <span className="size-2 shrink-0 rounded-full" style={{ background: (PORTAL_COLORS[item.portal] ?? PORTAL_COLORS.personal).accent }} aria-hidden />
                <span className="truncate">{item.context ?? PORTAL_LABELS[item.portal]}</span>
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
