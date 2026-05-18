import { logger } from '@/lib/logger'

interface RetryOptions {
  retries?: number
  delay?: number
  backoff?: boolean
  context?: string
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Runs `fn`, retrying on failure. Defaults to 3 retries with exponential
 * backoff (1s, 2s, 4s). Logs each failure and re-throws the last error
 * once all attempts are exhausted.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const retries = options?.retries ?? 3
  const delay = options?.delay ?? 1000
  const backoff = options?.backoff ?? true
  const context = options?.context ?? 'retry'

  let lastError: unknown

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (attempt < retries) {
        const wait = backoff ? delay * 2 ** (attempt - 1) : delay
        logger.warn(
          context,
          `Attempt ${attempt}/${retries} failed, retrying in ${wait}ms`,
          error
        )
        await sleep(wait)
      } else {
        logger.error(
          context,
          `All ${retries} attempts failed`,
          error
        )
      }
    }
  }

  throw lastError
}

export default withRetry
