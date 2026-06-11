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
} from "lucide-react";
import { format } from "date-fns";
import type { DailyForecast, WeatherData } from "./types";

function ConditionIcon({ condition, size = 22 }: { condition: string; size?: number }) {
  const c = condition.toLowerCase();
  const cls = "text-[#E24B4A]";
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
        highlight ? "border-[#E24B4A] bg-[#E24B4A]/5" : "border-gray-100 bg-gray-50/50"
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

export function WeatherDisplay({
  weatherData,
  shootDate,
}: {
  weatherData: WeatherData | null;
  shootDate: string;
}) {
  if (!weatherData || weatherData.forecast.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-3">
        Add location for weather forecast
      </p>
    );
  }
  return (
    <div className="flex gap-2.5">
      {weatherData.forecast.map((day) => (
        <DayCard key={day.date} day={day} highlight={day.date === shootDate} />
      ))}
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
          className="flex items-center gap-1.5 text-xs font-medium text-[#E24B4A] hover:text-[#C93D3C] transition-colors disabled:opacity-40"
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
