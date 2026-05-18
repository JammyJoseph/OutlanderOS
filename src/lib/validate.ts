// Lightweight input validation helpers for API write routes.

// Returns an error message for the first missing/empty field, or null if all present.
export function validateRequired(
  data: unknown,
  fields: string[]
): string | null {
  if (!data || typeof data !== "object") {
    return "Request body is required"
  }
  const record = data as Record<string, unknown>
  for (const field of fields) {
    const value = record[field]
    if (
      value === undefined ||
      value === null ||
      (typeof value === "string" && value.trim() === "")
    ) {
      return `Missing required field: ${field}`
    }
  }
  return null
}

// Trims a string and caps its length. Non-strings become "".
export function sanitizeString(input: unknown, maxLength = 1000): string {
  if (typeof input !== "string") return ""
  return input.trim().slice(0, maxLength)
}

// Basic RFC-ish email shape check.
export function validateEmail(email: unknown): boolean {
  if (typeof email !== "string") return false
  const trimmed = email.trim()
  if (trimmed.length === 0 || trimmed.length > 320) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
}

// Returns true if the string parses to a valid date.
export function validateDate(date: unknown): boolean {
  if (typeof date !== "string" || date.trim() === "") return false
  const parsed = new Date(date)
  return !Number.isNaN(parsed.getTime())
}
