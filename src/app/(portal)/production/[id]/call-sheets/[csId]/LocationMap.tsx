"use client";

import { useState } from "react";
import { MapPin, Loader2, Search } from "lucide-react";
import type { LocationData } from "./types";
import { inputCls, labelCls } from "./shared";

export async function geocodeAddress(
  address: string
): Promise<{ lat: number; lng: number } | null> {
  const q = address.trim();
  if (!q) return null;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
      { headers: { Accept: "application/json" } }
    );
    if (!res.ok) return null;
    const results = (await res.json()) as { lat: string; lon: string }[];
    if (!results.length) return null;
    return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
  } catch {
    return null;
  }
}

export function LocationMap({
  lat,
  lng,
  height = 300,
}: {
  lat: number | null;
  lng: number | null;
  height?: number;
}) {
  if (lat == null || lng == null) {
    return (
      <div
        className="rounded-xl border border-dashed border-gray-200 bg-gray-50 flex items-center justify-center text-center"
        style={{ height }}
      >
        <div className="text-gray-400">
          <MapPin size={20} className="mx-auto mb-1.5" />
          <p className="text-sm">Add location for map</p>
        </div>
      </div>
    );
  }

  const d = 0.012;
  const bbox = `${lng - d},${lat - d},${lng + d},${lat + d}`;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;

  return (
    <div className="rounded-xl overflow-hidden border border-gray-200">
      <iframe
        title="Shoot location map"
        src={src}
        width="100%"
        height={height}
        style={{ border: 0 }}
        loading="lazy"
      />
    </div>
  );
}

export function LocationEditor({
  location,
  setLocation,
  lat,
  lng,
  onCoordsChange,
}: {
  location: LocationData;
  setLocation: (v: LocationData) => void;
  lat: number | null;
  lng: number | null;
  onCoordsChange: (lat: number | null, lng: number | null) => void;
}) {
  const [locating, setLocating] = useState(false);
  const [notFound, setNotFound] = useState(false);

  async function findOnMap() {
    setNotFound(false);
    setLocating(true);
    const coords = await geocodeAddress(location.address);
    setLocating(false);
    if (coords) {
      onCoordsChange(coords.lat, coords.lng);
    } else {
      setNotFound(true);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>Address</label>
        <textarea
          value={location.address}
          onChange={(e) => setLocation({ ...location, address: e.target.value })}
          placeholder="Full address"
          rows={2}
          className={`${inputCls} resize-none`}
        />
        <div className="flex items-center gap-3 mt-2">
          <button
            onClick={findOnMap}
            disabled={locating || !location.address.trim()}
            className="flex items-center gap-1.5 text-xs font-medium text-[#D4A853] hover:text-[#c49843] transition-colors disabled:opacity-40"
          >
            {locating ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
            Find on map
          </button>
          {lat != null && lng != null && (
            <span className="text-xs text-emerald-600">
              Pinned ({lat.toFixed(4)}, {lng.toFixed(4)})
            </span>
          )}
          {notFound && (
            <span className="text-xs text-red-500">Couldn&apos;t locate that address</span>
          )}
        </div>
      </div>

      <LocationMap lat={lat} lng={lng} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={labelCls}>Parking Notes</label>
          <input
            type="text"
            value={location.parkingNotes}
            onChange={(e) => setLocation({ ...location, parkingNotes: e.target.value })}
            placeholder="Parking info"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Nearest Hospital</label>
          <input
            type="text"
            value={location.nearestHospital}
            onChange={(e) => setLocation({ ...location, nearestHospital: e.target.value })}
            placeholder="Hospital name"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>what3words</label>
          <input
            type="text"
            value={location.whatThreeWords}
            onChange={(e) => setLocation({ ...location, whatThreeWords: e.target.value })}
            placeholder="///word.word.word"
            className={inputCls}
          />
        </div>
      </div>
    </div>
  );
}
