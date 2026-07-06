// Location & route planning utilities for production call sheets.
//
// Everything here is framework-agnostic and safe to import from both client
// components and server routes. Distances are estimated from coordinates using
// the Haversine formula (straight-line) with a detour factor to approximate
// real driving distance, and drive time from a London-average speed. This keeps
// the whole feature dependency-free — no paid routing API required — while
// still giving crews a useful "X miles · ~Y min" figure per leg.

// ── Tunable constants ──
// Straight-line → approximate on-road distance. London streets rarely let you
// drive the crow-flies line, so we pad the Haversine result.
const DETOUR_FACTOR = 1.4;
// Average driving speed across a London shoot day (traffic, lights, parking).
const AVG_SPEED_KMH = 25;
const KM_PER_MILE = 1.60934;

// A minimal geographic point. `CallSheetLocation` is structurally compatible,
// so callers can pass their location objects straight through.
export interface GeoPoint {
  name?: string;
  address?: string;
  postcode?: string;
  lat: number | null;
  lng: number | null;
}

// A minimal schedule row. `ScheduleItem` is structurally compatible.
export interface RouteScheduleItem {
  time: string; // "HH:mm"
  description?: string;
  notes?: string;
  locationRef?: string; // name of the location this block happens at
}

// A driving leg between two consecutive located stops.
export interface RouteLeg {
  fromIndex: number;
  toIndex: number;
  fromName: string;
  toName: string;
  distanceKm: number; // approximate road distance
  driveMins: number; // estimated driving time
}

// Overall journey summary shown at the top of the movement order.
export interface JourneyStats {
  stopCount: number;
  totalKm: number;
  totalMiles: number;
  totalMins: number;
}

// ── Distance & time maths ──

// Great-circle distance between two points, in kilometres (straight line).
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth radius in km
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Pad a straight-line distance to approximate the actual road distance.
export function estimateRoadKm(straightKm: number): number {
  return straightKm * DETOUR_FACTOR;
}

// Rough drive time (minutes) for a given road distance, at London speeds.
export function estimateDriveTime(roadKm: number): number {
  return Math.max(1, Math.round((roadKm / AVG_SPEED_KMH) * 60));
}

export function kmToMiles(km: number): number {
  return km / KM_PER_MILE;
}

// "12 miles" / "0.4 miles" / "800 m" for very short hops.
export function formatDistance(roadKm: number): string {
  const miles = kmToMiles(roadKm);
  if (miles < 0.1) {
    const metres = Math.round(roadKm * 1000);
    return `${metres} m`;
  }
  if (miles < 10) return `${miles.toFixed(1)} miles`;
  return `${Math.round(miles)} miles`;
}

// "~25 min" / "~1 hr 15 min" / "~2 hr".
export function formatDuration(mins: number): string {
  const m = Math.max(1, Math.round(mins));
  if (m < 60) return `~${m} min`;
  const hrs = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `~${hrs} hr` : `~${hrs} hr ${rem} min`;
}

// Compact combined label, e.g. "12 miles · ~25 min drive".
export function formatLegLabel(leg: RouteLeg): string {
  return `${formatDistance(leg.distanceKm)} · ${formatDuration(leg.driveMins)} drive`;
}

// ── Time-of-day helpers (schedule integration) ──

// "HH:mm" → minutes since midnight, or null if unparseable.
export function parseTime(hhmm: string | undefined | null): number | null {
  if (!hhmm) return null;
  const m = String(hhmm).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

// minutes since midnight → "HH:mm" (wraps within a single day).
export function formatTime(minsSinceMidnight: number): string {
  const total = ((Math.round(minsSinceMidnight) % 1440) + 1440) % 1440;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ── Leg & journey computation ──

function hasCoords(p: GeoPoint): p is GeoPoint & { lat: number; lng: number } {
  return typeof p.lat === "number" && typeof p.lng === "number";
}

function displayName(p: GeoPoint, index: number): string {
  return (p.name || "").trim() || `Location ${index + 1}`;
}

// One leg between two located points, or null if either lacks coordinates.
export function computeLeg(
  from: GeoPoint,
  to: GeoPoint,
  fromIndex: number,
  toIndex: number
): RouteLeg | null {
  if (!hasCoords(from) || !hasCoords(to)) return null;
  const straight = haversineDistance(from.lat, from.lng, to.lat, to.lng);
  const roadKm = estimateRoadKm(straight);
  return {
    fromIndex,
    toIndex,
    fromName: displayName(from, fromIndex),
    toName: displayName(to, toIndex),
    distanceKm: roadKm,
    driveMins: estimateDriveTime(roadKm),
  };
}

// Legs between every consecutive pair of stops. The array is index-aligned to
// the gaps, so `legs[i]` is the drive from `locations[i]` to `locations[i+1]`
// (or null when either endpoint isn't geocoded yet).
export function computeRouteLegs(locations: GeoPoint[]): (RouteLeg | null)[] {
  const legs: (RouteLeg | null)[] = [];
  for (let i = 0; i < locations.length - 1; i++) {
    legs.push(computeLeg(locations[i], locations[i + 1], i, i + 1));
  }
  return legs;
}

// Totals across every computable leg. Skips gaps where coordinates are missing.
export function journeyStats(locations: GeoPoint[]): JourneyStats {
  const legs = computeRouteLegs(locations).filter((l): l is RouteLeg => l != null);
  const totalKm = legs.reduce((sum, l) => sum + l.distanceKm, 0);
  const totalMins = legs.reduce((sum, l) => sum + l.driveMins, 0);
  return {
    stopCount: locations.length,
    totalKm,
    totalMiles: kmToMiles(totalKm),
    totalMins,
  };
}

// One-line journey summary, e.g. "4 locations · 23 miles total · ~1 hr 15 min driving".
export function formatJourneySummary(stats: JourneyStats): string {
  const parts = [`${stats.stopCount} location${stats.stopCount === 1 ? "" : "s"}`];
  if (stats.totalKm > 0) {
    parts.push(`${formatDistance(stats.totalKm)} total`);
    parts.push(`${formatDuration(stats.totalMins)} driving`);
  }
  return parts.join(" · ");
}

// ── Per-location deep links ──

// Prefer coordinates (unambiguous), fall back to the typed address/postcode.
function locationQuery(loc: GeoPoint): { coords: boolean; value: string } | null {
  if (hasCoords(loc)) {
    return { coords: true, value: `${loc.lat},${loc.lng}` };
  }
  const text = [loc.address, loc.postcode].filter(Boolean).join(", ").trim();
  if (!text) return null;
  return { coords: false, value: text };
}

export function googleMapsSearchUrl(loc: GeoPoint): string | null {
  const q = locationQuery(loc);
  if (!q) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q.value)}`;
}

export function wazeUrl(loc: GeoPoint): string | null {
  const q = locationQuery(loc);
  if (!q) return null;
  if (q.coords) return `https://waze.com/ul?ll=${encodeURIComponent(q.value)}&navigate=yes`;
  return `https://waze.com/ul?q=${encodeURIComponent(q.value)}&navigate=yes`;
}

export function appleMapsUrl(loc: GeoPoint): string | null {
  const q = locationQuery(loc);
  if (!q) return null;
  if (q.coords) return `https://maps.apple.com/?ll=${encodeURIComponent(q.value)}&q=${encodeURIComponent(loc.name || "Location")}`;
  return `https://maps.apple.com/?address=${encodeURIComponent(q.value)}`;
}

// Static OpenStreetMap tile preview for a single pinned location.
export function staticMapUrl(
  lat: number,
  lng: number,
  width = 300,
  height = 150,
  zoom = 15
): string {
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=${zoom}&size=${width}x${height}&markers=${lat},${lng},red-pushpin`;
}

// ── Multi-stop route links ──

// Turn one stop into a Google Maps directions waypoint (coords preferred).
function googleWaypoint(loc: GeoPoint): string | null {
  const q = locationQuery(loc);
  return q ? q.value : null;
}

// Full-day route with every located stop as an ordered waypoint. Returns null
// if fewer than two stops can be resolved.
export function buildGoogleMapsRouteUrl(locations: GeoPoint[]): string | null {
  const points = locations
    .map(googleWaypoint)
    .filter((p): p is string => p != null)
    .map((p) => encodeURIComponent(p));
  if (points.length < 2) return null;
  return `https://www.google.com/maps/dir/${points.join("/")}`;
}

// Waze only navigates to a single destination via URL, so we point it at the
// final stop of the day. Returns null if the last stop can't be resolved.
export function buildWazeRouteUrl(locations: GeoPoint[]): string | null {
  for (let i = locations.length - 1; i >= 0; i--) {
    const url = wazeUrl(locations[i]);
    if (url) return url;
  }
  return null;
}

// ── Downloadable route files ──

function escapeXml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// GPX 1.1 route + waypoints. Importable into most sat-nav / mapping apps.
export function buildGpx(locations: GeoPoint[], routeName = "Shoot route"): string {
  const located = locations.filter(hasCoords);
  const wpts = located
    .map(
      (l, i) =>
        `  <wpt lat="${l.lat}" lon="${l.lng}">\n    <name>${escapeXml(
          displayName(l, i)
        )}</name>${l.address ? `\n    <desc>${escapeXml(l.address)}</desc>` : ""}\n  </wpt>`
    )
    .join("\n");
  const rtepts = located
    .map(
      (l, i) =>
        `    <rtept lat="${l.lat}" lon="${l.lng}">\n      <name>${escapeXml(
          displayName(l, i)
        )}</name>\n    </rtept>`
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="OutlanderOS" xmlns="http://www.topografix.com/GPX/1/1">
${wpts}
  <rte>
    <name>${escapeXml(routeName)}</name>
${rtepts}
  </rte>
</gpx>`;
}

// KML with pins + an ordered LineString. Importable into Google Earth / My Maps.
export function buildKml(locations: GeoPoint[], routeName = "Shoot route"): string {
  const located = locations.filter(hasCoords);
  const placemarks = located
    .map(
      (l, i) =>
        `    <Placemark>\n      <name>${escapeXml(
          `${i + 1}. ${displayName(l, i)}`
        )}</name>${
          l.address ? `\n      <description>${escapeXml(l.address)}</description>` : ""
        }\n      <Point><coordinates>${l.lng},${l.lat},0</coordinates></Point>\n    </Placemark>`
    )
    .join("\n");
  const line = located.map((l) => `${l.lng},${l.lat},0`).join(" ");
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(routeName)}</name>
${placemarks}
    <Placemark>
      <name>${escapeXml(routeName)}</name>
      <LineString><tessellate>1</tessellate><coordinates>${line}</coordinates></LineString>
    </Placemark>
  </Document>
</kml>`;
}

// ── Geocoding (via our same-origin proxy, avoiding Nominatim CORS/UA rules) ──

export async function geocodeAddress(
  address: string
): Promise<{ lat: number; lng: number } | null> {
  const q = (address || "").trim();
  if (!q) return null;
  try {
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { lat?: number; lng?: number } | null;
    if (data && typeof data.lat === "number" && typeof data.lng === "number") {
      return { lat: data.lat, lng: data.lng };
    }
    return null;
  } catch {
    return null;
  }
}

// ── Movement order (locations ⨯ schedule) ──

export type MovementStepKind = "stop" | "travel";

export interface MovementStopStep {
  kind: "stop";
  index: number; // index into the locations array
  name: string;
  location: GeoPoint;
  arriveTime?: string; // "HH:mm" earliest scheduled block here, when known
  scheduleItems: RouteScheduleItem[]; // blocks that happen at this stop
}

export interface MovementTravelStep {
  kind: "travel";
  leg: RouteLeg;
  departTime?: string; // "HH:mm" — leave the previous stop
  arriveTime?: string; // "HH:mm" — reach the next stop
}

export type MovementStep = MovementStopStep | MovementTravelStep;

// Match a schedule row's locationRef to a location index (by name, loosely).
function matchLocationIndex(ref: string | undefined, locations: GeoPoint[]): number {
  if (!ref) return -1;
  const norm = ref.trim().toLowerCase();
  return locations.findIndex((l, i) => displayName(l, i).trim().toLowerCase() === norm);
}

// Build the movement order: an ordered list of stops with a travel block
// automatically inserted wherever consecutive stops are geocoded. When schedule
// blocks carry a `locationRef`, their times are used to work out arrival times
// and back-calculated departure times (so "be at B by 12:00, 20 min away" tells
// you to leave A by 11:40); otherwise the plain location sequence is used.
export function generateMovementOrder(
  locations: GeoPoint[],
  schedule: RouteScheduleItem[] = []
): MovementStep[] {
  if (locations.length === 0) return [];

  // Earliest scheduled time at each location index (from schedule locationRefs).
  const arrivalByIndex = new Map<number, number>();
  const itemsByIndex = new Map<number, RouteScheduleItem[]>();
  for (const item of schedule) {
    const idx = matchLocationIndex(item.locationRef, locations);
    if (idx < 0) continue;
    const list = itemsByIndex.get(idx) ?? [];
    list.push(item);
    itemsByIndex.set(idx, list);
    const t = parseTime(item.time);
    if (t != null) {
      const existing = arrivalByIndex.get(idx);
      if (existing == null || t < existing) arrivalByIndex.set(idx, t);
    }
  }

  const steps: MovementStep[] = [];
  for (let i = 0; i < locations.length; i++) {
    const arriveMins = arrivalByIndex.get(i);
    steps.push({
      kind: "stop",
      index: i,
      name: displayName(locations[i], i),
      location: locations[i],
      arriveTime: arriveMins != null ? formatTime(arriveMins) : undefined,
      scheduleItems: itemsByIndex.get(i) ?? [],
    });

    if (i < locations.length - 1) {
      const leg = computeLeg(locations[i], locations[i + 1], i, i + 1);
      if (leg) {
        // Prefer scheduling backwards from the next stop's known arrival time;
        // otherwise forwards from this stop's arrival time.
        const nextArrive = arrivalByIndex.get(i + 1);
        const thisArrive = arrivalByIndex.get(i);
        let departMins: number | undefined;
        let arriveMinsNext: number | undefined;
        if (nextArrive != null) {
          arriveMinsNext = nextArrive;
          departMins = nextArrive - leg.driveMins;
        } else if (thisArrive != null) {
          departMins = thisArrive;
          arriveMinsNext = thisArrive + leg.driveMins;
        }
        steps.push({
          kind: "travel",
          leg,
          departTime: departMins != null ? formatTime(departMins) : undefined,
          arriveTime: arriveMinsNext != null ? formatTime(arriveMinsNext) : undefined,
        });
      }
    }
  }
  return steps;
}

// Trigger a client-side download of a text file (GPX/KML). No-op on the server.
export function downloadTextFile(filename: string, content: string, mime: string): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
