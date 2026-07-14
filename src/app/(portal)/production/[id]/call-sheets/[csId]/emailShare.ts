import type { CallSheetViewData } from "./CallSheetDocument";
import type { ClientContactRef } from "./types";
import { resolveUnitCall } from "./types";

// Email sharing is mailto-only: there is no sending service behind the portal,
// so every "Email …" action hands off to the user's own mail client with the
// recipients pre-loaded into BCC (never To/Cc — a call sheet goes to a list of
// people who have no business seeing each other's addresses).

export type EmailAudience = "crew" | "client";

export interface EmailRecipient {
  email: string;
  name: string;
  role: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

// Dedupe by lowercased address (first row wins, so the richer label from the
// roster beats a later bare entry) and drop anything that isn't an address —
// half-typed rows are normal in a call sheet that's still being filled in.
function collect(
  rows: { email?: string | null; name?: string | null; role?: string | null }[]
): EmailRecipient[] {
  const out: EmailRecipient[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const email = (row.email || "").trim();
    if (!isValidEmail(email)) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      email,
      name: (row.name || "").trim(),
      role: (row.role || "").trim(),
    });
  }
  return out;
}

// Everyone working the day: the crew roster plus talent, straight off the sheet.
export function crewRecipients(data: CallSheetViewData): EmailRecipient[] {
  return collect([
    ...(data.crew || []),
    ...(data.talent || []).map((t) => ({ ...t, role: (t.role || "").trim() || "Talent" })),
  ]);
}

// The other side of the sheet: the deal's client contact (from the production's
// campaign) plus the agency team named on the call sheet. `clientTeam` rows
// carry no address, so they can't be reached here — they're added by hand.
export function clientRecipients(
  data: CallSheetViewData,
  clientContact: ClientContactRef | null | undefined
): EmailRecipient[] {
  return collect([
    ...(clientContact
      ? [
          {
            email: clientContact.email,
            name: clientContact.name,
            role: (clientContact.role || "").trim() || "Client",
          },
        ]
      : []),
    ...(data.agencyTeam || []).map((a) => ({ ...a, role: (a.role || "").trim() || "Agency" })),
  ]);
}

// Locations are often left with the auto-generated "Location 1" name and the
// real address underneath — same rule as the SMS summary: never show the
// placeholder, fall back to the address.
function locationLabel(l: { name?: string; address?: string; postcode?: string }): string {
  const name = (l.name || "").trim();
  const address = (l.address || "").trim();
  const postcode = (l.postcode || "").trim();
  const generic = !name || /^location\s*\d+$/i.test(name);
  const main = generic ? address : address ? `${name}, ${address}` : name;
  const label = main || address || name;
  if (postcode && label && !label.toLowerCase().includes(postcode.toLowerCase())) {
    return `${label}, ${postcode}`;
  }
  return label || postcode;
}

// "Wed 8 Jul 2026" — matches the SMS summary's date line.
export function formatShootDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d
    .toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    })
    .replace(/,/g, "");
}

// "[Production] — Call Sheet: Wed 8 Jul 2026"
export function emailSubject(data: CallSheetViewData): string {
  const title = data.productionTitle || data.shootTitle || "Call Sheet";
  const date = formatShootDate(data.shootDate);
  return date ? `${title} — Call Sheet: ${date}` : `${title} — Call Sheet`;
}

// Short covering note. The link is the whole point of the email, so it gets its
// own line; everything else is the minimum needed to read the mail on a phone
// without opening the sheet.
export function emailBody(
  data: CallSheetViewData,
  link: string,
  audience: EmailAudience
): string {
  const title = data.shootTitle || data.productionTitle || "the shoot";
  const date = formatShootDate(data.shootDate);
  const unitCall = resolveUnitCall(data.unitCallTime, data.callTime);
  const first = (data.locations || [])[0];
  const where = first ? locationLabel(first) : "";
  const company = (data.header?.productionCompany || "Outlander Studios").trim();

  const lines: string[] = [];
  lines.push("Hi all,");
  lines.push("");
  lines.push(
    audience === "crew"
      ? `Call sheet for ${title}${date ? ` on ${date}` : ""} — please read it through before the day.`
      : `Call sheet for ${title}${date ? ` on ${date}` : ""} — sharing it with you ahead of the shoot.`
  );
  lines.push("");
  if (unitCall) lines.push(`Unit call: ${unitCall}`);
  if (where) lines.push(`Location: ${where}`);
  if (unitCall || where) lines.push("");
  lines.push(`View the call sheet here: ${link || "[link]"}`);
  lines.push("");
  lines.push("Any questions, just reply to this email.");
  lines.push("");
  lines.push(company);
  return lines.join("\n");
}

// mailto: with every recipient in BCC. Addresses are percent-encoded
// individually so the commas stay separators (RFC 6068) and a "+" in an address
// survives the trip into the mail client.
export function buildMailto(opts: {
  bcc: string[];
  subject: string;
  body: string;
}): string {
  const params: string[] = [];
  const bcc = opts.bcc.filter((e) => isValidEmail(e)).map((e) => encodeURIComponent(e.trim()));
  if (bcc.length) params.push(`bcc=${bcc.join(",")}`);
  params.push(`subject=${encodeURIComponent(opts.subject)}`);
  params.push(`body=${encodeURIComponent(opts.body)}`);
  return `mailto:?${params.join("&")}`;
}
