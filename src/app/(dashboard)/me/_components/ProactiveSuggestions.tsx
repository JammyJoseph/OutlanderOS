"use client";

import { Sparkles, Loader2 } from "lucide-react";
import type { Suggestion } from "./types";

interface Props {
  suggestions: Suggestion[];
  loading: boolean;
}

export function ProactiveSuggestions({ suggestions, loading }: Props) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-purple-100 bg-purple-50/60 px-3 py-3 text-sm text-purple-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Thinking about what needs your attention…
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="rounded-xl border border-purple-100 bg-purple-50/60 px-3 py-3 text-sm text-purple-400">
        Nothing urgent flagged right now.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {suggestions.map((s, i) => (
        <div
          key={i}
          className="rounded-xl border border-purple-100 bg-purple-50/70 px-3 py-2.5"
        >
          <div className="flex items-start gap-2">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-purple-500" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-purple-900">{s.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-purple-700">{s.detail}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
