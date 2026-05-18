import { NextRequest, NextResponse } from "next/server";

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

interface OwmEntry {
  dt: number;
  main: { temp: number; temp_min: number; temp_max: number; humidity: number };
  weather: { main: string; description: string; icon: string }[];
  wind: { speed: number };
}

export async function GET(request: NextRequest) {
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

  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Weather service not configured", forecast: [], unavailable: true },
      { status: 200 }
    );
  }

  try {
    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${encodeURIComponent(
      lat
    )}&lon=${encodeURIComponent(lng)}&units=metric&appid=${apiKey}`;
    const res = await fetch(url, { next: { revalidate: 1800 } });
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

    return NextResponse.json({ forecast, fetchedAt: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json(
      { error: String(e), forecast: [], unavailable: true },
      { status: 200 }
    );
  }
}
