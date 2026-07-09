import type { CallSheetViewData } from "./CallSheetDocument";
import type { CallSheetLocation } from "./types";

// A short, SMS/WhatsApp-friendly roundup of the call sheet. Kept deliberately
// terse: header, call times, schedule, locations, the key contact(s) and the
// live link. Empty sections are dropped so the message stays tight.
export function generateSMSSummary(
  data: CallSheetViewData,
  link?: string | null
): string {
  const blocks: string[] = [];
  const locations = data.locations || [];

  // ── Header: company / title / date, each on its own line ──
  const company = (data.header?.productionCompany || "Outlander Studios").toUpperCase();
  const title = data.shootTitle || data.productionTitle || "Call Sheet";
  const dateLabel = formatShootDate(data.shootDate);
  blocks.push([company, title, dateLabel].filter(Boolean).join("\n"));

  // ── Call times — one entry per time slot ──
  // Sources (crew call, the call-times table, talent, wrap) often overlap on the
  // same time (e.g. "Crew call" + a "Crew Call" table row at 09:00), so we key
  // by time and keep the first label seen for each slot.
  const byTime = new Map<string, string>();
  const addTime = (time: string | undefined, label: string) => {
    const t = (time || "").trim();
    const l = label.trim();
    if (!t || !l || byTime.has(t)) return;
    byTime.set(t, l);
  };
  addTime(data.callTime, "Crew call");
  for (const row of data.callTimes || []) addTime(row.time, row.department);
  for (const t of data.talent || []) addTime(t.callTime, (t.name || "").trim());
  addTime(data.wrapTime, "Wrap");
  if (byTime.size) {
    const lines = [...byTime.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([time, label]) => `${time} ${label}`);
    blocks.push(`CALL TIMES\n${lines.join("\n")}`);
  }

  // ── Schedule — real location names (never "Location 1"), no call-time dupes ──
  const scheduleLines = (data.schedule || [])
    .filter((s) => s.time || s.description || s.locationRef)
    .map((s) => {
      const time = (s.time || "").trim();
      const locName = resolveLocationName(s.locationRef, locations);
      const rawDesc = (s.description || "").trim();
      // A description that's just a "Location N" pointer becomes the real name.
      const desc = /^location\s+\d+$/i.test(rawDesc)
        ? resolveLocationName(rawDesc, locations)
        : rawDesc;
      const notes = (s.notes || "").trim();
      const head =
        locName && desc && locName.toLowerCase() !== desc.toLowerCase()
          ? `${locName} — ${desc}`
          : locName || desc;
      return `${time} ${head}${notes ? ` — ${notes}` : ""}`.trim();
    })
    .filter(Boolean);
  if (scheduleLines.length) blocks.push(`SCHEDULE\n${scheduleLines.join("\n")}`);

  // ── Locations — actual names + postcodes, no numbering ──
  const locationLines = locations
    .map((l) => {
      const name = (l.name || l.address || "").trim();
      const postcode = (l.postcode || "").trim();
      return name ? `${name}${postcode ? `, ${postcode}` : ""}` : "";
    })
    .filter(Boolean);
  if (locationLines.length) blocks.push(`LOCATIONS\n${locationLines.join("\n")}`);

  // ── Contact — the producer, plus a separate agency contact if it's a
  // different person. Never a random crew member. ──
  const contactLines: string[] = [];
  const producerName = (data.productionCompany?.producer || "").trim();
  if (producerName) {
    const phone = findPhone(producerName, data) || findPhoneByRole("producer", data);
    contactLines.push(`Producer: ${producerName}${phone ? ` — ${phone}` : ""}`);
  }
  const agency = (data.agencyTeam || []).find((a) => (a.name || "").trim());
  if (agency) {
    const agencyName = (agency.name || "").trim();
    const sameAsProducer =
      producerName && agencyName.toLowerCase() === producerName.toLowerCase();
    if (agencyName && !sameAsProducer) {
      const label = (agency.role || "").trim() || "Agency";
      const phone = (agency.phone || "").trim() || findPhone(agencyName, data);
      contactLines.push(`${label}: ${agencyName}${phone ? ` — ${phone}` : ""}`);
    }
  }
  // Fall back to a production mobile / crew member with a phone only when there
  // is no producer or agency contact at all.
  if (contactLines.length === 0) {
    const fallback =
      (data.productionMobiles || []).find((m) => (m.phone || "").trim() && (m.name || "").trim()) ||
      (data.crew || []).find((m) => (m.phone || "").trim() && (m.name || "").trim());
    if (fallback) contactLines.push(`Contact: ${fallback.name.trim()} — ${fallback.phone.trim()}`);
  }
  if (contactLines.length) blocks.push(contactLines.join("\n"));

  blocks.push(`Full sheet: ${link || "[link]"}`);

  return blocks.join("\n\n");
}

// Resolve a schedule's location reference to the real location name. Matches by
// name first, then handles a bare "Location N" pointer by index. Returns the
// original ref (or "") when nothing better is found.
function resolveLocationName(ref: string | undefined, locations: CallSheetLocation[]): string {
  const r = (ref || "").trim();
  if (!r) return "";
  const byName = locations.find((l) => (l.name || "").trim().toLowerCase() === r.toLowerCase());
  if (byName && (byName.name || "").trim()) return byName.name.trim();
  const m = r.match(/^location\s+(\d+)$/i);
  if (m) {
    const loc = locations[parseInt(m[1], 10) - 1];
    if (loc) {
      const name = (loc.name || loc.address || "").trim();
      if (name) return name;
    }
  }
  return r;
}

// Look up a phone number for a named person across production mobiles, crew and
// the agency team. Returns "" when not found.
function findPhone(name: string, data: CallSheetViewData): string {
  const target = name.trim().toLowerCase();
  if (!target) return "";
  const pools: { name?: string; phone?: string }[] = [
    ...(data.productionMobiles || []),
    ...(data.crew || []),
    ...(data.agencyTeam || []),
  ];
  const hit = pools.find(
    (p) => (p.name || "").trim().toLowerCase() === target && (p.phone || "").trim()
  );
  return hit ? (hit.phone || "").trim() : "";
}

// Fallback phone lookup by role keyword (e.g. "producer") across production
// mobiles and crew, for when the producer's contact row uses a slightly
// different name than the Production Company field.
function findPhoneByRole(roleKeyword: string, data: CallSheetViewData): string {
  const kw = roleKeyword.toLowerCase();
  const pools: { role?: string; phone?: string }[] = [
    ...(data.productionMobiles || []),
    ...(data.crew || []),
  ];
  const hit = pools.find(
    (p) => (p.role || "").toLowerCase().includes(kw) && (p.phone || "").trim()
  );
  return hit ? (hit.phone || "").trim() : "";
}

// "Wed 8 Jul 2026" — short weekday + day + month + year. "" for a bad date.
function formatShootDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // Drop the comma some ICU builds insert after the weekday ("Wed, 8 Jul" →
  // "Wed 8 Jul") so it reads as one clean line.
  return d
    .toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    })
    .replace(/,/g, "");
}
