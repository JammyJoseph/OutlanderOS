import type { CallSheetViewData } from "./CallSheetDocument";
import type { CallSheetLocation } from "./types";
import { resolveUnitCall, sortByRolePriority, sortSchedule } from "./types";

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

  // ── Call times — the shape of the day: unit call, departments, wrap ──
  // Individual people are not listed here; their call time lives against them
  // on the sheet. Sources often land on the same time, so we key by time and
  // the first label for a slot wins.
  const unitCall = resolveUnitCall(data.unitCallTime, data.callTime);
  const byTime = new Map<string, string>();
  const addTime = (time: string | undefined, label: string) => {
    const t = (time || "").trim();
    const l = label.trim();
    if (!t || !l) return;
    if (!byTime.has(t)) byTime.set(t, l);
  };
  addTime(unitCall, "Unit call");
  for (const row of data.callTimes || []) addTime(row.time, row.department);
  addTime(data.wrapTime, "Wrap");
  if (byTime.size) {
    const lines = [...byTime.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([time, label]) => `${time} ${label}`);
    blocks.push(`CALL TIMES\n${lines.join("\n")}`);
  }

  // ── Schedule — real location names (never "Location 1"), no call-time dupes ──
  const scheduleLines = sortSchedule(data.schedule || [])
    .filter((s) => s.time || s.description || s.locationRef)
    .map((s) => {
      const time = (s.time || "").trim();
      const locName = resolveScheduleLocation(s.locationRef, locations);
      const rawDesc = (s.description || "").trim();
      // A description that's just a "Location N" pointer becomes the real name.
      const desc = isGenericLocationLabel(rawDesc)
        ? resolveScheduleLocation(rawDesc, locations)
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

  // ── Locations — the real address, never the "Location N" placeholder ──
  const locationLines = locations.map(locationFull).filter(Boolean);
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
  // is no producer or agency contact at all. Crew are taken in production-
  // hierarchy order, so the most senior reachable person is chosen.
  if (contactLines.length === 0) {
    const fallback =
      (data.productionMobiles || []).find((m) => (m.phone || "").trim() && (m.name || "").trim()) ||
      sortByRolePriority(data.crew || []).find((m) => (m.phone || "").trim() && (m.name || "").trim());
    if (fallback) contactLines.push(`Contact: ${fallback.name.trim()} — ${fallback.phone.trim()}`);
  }
  if (contactLines.length) blocks.push(contactLines.join("\n"));

  blocks.push(`Full sheet: ${link || "[link]"}`);

  return blocks.join("\n\n");
}

// ── Location helpers ──────────────────────────────────────────────────────────
// The stored `name` is often just a generic "Location 1" / "Location 2" label,
// with the real address in `address` (and `postcode`). These helpers prefer the
// real address whenever the name is generic (or empty).

// True for empty names and the auto-generated "Location N" placeholders.
function isGenericLocationLabel(name: string | undefined): boolean {
  const n = (name || "").trim();
  return !n || /^location\s*\d+$/i.test(n);
}

// Full location label for the LOCATIONS list: the real address including the
// postcode, or "name, address" when the name is a genuine place name.
function locationFull(l: CallSheetLocation): string {
  const name = (l.name || "").trim();
  const address = (l.address || "").trim();
  const postcode = (l.postcode || "").trim();
  const generic = isGenericLocationLabel(name);
  // Main text: address when the name is a placeholder, else the place name
  // (with its address appended if we have one).
  let main = generic ? address : address ? `${name}, ${address}` : name;
  if (!main) main = address || postcode || name; // last resort
  // Make sure the postcode is present.
  if (postcode && !main.toLowerCase().includes(postcode.toLowerCase())) {
    main = main ? `${main}, ${postcode}` : postcode;
  }
  return main.trim();
}

// Concise location label for inline use in the schedule: the place name when
// it's real, otherwise the street address with any trailing postcode trimmed
// off (the postcode already appears in the LOCATIONS list).
function locationShort(l: CallSheetLocation): string {
  const name = (l.name || "").trim();
  const address = (l.address || "").trim();
  const postcode = (l.postcode || "").trim();
  if (!isGenericLocationLabel(name)) return name;
  if (address) {
    if (postcode && address.toLowerCase().endsWith(postcode.toLowerCase())) {
      const stripped = address.slice(0, address.length - postcode.length).replace(/[,\s]+$/, "").trim();
      return stripped || address;
    }
    return address;
  }
  return postcode || name;
}

// Resolve a schedule row's location reference (stored as the location's name,
// or a bare "Location N" pointer) to a concise, human location label.
function resolveScheduleLocation(ref: string | undefined, locations: CallSheetLocation[]): string {
  const r = (ref || "").trim();
  if (!r) return "";
  let loc = locations.find((l) => (l.name || "").trim().toLowerCase() === r.toLowerCase());
  if (!loc) {
    const m = r.match(/^location\s*(\d+)$/i);
    if (m) loc = locations[parseInt(m[1], 10) - 1];
  }
  if (loc) return locationShort(loc);
  return r; // not a location pointer — keep the literal text
}

// ── Contact helpers ───────────────────────────────────────────────────────────

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
