'use client'

import { useEffect } from 'react'
import { ErrorFallback } from '@/components/ErrorBoundary'

export default function PortalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    console.error('[PortalError]', error)
  }, [error])

  return <ErrorFallback error={error} onRetry={() => unstable_retry()} />
}
