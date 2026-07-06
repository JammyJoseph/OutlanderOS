"use client";

import { useState } from "react";
import {
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudFog,
  CloudDrizzle,
  Loader2,
  RefreshCw,
  Wind,
  Droplets,
  Sunrise,
  Sunset,
  Camera,
  AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import type { DailyForecast, HourlyForecast, SunInfo, WeatherData, WeatherWarning } from "./types";

// Sunrise / sunset / golden-hour / UV strip for the shoot day (Phase 4C).
export function SunStrip({ sun }: { sun: SunInfo }) {
  const items: { icon: React.ReactNode; label: string; value: string }[] = [];
  if (sun.sunrise) items.push({ icon: <Sunrise size={14} />, label: "Sunrise", value: sun.sunrise });
  if (sun.sunset) items.push({ icon: <Sunset size={14} />, label: "Sunset", value: sun.sunset });
  if (sun.goldenHourAM)
    items.push({ icon: <Camera size={14} />, label: "Golden (AM)", value: sun.goldenHourAM });
  if (sun.goldenHourPM)
    items.push({ icon: <Camera size={14} />, label: "Golden (PM)", value: sun.goldenHourPM });
  items.push({ icon: <Sun size={14} />, label: "UV (max)", value: `${sun.uvIndex}` });
  if (items.length === 0) return null;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
      {items.map((it) => (
        <div
          key={it.label}
          className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40 px-3 py-2 text-center"
        >
          <p className="flex items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            <span className="text-[#A93B2E]">{it.icon}</span> {it.label}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
            {it.value}
          </p>
        </div>
      ))}
    </div>
  );
}

export function WeatherWarnings({ warnings }: { warnings: WeatherWarning[] }) {
  if (!warnings || warnings.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {warnings.map((w, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1.5 rounded-full bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 px-3 py-1 text-xs font-medium text-red-700 dark:text-red-300"
        >
          <AlertTriangle size={12} /> {w.label}
        </span>
      ))}
    </div>
  );
}

// Compact temperature + rain-probability timeline bar for the shoot day.
export function TimelineBar({ hourly }: { hourly: HourlyForecast[] }) {
  if (!hourly || hourly.length === 0) return null;
  const temps = hourly.map((h) => h.temp);
  const min = Math.min(...temps);
  const max = Math.max(...temps);
  const span = Math.max(1, max - min);
  return (
    <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-800/30 p-3">
      <div className="flex items-end gap-1 h-20">
        {hourly.map((h) => {
          const tempPct = ((h.temp - min) / span) * 100;
          return (
            <div key={h.time} className="flex-1 flex flex-col items-center justify-end h-full">
              {/* rain probability (blue) behind temp marker */}
              <div className="relative w-full flex-1 flex items-end">
                <div
                  className="w-full rounded-t bg-blue-200/70 dark:bg-blue-500/30"
                  style={{ height: `${h.pop}%` }}
                  title={`${h.pop}% rain`}
                />
                <div
                  className="absolute left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#A93B2E]"
                  style={{ bottom: `${tempPct}%` }}
                  title={`${h.temp}°`}
                />
              </div>
              <span className="mt-1 text-[8px] text-gray-400 tabular-nums">
                {h.time.slice(0, 2)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex items-center gap-3 text-[10px] text-gray-400">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#A93B2E]" /> Temp {min}°–{max}°
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-blue-300 dark:bg-blue-500/50" /> Rain %
        </span>
      </div>
    </div>
  );
}

function windDir(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

function ConditionIcon({ condition, size = 22 }: { condition: string; size?: number }) {
  const c = condition.toLowerCase();
  const cls = "text-[#A93B2E]";
  if (c.includes("thunder")) return <CloudLightning size={size} className={cls} />;
  if (c.includes("drizzle")) return <CloudDrizzle size={size} className={cls} />;
  if (c.includes("rain")) return <CloudRain size={size} className={cls} />;
  if (c.includes("snow")) return <CloudSnow size={size} className={cls} />;
  if (c.includes("cloud")) return <Cloud size={size} className={cls} />;
  if (c.includes("clear")) return <Sun size={size} className={cls} />;
  if (["mist", "fog", "haze", "smoke"].some((k) => c.includes(k)))
    return <CloudFog size={size} className={cls} />;
  return <Cloud size={size} className={cls} />;
}

function DayCard({ day, highlight }: { day: DailyForecast; highlight: boolean }) {
  return (
    <div
      className={`flex-1 rounded-xl border p-3 text-center ${
        highlight ? "border-[#A93B2E] bg-[#A93B2E]/5" : "border-gray-100 bg-gray-50/50"
      }`}
    >
      <p className="text-xs font-semibold text-gray-500">
        {format(new Date(day.date + "T12:00:00"), "EEE d")}
      </p>
      <div className="flex justify-center my-1.5">
        <ConditionIcon condition={day.condition} />
      </div>
      <p className="text-sm font-semibold text-gray-900">
        {day.tempMax}° <span className="text-gray-400 font-normal">{day.tempMin}°</span>
      </p>
      <p className="text-xs text-gray-500 capitalize mt-0.5">{day.description}</p>
      <div className="flex items-center justify-center gap-2.5 mt-1.5 text-xs text-gray-400">
        <span className="flex items-center gap-0.5">
          <Wind size={11} /> {day.wind}m/s
        </span>
        <span className="flex items-center gap-0.5">
          <Droplets size={11} /> {day.humidity}%
        </span>
      </div>
    </div>
  );
}

// Hour-by-hour timeline for the shoot day. Shoot hours (first call → wrap) are
// highlighted in the accent colour.
export function HourlyTimeline({
  hourly,
  callTime,
  wrapTime,
}: {
  hourly: HourlyForecast[];
  callTime?: string;
  wrapTime?: string;
}) {
  if (!hourly || hourly.length === 0) return null;
  const start = callTime || "";
  const end = wrapTime || "";
  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <div className="flex gap-2 min-w-min">
        {hourly.map((h) => {
          const inShoot = !!start && h.time >= start && (!end || h.time <= end);
          return (
            <div
              key={h.time}
              className={`flex-shrink-0 w-[78px] rounded-xl border p-2 text-center ${
                inShoot ? "border-[#A93B2E] bg-[#A93B2E]/5" : "border-gray-100 bg-gray-50/50"
              }`}
            >
              <p className={`text-xs font-bold ${inShoot ? "text-[#A93B2E]" : "text-gray-600"}`}>
                {h.time}
              </p>
              <div className="flex justify-center my-1">
                <ConditionIcon condition={h.condition} size={18} />
              </div>
              <p className="text-sm font-semibold text-gray-900">{h.temp}°</p>
              <p className="text-[10px] text-gray-400 capitalize leading-tight mt-0.5 truncate">
                {h.description}
              </p>
              <div className="mt-1 space-y-0.5 text-[10px] text-gray-500">
                <p className="flex items-center justify-center gap-0.5">
                  <Wind size={9} /> {h.wind} {windDir(h.windDeg)}
                </p>
                <p className="flex items-center justify-center gap-0.5">
                  <CloudRain size={9} /> {h.pop}%
                </p>
                <p className="flex items-center justify-center gap-0.5">
                  <Droplets size={9} /> {h.humidity}%
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function WeatherDisplay({
  weatherData,
  shootDate,
  callTime,
  wrapTime,
}: {
  weatherData: WeatherData | null;
  shootDate: string;
  callTime?: string;
  wrapTime?: string;
}) {
  if (!weatherData || weatherData.forecast.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-3">
        Add location for weather forecast
      </p>
    );
  }
  const hourly = weatherData.hourly ?? [];
  const sun = weatherData.sun ?? null;
  const warnings = weatherData.warnings ?? [];
  return (
    <div className="space-y-3">
      {warnings.length > 0 && <WeatherWarnings warnings={warnings} />}
      <div className="flex gap-2.5">
        {weatherData.forecast.map((day) => (
          <DayCard key={day.date} day={day} highlight={day.date === shootDate} />
        ))}
      </div>
      {sun && <SunStrip sun={sun} />}
      {hourly.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">
            Shoot day — temperature &amp; rain
          </p>
          <TimelineBar hourly={hourly} />
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 pt-1">
            Hourly breakdown
          </p>
          <HourlyTimeline hourly={hourly} callTime={callTime} wrapTime={wrapTime} />
        </div>
      )}
    </div>
  );
}

export function WeatherEditor({
  lat,
  lng,
  shootDate,
  weatherData,
  setWeatherData,
}: {
  lat: number | null;
  lng: number | null;
  shootDate: string;
  weatherData: WeatherData | null;
  setWeatherData: (v: WeatherData | null) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const hasLocation = lat != null && lng != null;
  // The forecast was fetched around a different shoot date — prompt a refresh.
  const stale =
    !!weatherData &&
    weatherData.forecast.length > 0 &&
    !!shootDate &&
    !weatherData.forecast.some((d) => d.date === shootDate);

  async function fetchForecast() {
    if (!hasLocation) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(
        `/api/weather?lat=${lat}&lng=${lng}&date=${encodeURIComponent(shootDate)}`
      );
      const data = await res.json();
      if (data.unavailable || !data.forecast?.length) {
        setMessage(
          data.error
            ? "Forecast unavailable — only the next 5 days can be forecast."
            : "No forecast available for this date."
        );
        return;
      }
      setWeatherData({
        forecast: data.forecast,
        hourly: data.hourly ?? [],
        hourlyDate: data.hourlyDate ?? shootDate,
        sun: data.sun ?? null,
        warnings: data.warnings ?? [],
        fetchedAt: data.fetchedAt ?? new Date().toISOString(),
        lat: lat!,
        lng: lng!,
      });
    } catch {
      setMessage("Could not fetch the forecast.");
    } finally {
      setLoading(false);
    }
  }

  if (!hasLocation) {
    return (
      <p className="text-sm text-gray-400 text-center py-3">
        Add location for weather forecast
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">
          {weatherData?.fetchedAt
            ? `Updated ${format(new Date(weatherData.fetchedAt), "d MMM, HH:mm")}`
            : "3-day forecast around the shoot date"}
        </p>
        <button
          onClick={fetchForecast}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs font-medium text-[#A93B2E] hover:text-[#A93B2E] transition-colors disabled:opacity-40"
        >
          {loading ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <RefreshCw size={13} />
          )}
          {weatherData ? "Refresh" : "Fetch forecast"}
        </button>
      </div>
      {stale && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-amber-50 border border-amber-100 px-3.5 py-2.5">
          <p className="text-xs text-amber-700 font-medium">
            The shoot date changed since this forecast was fetched.
          </p>
          <button
            onClick={fetchForecast}
            disabled={loading}
            className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-amber-800 hover:text-amber-900 disabled:opacity-40"
          >
            <RefreshCw size={12} /> Refresh weather
          </button>
        </div>
      )}
      {message && <p className="text-xs text-amber-600">{message}</p>}
      {weatherData && (
        <WeatherDisplay weatherData={weatherData} shootDate={shootDate} />
      )}
    </div>
  );
}
