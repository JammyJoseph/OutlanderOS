"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { type UnifiedItem, SOURCE_LABELS } from "./types";

const DAY_MS = 86_400_000;

// Whole days from today until the given ISO date. Negative = overdue.
export function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return Math.round((new Date(iso).getTime() - start.getTime()) / DAY_MS);
}

function dueInfo(iso: string | null): { label: string; overdue: boolean } {
  const diff = daysUntil(iso);
  if (diff === null) return { label: "No date", overdue: false };
  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, overdue: true };
  if (diff === 0) return { label: "Today", overdue: false };
  if (diff === 1) return { label: "Tomorrow", overdue: false };
  if (diff < 14) return { label: `${diff}d`, overdue: false };
  return { label: `${Math.round(diff / 7)}w`, overdue: false };
}

const PRIORITY_DOT: Record<string, string> = {
  URGENT: "bg-red-500",
  HIGH: "bg-orange-400",
  MEDIUM: "bg-[#D4A853]",
  LOW: "bg-gray-300",
};

function Row({
  item,
  busy,
  onToggle,
}: {
  item: UnifiedItem;
  busy: boolean;
  onToggle: () => void;
}) {
  const due = dueInfo(item.dueDate);
  return (
    <li
      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
        due.overdue && !item.done
          ? "border-red-100 bg-red-50/60"
          : "border-gray-100 bg-white hover:bg-gray-50"
      }`}
    >
      <button
        onClick={onToggle}
        disabled={busy}
        aria-label={item.done ? "Mark incomplete" : "Mark complete"}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
          item.done
            ? "border-[#D4A853] bg-[#D4A853] text-white"
            : "border-gray-300 hover:border-[#D4A853]"
        }`}
      >
        {busy ? (
          <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
        ) : item.done ? (
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        ) : null}
      </button>

      <span
        className={`h-2 w-2 shrink-0 rounded-full ${
          PRIORITY_DOT[item.priority] || "bg-gray-300"
        }`}
        title={item.priority}
      />

      <span
        className={`min-w-0 flex-1 truncate text-sm ${
          item.done ? "text-gray-400 line-through" : "text-gray-800"
        }`}
      >
        {item.title}
      </span>

      {item.status === "IN_PROGRESS" && !item.done && (
        <span className="hidden shrink-0 rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-500 sm:inline">
          In progress
        </span>
      )}

      <span className="shrink-0 rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
        {SOURCE_LABELS[item.source]}
      </span>

      {item.dueDate && (
        <span
          className={`shrink-0 text-xs font-semibold ${
            due.overdue && !item.done ? "text-red-600" : "text-gray-400"
          }`}
        >
          {due.label}
        </span>
      )}
    </li>
  );
}

// Renders the merged task + deadline list: open items sorted overdue-first,
// completed items collapsed into a "Done" section.
export function UnifiedTaskList({
  items,
  busyId,
  onToggle,
}: {
  items: UnifiedItem[];
  busyId: string | null;
  onToggle: (item: UnifiedItem) => void;
}) {
  const [showDone, setShowDone] = useState(false);

  const open = useMemo(() => {
    return items
      .filter((it) => !it.done)
      .sort((a, b) => {
        const ao = (daysUntil(a.dueDate) ?? Infinity) < 0 ? 0 : 1;
        const bo = (daysUntil(b.dueDate) ?? Infinity) < 0 ? 0 : 1;
        if (ao !== bo) return ao - bo;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      });
  }, [items]);

  const done = useMemo(() => items.filter((it) => it.done), [items]);

  if (open.length === 0 && done.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-gray-400">
        Nothing here. Add a task to get started.
      </p>
    );
  }

  return (
    <div>
      {open.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">
          Nothing open here. Nice.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {open.map((it) => (
            <Row
              key={it.id}
              item={it}
              busy={busyId === it.id}
              onToggle={() => onToggle(it)}
            />
          ))}
        </ul>
      )}

      {done.length > 0 && (
        <div className="mt-4 border-t border-gray-100 pt-3">
          <button
            onClick={() => setShowDone((v) => !v)}
            className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-400 hover:text-gray-600"
          >
            {showDone ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            Done ({done.length})
          </button>
          {showDone && (
            <ul className="mt-2 space-y-1.5">
              {done.map((it) => (
                <Row
                  key={it.id}
                  item={it}
                  busy={busyId === it.id}
                  onToggle={() => onToggle(it)}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
