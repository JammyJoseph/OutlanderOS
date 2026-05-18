'use client'

import React from 'react'
import Link from 'next/link'

const isDev = process.env.NODE_ENV !== 'production'

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
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
 * Clean, non-scary fallback card. Shared by the Next.js error.tsx route
 * boundaries and the ErrorBoundary class component below.
 */
export function ErrorFallback({
  error,
  onRetry,
  title = 'Something went wrong',
  message = "This section ran into an unexpected problem. It's usually temporary.",
}: {
  error?: Error & { digest?: string }
  onRetry?: () => void
  title?: string
  message?: string
}) {
  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center ring-1 ring-gray-200 shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
          <WarningIcon className="h-6 w-6 text-amber-500" />
        </div>
        <h2 className="mt-5 text-lg font-semibold text-gray-900">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-500">{message}</p>

        {isDev && error?.message && (
          <pre className="mt-4 max-h-32 overflow-auto rounded-lg bg-gray-50 p-3 text-left text-xs text-gray-600 ring-1 ring-gray-200">
            {error.message}
            {error.digest ? `\n\ndigest: ${error.digest}` : ''}
          </pre>
        )}

        <div className="mt-6 flex items-center justify-center gap-3">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex h-9 items-center justify-center rounded-lg bg-amber-500 px-4 text-sm font-medium text-white transition-colors hover:bg-amber-600"
            >
              Try again
            </button>
          )}
          <Link
            href="/"
            className="inline-flex h-9 items-center justify-center rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface ErrorBoundaryState {
  error: (Error & { digest?: string }) | null
}

/**
 * Class-based React error boundary for wrapping component subtrees that
 * aren't tied to a route segment. Catches rendering errors and shows the
 * clean ErrorFallback card with a working "Try again" reset.
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('[ErrorBoundary]', error)
  }

  reset = () => {
    this.setState({ error: null })
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback
      return <ErrorFallback error={this.state.error} onRetry={this.reset} />
    }
    return this.props.children
  }
}

export default ErrorBoundary
