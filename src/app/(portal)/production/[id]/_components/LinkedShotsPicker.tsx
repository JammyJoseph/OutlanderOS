"use client";

import { useState } from "react";
import { Link2, X, ChevronDown, ChevronRight } from "lucide-react";

export interface ShotOption {
  shotNumber: string;
  description?: string;
}

// Editable multi-select linking a deliverable to the shots it's produced from.
// Plain React (no shadcn) — a row of removable chips plus a collapsible grid of
// every available shot number to toggle. `accent` themes the selected state.
export function LinkedShotsPicker({
  shots,
  selected,
  onChange,
  accent = "#9C7C2E",
}: {
  shots: ShotOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  accent?: string;
}) {
  const [open, setOpen] = useState(false);
  const sel = new Set((selected ?? []).map(String));

  function toggle(n: string) {
    const next = new Set(sel);
    if (next.has(n)) next.delete(n);
    else next.add(n);
    onChange(Array.from(next));
  }

  const descOf = (n: string) => shots.find((s) => s.shotNumber === n)?.description || "";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          <Link2 size={11} /> Linked shots
        </span>
        {selected.length === 0 && (
          <span className="text-[11px] text-gray-400 italic">None</span>
        )}
        {(selected ?? []).map((n) => (
          <span
            key={n}
            title={descOf(n)}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-white px-2 py-0.5 rounded-full"
            style={{ backgroundColor: accent }}
          >
            Shot {n}
            <button
              onClick={() => toggle(n)}
              className="hover:opacity-70"
              title="Unlink"
            >
              <X size={10} />
            </button>
          </span>
        ))}
        <button
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-0.5 text-[11px] font-medium text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
        >
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          Edit
        </button>
      </div>

      {open && (
        <div className="rounded-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-2">
          {shots.length === 0 ? (
            <p className="text-[11px] text-gray-400 italic px-1 py-0.5">
              No shots yet — add a shot list on a call sheet.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {shots.map((s) => {
                const on = sel.has(s.shotNumber);
                return (
                  <button
                    key={s.shotNumber}
                    onClick={() => toggle(s.shotNumber)}
                    title={s.description || ""}
                    className={`text-[11px] font-medium px-2 py-1 rounded-lg border transition-colors ${
                      on
                        ? "text-white border-transparent"
                        : "text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800"
                    }`}
                    style={on ? { backgroundColor: accent } : undefined}
                  >
                    Shot {s.shotNumber}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
