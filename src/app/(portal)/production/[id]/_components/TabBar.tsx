"use client";

import {
  LayoutDashboard,
  Wallet,
  Users,
  Palette,
  CalendarRange,
  ClipboardList,
  Package,
} from "lucide-react";

export type TabKey =
  | "overview"
  | "budget"
  | "team"
  | "creative"
  | "timeline"
  | "callsheets"
  | "deliverables";

interface Props {
  active: TabKey;
  onSelect: (k: TabKey) => void;
  counts: Partial<Record<TabKey, number>>;
}

const TABS: { key: TabKey; label: string; Icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { key: "overview", label: "Overview", Icon: LayoutDashboard },
  { key: "budget", label: "Budget", Icon: Wallet },
  { key: "team", label: "Team", Icon: Users },
  { key: "creative", label: "Creative", Icon: Palette },
  { key: "timeline", label: "Timeline", Icon: CalendarRange },
  { key: "callsheets", label: "Call Sheets", Icon: ClipboardList },
  { key: "deliverables", label: "Deliverables", Icon: Package },
];

export default function TabBar({ active, onSelect, counts }: Props) {
  return (
    <div className="sticky top-0 z-30 bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/70 -mx-6 px-6 border-b border-gray-100 dark:border-gray-800">
      <div className="flex gap-1 overflow-x-auto scrollbar-none py-2">
        {(TABS ?? []).map(({ key, label, Icon }) => {
          const isActive = active === key;
          const count = counts[key];
          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              className={`relative inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-colors shrink-0 ${
                isActive
                  ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm border border-gray-100 dark:border-gray-800"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-white/60 dark:hover:bg-gray-900/60"
              }`}
            >
              <Icon size={15} className={isActive ? "text-[#ffd700]" : "text-gray-400"} />
              {label}
              {count != null && count > 0 && (
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                    isActive ? "bg-amber-50 text-[#ffd700]" : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
