// Shared pagination helpers for list endpoints.
//
// All paginated list endpoints return the standard envelope:
//   { data: T[], total: number, page: number, pages: number }

export type Paginated<T> = {
  data: T[]
  total: number
  page: number
  pages: number
}

// Parse `?page=&limit=` from a URL's search params, clamped to sane bounds.
export function parsePagination(
  searchParams: URLSearchParams,
  opts: { defaultLimit?: number; maxLimit?: number } = {}
): { page: number; limit: number; skip: number } {
  const defaultLimit = opts.defaultLimit ?? 50
  const maxLimit = opts.maxLimit ?? 200
  const rawPage = Number(searchParams.get('page'))
  const rawLimit = Number(searchParams.get('limit'))
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1
  const limit =
    Number.isFinite(rawLimit) && rawLimit >= 1
      ? Math.min(Math.floor(rawLimit), maxLimit)
      : defaultLimit
  return { page, limit, skip: (page - 1) * limit }
}

// Wrap a page of rows in the standard envelope.
export function paginate<T>(data: T[], total: number, page: number, limit: number): Paginated<T> {
  return { data, total, page, pages: Math.max(1, Math.ceil(total / limit)) }
}
