"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Loader2, Search, Hospital, TrainFront, Crosshair } from "lucide-react";
import type { LocationData, MovementOrder } from "./types";
import { inputCls, labelCls } from "./shared";

export async function geocodeAddress(
  address: string
): Promise<{ lat: number; lng: number } | null> {
  const q = (address || "").trim();
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

interface NominatimSuggestion {
  display_name: string;
  lat: string;
  lon: string;
}

// Free address autocomplete via OpenStreetMap Nominatim (no API key).
async function suggestAddresses(q: string): Promise<NominatimSuggestion[]> {
  const query = q.trim();
  if (query.length < 3) return [];
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&addressdetails=0&limit=5&q=${encodeURIComponent(
        query
      )}`,
      { headers: { Accept: "application/json" } }
    );
    if (!res.ok) return [];
    return (await res.json()) as NominatimSuggestion[];
  } catch {
    return [];
  }
}

// Overpass (OpenStreetMap) lookup for the nearest amenity of a given type.
async function findNearest(
  lat: number,
  lng: number,
  filter: string,
  radius = 30000
): Promise<{ name: string; address: string } | null> {
  const query = `[out:json][timeout:25];(${filter}(around:${radius},${lat},${lng}););out center 30;`;
  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: "data=" + encodeURIComponent(query),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      elements: {
        lat?: number;
        lon?: number;
        center?: { lat: number; lon: number };
        tags?: Record<string, string>;
      }[];
    };
    let best: { name: string; address: string; dist: number } | null = null;
    for (const el of data.elements ?? []) {
      const elat = el.lat ?? el.center?.lat;
      const elon = el.lon ?? el.center?.lon;
      if (elat == null || elon == null) continue;
      const name = el.tags?.name;
      if (!name) continue;
      const dist = (elat - lat) ** 2 + (elon - lng) ** 2;
      const t = el.tags ?? {};
      const address = [
        [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" "),
        t["addr:city"],
        t["addr:postcode"],
      ]
        .filter(Boolean)
        .join(", ");
      if (!best || dist < best.dist) best = { name, address, dist };
    }
    return best ? { name: best.name, address: best.address } : null;
  } catch {
    return null;
  }
}

export function LocationMap({
  lat,
  lng,
  height = 300,
  wide = false,
}: {
  lat: number | null;
  lng: number | null;
  height?: number;
  wide?: boolean;
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

  const d = wide ? 0.04 : 0.012;
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
  const [suggestions, setSuggestions] = useState<NominatimSuggestion[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const [findingHospital, setFindingHospital] = useState(false);
  const [findingStation, setFindingStation] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const justPickedRef = useRef(false);
  // Always-fresh location for async callbacks that would otherwise close over
  // a stale value.
  const locationRef = useRef(location);
  locationRef.current = location;

  // Debounced address autocomplete.
  useEffect(() => {
    if (justPickedRef.current) {
      justPickedRef.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = location.address;
    if (!q || q.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const res = await suggestAddresses(q);
      setSuggestions(res);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [location.address]);

  // Fetch hospital + station together and apply both in a single update so the
  // two async results don't clobber each other (setLocation takes a full value).
  async function autoFindNearby(la: number, ln: number) {
    setFindingHospital(true);
    setFindingStation(true);
    const [h, s] = await Promise.all([
      findNearest(la, ln, 'nwr["amenity"="hospital"]').finally(() =>
        setFindingHospital(false)
      ),
      findNearest(la, ln, 'nwr["railway"="station"]', 15000).finally(() =>
        setFindingStation(false)
      ),
    ]);
    const prev = locationRef.current;
    setLocation({
      ...prev,
      nearestHospital: h ? (h.address ? `${h.name} — ${h.address}` : h.name) : prev.nearestHospital,
      nearestStation: s ? (s.address ? `${s.name} — ${s.address}` : s.name) : prev.nearestStation,
    });
  }

  function pickSuggestion(s: NominatimSuggestion) {
    justPickedRef.current = true;
    const la = parseFloat(s.lat);
    const ln = parseFloat(s.lon);
    setLocation({ ...location, address: s.display_name });
    onCoordsChange(la, ln);
    setSuggestions([]);
    setShowSuggest(false);
    autoFindNearby(la, ln);
  }

  async function findOnMap() {
    setNotFound(false);
    setLocating(true);
    const coords = await geocodeAddress(location.address);
    setLocating(false);
    if (coords) {
      onCoordsChange(coords.lat, coords.lng);
      autoFindNearby(coords.lat, coords.lng);
    } else {
      setNotFound(true);
    }
  }

  function findHospital() {
    if (lat == null || lng == null) return;
    setFindingHospital(true);
    findNearest(lat, lng, 'nwr["amenity"="hospital"]')
      .then((h) => {
        if (h)
          setLocation({
            ...location,
            nearestHospital: h.address ? `${h.name} — ${h.address}` : h.name,
          });
      })
      .finally(() => setFindingHospital(false));
  }

  function findStation() {
    if (lat == null || lng == null) return;
    setFindingStation(true);
    findNearest(lat, lng, 'nwr["railway"="station"]', 15000)
      .then((s) => {
        if (s)
          setLocation({
            ...location,
            nearestStation: s.address ? `${s.name} — ${s.address}` : s.name,
          });
      })
      .finally(() => setFindingStation(false));
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <label className={labelCls}>Address</label>
        <textarea
          value={location.address}
          onChange={(e) => {
            setLocation({ ...location, address: e.target.value });
            setShowSuggest(true);
          }}
          onFocus={() => setShowSuggest(true)}
          placeholder="Start typing an address…"
          rows={2}
          className={`${inputCls} resize-none`}
        />
        {showSuggest && suggestions.length > 0 && (
          <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-64 overflow-y-auto">
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => pickSuggestion(s)}
                className="flex items-start gap-2 w-full text-left px-3.5 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
              >
                <MapPin size={13} className="text-[#ff4444] mt-0.5 shrink-0" />
                <span className="text-xs text-gray-700 leading-snug">{s.display_name}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <button
            onClick={findOnMap}
            disabled={locating || !(location.address || "").trim()}
            className="flex items-center gap-1.5 text-xs font-medium text-[#ff4444] hover:text-[#ff4444] transition-colors disabled:opacity-40"
          >
            {locating ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
            Find on map
          </button>
          {lat != null && lng != null && (
            <>
              <button
                onClick={findHospital}
                disabled={findingHospital}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors disabled:opacity-40"
              >
                {findingHospital ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Hospital size={13} />
                )}
                Find nearest A&amp;E
              </button>
              <button
                onClick={findStation}
                disabled={findingStation}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors disabled:opacity-40"
              >
                {findingStation ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <TrainFront size={13} />
                )}
                Find nearest station
              </button>
            </>
          )}
          {lat != null && lng != null && (
            <span className="flex items-center gap-1 text-xs text-emerald-600">
              <Crosshair size={11} /> Pinned ({lat.toFixed(4)}, {lng.toFixed(4)})
            </span>
          )}
          {notFound && (
            <span className="text-xs text-red-500">Couldn&apos;t locate that address</span>
          )}
        </div>
      </div>

      <LocationMap lat={lat} lng={lng} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Nearest A&amp;E / Hospital</label>
          <input
            type="text"
            value={location.nearestHospital}
            onChange={(e) => setLocation({ ...location, nearestHospital: e.target.value })}
            placeholder="Auto-filled from map, or enter manually"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Nearest Station</label>
          <input
            type="text"
            value={location.nearestStation ?? ""}
            onChange={(e) => setLocation({ ...location, nearestStation: e.target.value })}
            placeholder="Nearest train/tube station"
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
          <label className={labelCls}>Public Transport Notes</label>
          <input
            type="text"
            value={location.transportNotes ?? ""}
            onChange={(e) => setLocation({ ...location, transportNotes: e.target.value })}
            placeholder="Bus / tube / walking directions"
            className={inputCls}
          />
        </div>
        <div>
          <label className={`${labelCls} text-red-500`}>Safety / NB Notes</label>
          <input
            type="text"
            value={location.safetyNotes ?? ""}
            onChange={(e) => setLocation({ ...location, safetyNotes: e.target.value })}
            placeholder="Sensitive / safety-critical info (shown in red)"
            className={`${inputCls} text-red-600 placeholder:text-red-300`}
          />
        </div>
      </div>
    </div>
  );
}

export function MovementOrderEditor({
  movementOrder,
  setMovementOrder,
  lat,
  lng,
}: {
  movementOrder: MovementOrder;
  setMovementOrder: (v: MovementOrder) => void;
  lat: number | null;
  lng: number | null;
}) {
  const set = (k: keyof MovementOrder, v: string) =>
    setMovementOrder({ ...movementOrder, [k]: v });

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400">
        Wider route map and on-site directions. Location, what3words, station and A&amp;E are pulled
        from the Location section above.
      </p>
      <LocationMap lat={lat} lng={lng} height={260} wide />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={labelCls}>Site Entrance</label>
          <input
            type="text"
            value={movementOrder.siteEntrance}
            onChange={(e) => set("siteEntrance", e.target.value)}
            placeholder="Where to enter the site"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Tech Parking</label>
          <input
            type="text"
            value={movementOrder.techParking}
            onChange={(e) => set("techParking", e.target.value)}
            placeholder="Unit / tech vehicle parking"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Crew Parking</label>
          <input
            type="text"
            value={movementOrder.crewParking}
            onChange={(e) => set("crewParking", e.target.value)}
            placeholder="Crew parking instructions"
            className={inputCls}
          />
        </div>
      </div>
      <div>
        <label className={labelCls}>Route Notes</label>
        <textarea
          value={movementOrder.routeNotes}
          onChange={(e) => set("routeNotes", e.target.value)}
          placeholder="Driving directions, access notes, gate codes…"
          rows={2}
          className={`${inputCls} resize-none`}
        />
      </div>
    </div>
  );
}
