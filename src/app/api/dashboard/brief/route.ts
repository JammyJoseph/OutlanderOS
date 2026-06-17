import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// London — hardcoded for now; can be made per-user later.
const LONDON = { lat: 51.5074, lon: -0.1278, name: "London" };
const BBC_RSS = "https://feeds.bbci.co.uk/news/rss.xml";

interface DayForecast {
  date: string; // YYYY-MM-DD
  tempMin: number;
  tempMax: number;
  condition: string;
  description: string;
  icon: string;
  precip: number; // % chance
}

interface Headline {
  title: string;
  link: string;
  source: string;
  publishedAt: string | null;
}

interface OwmForecastEntry {
  dt: number;
  main: { temp: number; temp_min: number; temp_max: number };
  weather: { main: string; description: string; icon: string }[];
  pop?: number;
}

async function getWeather(apiKey: string) {
  const base = "https://api.openweathermap.org/data/2.5";
  const q = `lat=${LONDON.lat}&lon=${LONDON.lon}&units=metric&appid=${apiKey}`;
  const [curRes, fcRes] = await Promise.all([
    fetch(`${base}/weather?${q}`, { next: { revalidate: 1800 } }),
    fetch(`${base}/forecast?${q}`, { next: { revalidate: 1800 } }),
  ]);
  if (!curRes.ok || !fcRes.ok) throw new Error("weather upstream error");

  const cur = (await curRes.json()) as {
    main: { temp: number };
    weather: { main: string; description: string; icon: string }[];
  };
  const fc = (await fcRes.json()) as { list?: OwmForecastEntry[] };

  const current = {
    temp: Math.round(cur.main.temp),
    condition: cur.weather?.[0]?.main ?? "Unknown",
    description: cur.weather?.[0]?.description ?? "",
    icon: cur.weather?.[0]?.icon ?? "01d",
  };

  // Group 3-hour entries by calendar day.
  const byDay = new Map<string, OwmForecastEntry[]>();
  for (const e of fc.list ?? []) {
    const day = new Date(e.dt * 1000).toISOString().split("T")[0];
    const bucket = byDay.get(day) ?? [];
    bucket.push(e);
    byDay.set(day, bucket);
  }

  const today = new Date().toISOString().split("T")[0];
  const forecast: DayForecast[] = [];
  for (const [day, entries] of [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (day <= today) continue; // next 3 days only
    const temps = entries.map((e) => e.main.temp);
    const midday = entries.reduce((best, e) => {
      const h = new Date(e.dt * 1000).getUTCHours();
      const bh = new Date(best.dt * 1000).getUTCHours();
      return Math.abs(h - 12) < Math.abs(bh - 12) ? e : best;
    }, entries[0]);
    const w = midday.weather?.[0];
    forecast.push({
      date: day,
      tempMin: Math.round(Math.min(...temps)),
      tempMax: Math.round(Math.max(...temps)),
      condition: w?.main ?? "Unknown",
      description: w?.description ?? "",
      icon: w?.icon ?? "01d",
      precip: Math.round(Math.max(...entries.map((e) => e.pop ?? 0)) * 100),
    });
    if (forecast.length >= 3) break;
  }

  return { location: LONDON.name, current, forecast };
}

function unescapeXml(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .trim();
}

async function getHeadlines(): Promise<Headline[]> {
  const res = await fetch(BBC_RSS, { next: { revalidate: 900 } });
  if (!res.ok) throw new Error("news upstream error");
  const xml = await res.text();

  const headlines: Headline[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) && headlines.length < 4) {
    const block = m[1];
    const title = block.match(/<title>([\s\S]*?)<\/title>/)?.[1];
    const link = block.match(/<link>([\s\S]*?)<\/link>/)?.[1];
    const pub = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1];
    if (!title) continue;
    headlines.push({
      title: unescapeXml(title),
      link: link ? unescapeXml(link) : "https://www.bbc.co.uk/news",
      source: "BBC News",
      publishedAt: pub ? new Date(unescapeXml(pub)).toISOString() : null,
    });
  }
  return headlines;
}

// GET /api/dashboard/brief — London weather (current + 3-day forecast) and the
// latest general UK/world headlines for the "Weather & Headlines" widget.
export const GET = withAuth(async () => {
  const apiKey = process.env.OPENWEATHER_API_KEY;

  const [weather, headlines] = await Promise.all([
    apiKey
      ? getWeather(apiKey).catch((e) => {
          console.error("brief weather", e);
          return null;
        })
      : Promise.resolve(null),
    getHeadlines().catch((e) => {
      console.error("brief headlines", e);
      return [];
    }),
  ]);

  return NextResponse.json({
    weather, // null when unavailable / not configured
    weatherUnavailable: !weather,
    headlines,
    fetchedAt: new Date().toISOString(),
  });
});
