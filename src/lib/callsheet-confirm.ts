// Call-sheet receipt confirmation tokens (Phase 4A).
//
// A confirmation link is per-recipient: it encodes the call sheet id + the
// recipient's email (or name when there's no email) so clicking it marks that
// one person's receipt. The token is opaque base64url — the call sheet id is a
// hard-to-guess cuid, which is enough for a low-stakes "I got it" receipt.

export function encodeConfirmToken(callSheetId: string, recipient: string): string {
  const raw = `${callSheetId}|${(recipient || "").trim().toLowerCase()}`;
  return Buffer.from(raw, "utf8").toString("base64url");
}

export function decodeConfirmToken(
  token: string
): { callSheetId: string; recipient: string } | null {
  try {
    const raw = Buffer.from(token, "base64url").toString("utf8");
    const idx = raw.indexOf("|");
    if (idx < 0) return null;
    return { callSheetId: raw.slice(0, idx), recipient: raw.slice(idx + 1) };
  } catch {
    return null;
  }
}

// Match key used to find a distribution entry from a decoded recipient — email
// if present, else the name (both lower-cased/trimmed).
export function recipientKey(entry: { email?: string | null; name?: string | null }): string {
  const email = (entry.email || "").trim().toLowerCase();
  if (email) return email;
  return (entry.name || "").trim().toLowerCase();
}
