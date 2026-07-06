"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  Sun,
  Droplets,
  Newspaper,
  ExternalLink,
  RotateCw,
} from "lucide-react";

interface DayForecast {
  date: string;
  tempMin: number;
  tempMax: number;
  condition: string;
  description: string;
  icon: string;
  precip: number;
}

interface Brief {
  weather: {
    location: string;
    current: { temp: number; condition: string; description: string; icon: string };
    forecast: DayForecast[];
  } | null;
  weatherUnavailable: boolean;
  headlines: { title: string; link: string; source: string; publishedAt: string | null }[];
}

// Map OpenWeatherMap condition groups onto monochrome-friendly lucide icons.
function WeatherIcon({ condition, className }: { condition: string; className?: string }) {
  const c = condition.toLowerCase();
  if (c.includes("thunder")) return <CloudLightning className={className} />;
  if (c.includes("snow")) return <CloudSnow className={className} />;
  if (c.includes("drizzle")) return <CloudDrizzle className={className} />;
  if (c.includes("rain")) return <CloudRain className={className} />;
  if (c.includes("cloud")) return <Cloud className={className} />;
  if (c.includes("mist") || c.includes("fog") || c.includes("haze") || c.includes("smoke"))
    return <CloudFog className={className} />;
  return <Sun className={className} />;
}

function dayLabel(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short" });
}

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// Replaces the old Key Business Reminders card: London weather (current +
// 3-day forecast) plus the latest general UK/world headlines.
export function WeatherHeadlines() {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    setBrief(null);
    try {
      const r = await fetch("/api/dashboard/brief");
      if (!r.ok) throw new Error(String(r.status));
      setBrief((await r.json()) as Brief);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <h2 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
        Weather &amp; Headlines
      </h2>

      {/* Weather */}
      <div className="mt-3">
        {error || (brief && brief.weatherUnavailable) ? (
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Weather unavailable — connect the OpenWeather key to enable it.
          </p>
        ) : !brief ? (
          <div className="h-20 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
        ) : (
          brief.weather && (
            <>
              <div className="flex items-center gap-3">
                <WeatherIcon
                  condition={brief.weather.current.condition}
                  className="h-9 w-9 text-[#9C7C2E] dark:text-[#C9A44A]"
                />
                <div className="min-w-0">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {brief.weather.current.temp}°
                    </span>
                    <span className="truncate text-xs capitalize text-gray-500 dark:text-gray-400">
                      {brief.weather.current.description}
                    </span>
                  </div>
                  <span className="text-[11px] text-gray-400 dark:text-gray-500">{brief.weather.location}</span>
                </div>
              </div>
              {brief.weather.forecast.length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {brief.weather.forecast.map((d) => (
                    <div
                      key={d.date}
                      className="rounded-lg border border-gray-100 bg-gray-50 px-2 py-2 text-center dark:border-gray-800 dark:bg-gray-800"
                    >
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                        {dayLabel(d.date)}
                      </div>
                      <WeatherIcon
                        condition={d.condition}
                        className="mx-auto my-1 h-4 w-4 text-gray-500 dark:text-gray-400"
                      />
                      <div className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                        {d.tempMax}° <span className="font-normal text-gray-400 dark:text-gray-500">{d.tempMin}°</span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-center gap-0.5 text-[10px] text-gray-400 dark:text-gray-500">
                        <Droplets className="h-2.5 w-2.5" /> {d.precip}%
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )
        )}
      </div>

      {/* Headlines */}
      <div className="mt-4 border-t border-gray-50 pt-3 dark:border-gray-800">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
          <Newspaper className="h-3 w-3" /> Headlines
        </div>
        {error ? (
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-xs text-red-600 dark:text-red-400">Couldn&apos;t load headlines.</p>
            <button
              onClick={load}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/30"
            >
              <RotateCw className="h-3 w-3" /> Retry
            </button>
          </div>
        ) : !brief ? (
          <div className="mt-2 space-y-2">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="h-4 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
            ))}
          </div>
        ) : brief.headlines.length === 0 ? (
          <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">Connect news feed — no headlines available.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {brief.headlines.map((h) => (
              <li key={h.link}>
                <a
                  href={h.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-1.5"
                >
                  <span className="min-w-0 flex-1 text-xs leading-snug text-gray-700 group-hover:text-gray-900 dark:text-gray-300 dark:group-hover:text-gray-100">
                    {h.title}
                  </span>
                  <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-gray-300 group-hover:text-gray-500 dark:text-gray-600 dark:group-hover:text-gray-400" />
                </a>
                <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-gray-400 dark:text-gray-500">
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                    {h.source}
                  </span>
                  {h.publishedAt && <span>{timeAgo(h.publishedAt)}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
