import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";

// Daily forecast shape returned to the client
interface DailyForecast {
  date: string; // YYYY-MM-DD
  tempMin: number;
  tempMax: number;
  condition: string; // e.g. "Rain", "Clouds", "Clear"
  description: string;
  icon: string; // OpenWeatherMap icon code
  wind: number; // m/s
  humidity: number; // %
}

// Hour-by-hour forecast slot returned to the client for the shoot day
interface HourlyForecast {
  time: string; // HH:mm local-ish (UTC from API)
  date: string; // YYYY-MM-DD
  temp: number;
  condition: string;
  description: string;
  icon: string;
  wind: number; // m/s
  windDeg: number; // degrees
  pop: number; // precipitation probability %
  humidity: number; // %
}

interface OwmEntry {
  dt: number;
  dt_txt?: string;
  main: { temp: number; temp_min: number; temp_max: number; humidity: number };
  weather: { main: string; description: string; icon: string }[];
  wind: { speed: number; deg?: number };
  pop?: number;
}

// Compass direction from wind bearing in degrees
function windDir(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

// OpenWeather key — falls back to the build-time key when the host env var is
// unset (some deploys don't have OPENWEATHER_API_KEY configured), so weather
// keeps working on shared/public call sheet links.
const OWM_KEY = process.env.OPENWEATHER_API_KEY || "025b0f097a9d5d086088f011ee0927c7";

export const GET = withAuth(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const date = searchParams.get("date"); // YYYY-MM-DD shoot date

  if (!lat || !lng) {
    return NextResponse.json(
      { error: "Missing coordinates", forecast: [] },
      { status: 400 }
    );
  }

  const apiKey = OWM_KEY;

  try {
    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${encodeURIComponent(
      lat
    )}&lon=${encodeURIComponent(lng)}&units=metric&appid=${apiKey}`;
    // Short revalidate so public links act as a near-live weather tracker.
    const res = await fetch(url, { next: { revalidate: 600 } });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Weather API error (${res.status})`, forecast: [], unavailable: true },
        { status: 200 }
      );
    }
    const data = (await res.json()) as { list?: OwmEntry[] };
    const list = data.list ?? [];

    // Group 3-hour entries by calendar day
    const byDay = new Map<string, OwmEntry[]>();
    for (const entry of list) {
      const day = new Date(entry.dt * 1000).toISOString().split("T")[0];
      const bucket = byDay.get(day) ?? [];
      bucket.push(entry);
      byDay.set(day, bucket);
    }

    const daily: DailyForecast[] = [];
    for (const [day, entries] of byDay) {
      const temps = entries.map((e) => e.main.temp);
      // Pick the condition from the entry closest to midday
      const midday = entries.reduce((best, e) => {
        const h = new Date(e.dt * 1000).getUTCHours();
        const bh = new Date(best.dt * 1000).getUTCHours();
        return Math.abs(h - 12) < Math.abs(bh - 12) ? e : best;
      }, entries[0]);
      const w = midday.weather[0];
      daily.push({
        date: day,
        tempMin: Math.round(Math.min(...temps)),
        tempMax: Math.round(Math.max(...temps)),
        condition: w?.main ?? "Unknown",
        description: w?.description ?? "",
        icon: w?.icon ?? "01d",
        wind: Math.round(midday.wind.speed),
        humidity: midday.main.humidity,
      });
    }
    daily.sort((a, b) => a.date.localeCompare(b.date));

    // Centre a 3-day window on the shoot date when present
    let forecast = daily;
    if (date) {
      const idx = daily.findIndex((d) => d.date >= date);
      if (idx >= 0) {
        const start = Math.max(0, idx - 1);
        forecast = daily.slice(start, start + 3);
      } else {
        forecast = daily.slice(-3);
      }
    } else {
      forecast = daily.slice(0, 3);
    }

    // Hour-by-hour (3-hourly from OWM) forecast for the shoot day. Falls back
    // to the first available day when the shoot date is out of the 5-day window.
    const targetDay =
      date && byDay.has(date)
        ? date
        : forecast[0]?.date ?? daily[0]?.date ?? null;
    const hourly: HourlyForecast[] = targetDay
      ? (byDay.get(targetDay) ?? [])
          .map((e) => {
            const d = new Date(e.dt * 1000);
            const w = e.weather[0];
            return {
              time: d.toISOString().substring(11, 16),
              date: d.toISOString().split("T")[0],
              temp: Math.round(e.main.temp),
              condition: w?.main ?? "Unknown",
              description: w?.description ?? "",
              icon: w?.icon ?? "01d",
              wind: Math.round(e.wind.speed),
              windDeg: e.wind.deg ?? 0,
              pop: Math.round((e.pop ?? 0) * 100),
              humidity: e.main.humidity,
            };
          })
          .sort((a, b) => a.time.localeCompare(b.time))
      : [];

    return NextResponse.json({
      forecast,
      hourly,
      hourlyDate: targetDay,
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json(
      { error: "An error occurred", forecast: [], unavailable: true },
      { status: 200 }
    );
  }
});
