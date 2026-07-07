import type { CallSheetViewData } from "./CallSheetDocument";

// A short, SMS/WhatsApp-friendly roundup of the call sheet. Kept deliberately
// terse: header, call times, schedule, locations, a single contact and the
// live link. Empty sections are dropped so the message stays tight.
export function generateSMSSummary(
  data: CallSheetViewData,
  link?: string | null
): string {
  const blocks: string[] = [];

  // ── Header: company + "Title — Wed 8 Jul" ──
  const company = (data.header?.productionCompany || "Outlander").toUpperCase();
  const title = data.shootTitle || data.productionTitle || "Call Sheet";
  const dateLabel = formatShootDate(data.shootDate);
  blocks.push(`${company}\n${title}${dateLabel ? ` — ${dateLabel}` : ""}`);

  // ── Call times ──
  const callLines: { time: string; label: string }[] = [];
  if (data.callTime) callLines.push({ time: data.callTime, label: "Crew call" });
  for (const row of data.callTimes || []) {
    if (row.time && row.department) callLines.push({ time: row.time, label: row.department });
  }
  const seenTalent = new Set<string>();
  for (const t of data.talent || []) {
    const name = (t.name || "").trim();
    if (!t.callTime || !name || seenTalent.has(name)) continue;
    seenTalent.add(name);
    callLines.push({ time: t.callTime, label: `Talent (${name})` });
  }
  if (data.wrapTime) callLines.push({ time: data.wrapTime, label: "Wrap" });
  if (callLines.length) {
    callLines.sort((a, b) => a.time.localeCompare(b.time));
    blocks.push(`CALL TIMES\n${callLines.map((c) => `${c.time} ${c.label}`).join("\n")}`);
  }

  // ── Schedule ──
  const scheduleLines = (data.schedule || [])
    .filter((s) => s.time || s.description)
    .map((s) => {
      const desc = (s.description || "").trim();
      const notes = (s.notes || "").trim();
      return `${s.time || ""} ${desc}${notes ? ` — ${notes}` : ""}`.trim();
    });
  if (scheduleLines.length) blocks.push(`SCHEDULE\n${scheduleLines.join("\n")}`);

  // ── Locations ──
  const locationLines = (data.locations || [])
    .filter((l) => (l.name || l.address || "").trim())
    .map((l, i) => {
      const name = (l.name || l.address || "").trim();
      const postcode = (l.postcode || "").trim();
      return `${i + 1}. ${name}${postcode ? `, ${postcode}` : ""}`;
    });
  if (locationLines.length) blocks.push(`LOCATIONS\n${locationLines.join("\n")}`);

  // ── Contact: first production mobile, else first crew member with a phone ──
  const contact =
    (data.productionMobiles || []).find((m) => (m.phone || "").trim() && (m.name || "").trim()) ||
    (data.crew || []).find((m) => (m.phone || "").trim() && (m.name || "").trim());
  if (contact) blocks.push(`Contact: ${contact.name.trim()} ${contact.phone.trim()}`);

  blocks.push(`Full sheet: ${link || "[link]"}`);

  return blocks.join("\n\n");
}

// "Wed 8 Jul" — short weekday + day + month. Returns "" for an unparseable date.
function formatShootDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
