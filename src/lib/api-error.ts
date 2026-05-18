import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

type RouteHandler = (
  request: Request,
  context?: any
) => Promise<Response> | Response

/**
 * Wraps an API route handler with try/catch so uncaught exceptions return
 * a 500 JSON response instead of crashing the request. Auth flows that
 * `throw` a Response (e.g. redirects, 401s) are passed through untouched.
 */
export function withErrorHandling(handler: RouteHandler): RouteHandler {
  return async (request: Request, context?: any) => {
    try {
      return await handler(request, context)
    } catch (error) {
      if (error instanceof Response) return error

      const method = request?.method ?? 'UNKNOWN'
      let path = 'unknown'
      try {
        path = new URL(request.url).pathname
      } catch {
        // request.url unavailable — keep default
      }

      logger.error('API', `${method} ${path} failed`, error)

      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  }
}
