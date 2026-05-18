'use client'

import { useEffect } from 'react'
import { ErrorFallback } from '@/components/ErrorBoundary'

export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    console.error('[DashboardError]', error)
  }, [error])

  return <ErrorFallback error={error} onRetry={() => unstable_retry()} />
}
