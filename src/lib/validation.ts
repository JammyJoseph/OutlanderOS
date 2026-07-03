// Shared form-validation helpers so every form validates the same way.

/** Basic email shape check — good enough for client-side UX validation. */
export function isValidEmail(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

/**
 * Validates a URL. Accepts values with or without a protocol (we prepend
 * https:// when none is given, matching how users type "example.com").
 * Empty string is considered valid by callers that treat the field as optional.
 */
export function isValidUrl(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  try {
    const withProto = /^https?:\/\//i.test(v) ? v : `https://${v}`;
    const u = new URL(withProto);
    // Require a dot in the host so "foo" doesn't pass.
    return u.hostname.includes(".");
  } catch {
    return false;
  }
}

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: "empty" | "weak" | "medium" | "strong";
}

/**
 * Rates a password on length + character-class variety. Returns a coarse
 * weak/medium/strong bucket for the strength meter.
 */
export function passwordStrength(pw: string): PasswordStrength {
  if (!pw) return { score: 0, label: "empty" };

  let variety = 0;
  if (/[a-z]/.test(pw)) variety++;
  if (/[A-Z]/.test(pw)) variety++;
  if (/[0-9]/.test(pw)) variety++;
  if (/[^A-Za-z0-9]/.test(pw)) variety++;

  // Combine length and variety into a 1–4 score.
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (variety >= 2) score++;
  if (variety >= 3 && pw.length >= 10) score++;
  score = Math.max(1, Math.min(4, score)) as 1 | 2 | 3 | 4;

  const label = score <= 1 ? "weak" : score <= 2 ? "medium" : "strong";
  return { score: score as 1 | 2 | 3 | 4, label };
}
