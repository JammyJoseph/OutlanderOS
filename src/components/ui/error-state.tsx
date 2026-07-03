"use client";

import { AlertTriangle, RotateCw } from "lucide-react";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  /** Compact variant for small dashboard cards. */
  compact?: boolean;
}

/** Inline error with an optional retry button. Dark-mode aware. */
export function ErrorState({
  title = "Couldn't load this",
  message = "Something went wrong. Please try again.",
  onRetry,
  compact = false,
}: ErrorStateProps) {
  if (compact) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-red-100 dark:border-red-900/40 bg-red-50/60 dark:bg-red-900/20 px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-500 dark:text-red-400" />
          <span className="truncate text-xs font-medium text-red-700 dark:text-red-300">{title}</span>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40"
          >
            <RotateCw className="h-3 w-3" /> Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
      <div className="mb-3 rounded-full bg-red-100 dark:bg-red-900/30 p-3">
        <AlertTriangle className="h-6 w-6 text-red-500 dark:text-red-400" />
      </div>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      <p className="mt-1 max-w-xs text-xs text-gray-500 dark:text-gray-400">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#ffd700] px-3.5 py-2 text-xs font-semibold text-black hover:brightness-95"
        >
          <RotateCw className="h-3.5 w-3.5" /> Try again
        </button>
      )}
    </div>
  );
}
