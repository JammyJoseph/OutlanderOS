import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { computeSun, buildWarnings } from "@/lib/sun-calc";

// Public, token-gated live weather for shared call sheets. The token (internal
// or client share token) scopes the request to a single published sheet's
// location, so no login is required and arbitrary coords can't be queried.
// This makes the shared link a live weather tracker for the shoot location.

interface OwmEntry {
  dt: number;
  main: { temp: number; humidity: number };
  weather: { main: string; description: string; icon: string }[];
  wind: { speed: number; deg?: number };
  pop?: number;
}

const OWM_KEY = process.env.OPENWEATHER_API_KEY || "025b0f097a9d5d086088f011ee0927c7";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token", forecast: [], hourly: [] }, { status: 400 });
  }

  const sheet = await prisma.callSheet.findFirst({
    where: { OR: [{ shareToken: token }, { clientShareToken: token }], status: "PUBLISHED" },
    select: { locationLat: true, locationLng: true, shootDate: true },
  });
  if (!sheet || sheet.locationLat == null || sheet.locationLng == null) {
    return NextResponse.json({ forecast: [], hourly: [], unavailable: true }, { status: 200 });
  }

  const date = sheet.shootDate.toISOString().split("T")[0];

  try {
    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${sheet.locationLat}&lon=${sheet.locationLng}&units=metric&appid=${OWM_KEY}`;
    // Fetch fresh each load (short revalidate) so the link tracks live weather.
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) {
      return NextResponse.json({ forecast: [], hourly: [], unavailable: true }, { status: 200 });
    }
    const data = (await res.json()) as { list?: OwmEntry[] };
    const list = data.list ?? [];

    const byDay = new Map<string, OwmEntry[]>();
    for (const e of list) {
      const day = new Date(e.dt * 1000).toISOString().split("T")[0];
      const bucket = byDay.get(day) ?? [];
      bucket.push(e);
      byDay.set(day, bucket);
    }

    const daily = Array.from(byDay.entries())
      .map(([day, entries]) => {
        const temps = entries.map((e) => e.main.temp);
        const midday = entries.reduce((best, e) => {
          const h = new Date(e.dt * 1000).getUTCHours();
          const bh = new Date(best.dt * 1000).getUTCHours();
          return Math.abs(h - 12) < Math.abs(bh - 12) ? e : best;
        }, entries[0]);
        const w = midday.weather[0];
        return {
          date: day,
          tempMin: Math.round(Math.min(...temps)),
          tempMax: Math.round(Math.max(...temps)),
          condition: w?.main ?? "Unknown",
          description: w?.description ?? "",
          icon: w?.icon ?? "01d",
          wind: Math.round(midday.wind.speed),
          humidity: midday.main.humidity,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    const idx = daily.findIndex((d) => d.date >= date);
    const forecast =
      idx >= 0 ? daily.slice(Math.max(0, idx - 1), Math.max(0, idx - 1) + 3) : daily.slice(0, 3);

    const targetDay = byDay.has(date) ? date : forecast[0]?.date ?? daily[0]?.date ?? null;
    const hourly = targetDay
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

    const dayForSun = targetDay ?? forecast[0]?.date ?? null;
    const cond = (forecast.find((d) => d.date === dayForSun)?.condition ?? "").toLowerCase();
    const cloudFactor = cond.includes("clear")
      ? 1
      : cond.includes("cloud")
        ? 0.65
        : cond.includes("rain") || cond.includes("snow") || cond.includes("thunder")
          ? 0.4
          : 0.8;
    const sun =
      dayForSun && sheet.locationLat != null && sheet.locationLng != null
        ? computeSun(sheet.locationLat, sheet.locationLng, dayForSun, cloudFactor)
        : null;
    const warnings = buildWarnings(hourly.map((h) => ({ pop: h.pop, wind: h.wind, temp: h.temp })));

    return NextResponse.json({ forecast, hourly, hourlyDate: targetDay, sun, warnings, fetchedAt: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ error: "An error occurred", forecast: [], hourly: [], unavailable: true }, { status: 200 });
  }
}
