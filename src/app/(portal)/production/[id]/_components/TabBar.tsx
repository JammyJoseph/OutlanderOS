"use client";

export type TabKey =
  | "overview"
  | "budget"
  | "team"
  | "creative"
  | "timeline"
  | "callsheets"
  | "deliverables"
  | "workflows";

interface Props {
  active: TabKey;
  onSelect: (k: TabKey) => void;
  counts: Partial<Record<TabKey, number>>;
}

// Order follows the redesign's project board (5.2).
const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "creative", label: "Creative" },
  { key: "budget", label: "Budget" },
  { key: "callsheets", label: "Call sheets" },
  { key: "team", label: "Team" },
  { key: "deliverables", label: "Deliverables" },
  { key: "timeline", label: "Timeline" },
  { key: "workflows", label: "Workflows" },
];

// Pill tabs; the current one is ink. Sticks to the top so the long tabs
// (budget, team) keep their navigation in reach.
export default function TabBar({ active, onSelect, counts }: Props) {
  return (
    <div className="sticky top-0 z-30 -my-2 bg-background/95 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div role="tablist" aria-label="Project sections" className="scrollbar-none flex gap-1 overflow-x-auto">
        {TABS.map(({ key, label }) => {
          const isActive = active === key;
          const count = counts[key];
          return (
            <button
              key={key}
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelect(key)}
              className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors ${
                isActive ? "bg-foreground text-background" : "text-ink-2 hover:bg-surface hover:text-foreground"
              }`}
            >
              {label}
              {count != null && count > 0 && (
                <span
                  className={`tabular-nums text-xs ${isActive ? "text-background/70" : "text-muted-foreground"}`}
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
