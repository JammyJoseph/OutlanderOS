"use client";

import { Check, CloudOff, Loader2 } from "lucide-react";
import type { PresenceUser, SaveStatus } from "./collab";

// Stable per-person colour — same name, same dot, every session and every tab.
const DOT_COLOURS = [
  "#2E7D6B", "#A93B2E", "#3B5FA9", "#8A5AA9", "#B07A2E", "#4A7F2E",
];

function colourFor(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return DOT_COLOURS[h % DOT_COLOURS.length];
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

// "Olive is editing" / "Olive and Sam are editing" / "Olive and 3 others are editing"
function summarise(others: PresenceUser[]): string {
  const names = others.map((u) => firstName(u.name));
  if (names.length === 1) return `${names[0]} is editing`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are editing`;
  return `${names[0]} and ${names.length - 1} others are editing`;
}

export function PresenceBar({
  others,
  status,
}: {
  others: PresenceUser[];
  status: SaveStatus;
}) {
  // Nothing to say — no other editors, nothing saving. Render nothing rather than
  // an empty bar that reserves space and makes the page jump.
  if (others.length === 0 && status === "idle") return null;

  return (
    <div className="flex items-center gap-3 mb-4 print:hidden" aria-live="polite">
      {others.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {others.map((u) => (
            <span
              key={u.userId}
              title={u.email || u.name}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-medium text-gray-600 dark:text-gray-300"
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: colourFor(u.userId) }}
              />
              {firstName(u.name)}
            </span>
          ))}
          <span className="text-xs text-gray-400 dark:text-gray-500">{summarise(others)}</span>
        </div>
      )}

      <span className="ml-auto">
        {status === "saving" && (
          <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
            <Loader2 size={12} className="animate-spin" /> Saving…
          </span>
        )}
        {status === "saved" && (
          <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            <Check size={12} /> Saved
          </span>
        )}
        {status === "error" && (
          <span
            className="flex items-center gap-1 text-xs text-[#A93B2E] font-medium"
            title="The last change didn't save. It'll retry on your next edit."
          >
            <CloudOff size={12} /> Not saved
          </span>
        )}
      </span>
    </div>
  );
}
