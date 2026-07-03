// Lightweight solar calculations for call-sheet weather (Phase 4C).
//
// Computes sunrise/sunset, golden-hour windows and an approximate clear-sky UV
// index from latitude/longitude/date alone — no external API or paid OneCall
// subscription required. Times are returned as HH:mm in UTC to line up with the
// OpenWeather 3-hourly forecast slots (which the widget already renders in UTC).

const DEG = Math.PI / 180;

export interface SunInfo {
  sunrise: string | null; // HH:mm UTC (null if polar day/night)
  sunset: string | null; // HH:mm UTC
  goldenHourAM: string | null; // "HH:mm–HH:mm" just after sunrise
  goldenHourPM: string | null; // "HH:mm–HH:mm" just before sunset
  uvIndex: number; // approximate clear-sky max UV index (0–11+)
}

function fmt(minutesUTC: number): string {
  let m = ((minutesUTC % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  m = m % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function addWindow(startMin: number, endMin: number): string {
  return `${fmt(startMin)}–${fmt(endMin)}`;
}

// Days since J2000.0 for a given UTC calendar date (midday).
function daysSinceJ2000(year: number, month: number, day: number): number {
  const utc = Date.UTC(year, month - 1, day, 12, 0, 0);
  return utc / 86400000 - 10957.5; // 10957.5 days from 1970-01-01 to 2000-01-01 12:00
}

// Solar declination + equation of time (minutes) via a compact NOAA-style model.
function solarPosition(n: number): { declination: number; eqTime: number } {
  // Mean solar anomaly
  const g = (357.529 + 0.98560028 * n) * DEG;
  // Mean longitude
  const q = (280.459 + 0.98564736 * n) * DEG;
  // Geocentric apparent ecliptic longitude
  const L = q + (1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * DEG;
  // Obliquity of the ecliptic
  const e = (23.439 - 0.00000036 * n) * DEG;
  const declination = Math.asin(Math.sin(e) * Math.sin(L));
  // Equation of time (minutes)
  const RA = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  let eqTime = (q - RA) / DEG; // degrees
  // normalise to [-180,180]
  eqTime = ((eqTime + 180) % 360) - 180;
  eqTime = eqTime * 4; // degrees → minutes
  return { declination, eqTime };
}

// Approximate clear-sky max UV index from the noon solar elevation angle.
// UVI ≈ 12.5·(sin β)^2.4 at sea level clear sky, capped at 11. `cloudFactor`
// (0..1, where 1 = clear) attenuates it for overcast conditions.
function approxUv(latDeg: number, declination: number, cloudFactor: number): number {
  const lat = latDeg * DEG;
  // Elevation at solar noon: 90° − |lat − declination|
  const noonZenith = Math.abs(lat - declination);
  const elevation = Math.PI / 2 - noonZenith;
  const s = Math.sin(elevation);
  if (s <= 0) return 0;
  const clear = 12.5 * Math.pow(s, 2.4);
  return Math.max(0, Math.min(11, Math.round(clear * cloudFactor)));
}

// dateISO: "YYYY-MM-DD". cloudFactor 0..1 (default clear sky).
export function computeSun(
  lat: number,
  lng: number,
  dateISO: string,
  cloudFactor = 1
): SunInfo {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateISO || "");
  if (!m) {
    return { sunrise: null, sunset: null, goldenHourAM: null, goldenHourPM: null, uvIndex: 0 };
  }
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const n = daysSinceJ2000(year, month, day);
  const { declination, eqTime } = solarPosition(n);

  const latRad = lat * DEG;
  // Hour angle for sunrise/sunset (standard −0.833° for atmospheric refraction)
  const zenith = 90.833 * DEG;
  const cosH =
    (Math.cos(zenith) - Math.sin(latRad) * Math.sin(declination)) /
    (Math.cos(latRad) * Math.cos(declination));

  const uvIndex = approxUv(lat, declination, cloudFactor);

  if (cosH > 1 || cosH < -1) {
    // Polar night (cosH>1) or polar day (cosH<-1)
    return { sunrise: null, sunset: null, goldenHourAM: null, goldenHourPM: null, uvIndex };
  }

  const H = Math.acos(cosH) / DEG; // degrees
  // Solar noon in UTC minutes: 720 − 4·longitude − eqTime
  const noonMin = 720 - 4 * lng - eqTime;
  const sunriseMin = Math.round(noonMin - 4 * H);
  const sunsetMin = Math.round(noonMin + 4 * H);

  return {
    sunrise: fmt(sunriseMin),
    sunset: fmt(sunsetMin),
    goldenHourAM: addWindow(sunriseMin, sunriseMin + 60),
    goldenHourPM: addWindow(sunsetMin - 60, sunsetMin),
    uvIndex,
  };
}

export interface WeatherWarning {
  kind: "rain" | "wind" | "cold" | "heat";
  label: string;
}

// m/s → mph
export function msToMph(ms: number): number {
  return Math.round(ms * 2.23694);
}

// Build shoot-day warnings from hourly slots (Phase 4C): rain >50%, wind >20mph,
// extreme temps (<2°C or >30°C). `hours` are the shoot day's hourly slots.
export function buildWarnings(
  hours: { pop: number; wind: number; temp: number }[]
): WeatherWarning[] {
  const out: WeatherWarning[] = [];
  if (!hours.length) return out;
  const maxPop = Math.max(...hours.map((h) => h.pop));
  const maxWindMph = Math.max(...hours.map((h) => msToMph(h.wind)));
  const minTemp = Math.min(...hours.map((h) => h.temp));
  const maxTemp = Math.max(...hours.map((h) => h.temp));
  if (maxPop > 50) out.push({ kind: "rain", label: `Rain likely — up to ${maxPop}% chance` });
  if (maxWindMph > 20) out.push({ kind: "wind", label: `High wind — gusts to ${maxWindMph} mph` });
  if (minTemp < 2) out.push({ kind: "cold", label: `Cold — down to ${minTemp}°C` });
  if (maxTemp > 30) out.push({ kind: "heat", label: `Heat — up to ${maxTemp}°C` });
  return out;
}
