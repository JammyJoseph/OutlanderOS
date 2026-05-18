'use client'

import React from 'react'

function LoadingSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      <div className="h-4 w-1/3 rounded bg-gray-100 animate-pulse" />
      <div className="h-4 w-2/3 rounded bg-gray-100 animate-pulse" />
      <div className="h-4 w-1/2 rounded bg-gray-100 animate-pulse" />
    </div>
  )
}

function WarningIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0 text-amber-500"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

/**
 * Amber (not red) error notice. Used for graceful degradation — the rest
 * of the page stays usable while one section reports a problem.
 */
export function ErrorCard({
  message = "Couldn't load this section",
  onRetry,
}: {
  message?: string
  onRetry?: () => void
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <WarningIcon />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100"
        >
          Retry
        </button>
      )}
    </div>
  )
}

/**
 * Wraps a data-dependent section with loading and error states so a
 * failed fetch degrades gracefully instead of crashing the page.
 */
export function DataSection({
  title,
  children,
  error,
  loading,
  onRetry,
}: {
  title?: string
  children?: React.ReactNode
  error?: unknown
  loading?: boolean
  onRetry?: () => void
}) {
  return (
    <section>
      {title && (
        <h3 className="mb-2 text-sm font-semibold text-gray-900">{title}</h3>
      )}
      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <ErrorCard message="Couldn't load this section" onRetry={onRetry} />
      ) : (
        children
      )}
    </section>
  )
}

export default DataSection
