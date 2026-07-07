"use client";

import { useId, useMemo, useState } from "react";
import { computeRouteMapView, type GeoPoint } from "@/lib/route-utils";

// ─────────────────────────────────────────────────────────────────────────────
// The single route map on the call sheet.
//
// We composite it ourselves from OpenStreetMap tiles (tile.openstreetmap.org —
// no API key) into an inline SVG: OSM tiles as the base, a route line through
// every geocoded stop, and numbered pins. This replaced a dead third-party
// static-map service (staticmap.openstreetmap.de). Because it's an inline SVG of
// real <image> elements — not an <iframe> — it renders in the printed / exported
// PDF too. If tiles fail to load it degrades to a clean schematic (route line +
// numbered pins on a plain background) with a caption, never a broken image.
// ─────────────────────────────────────────────────────────────────────────────

const PIN = "#141414"; // pins + route line (matches the sheet's black accent)
const PAPER = "#f4f2ee"; // fallback backdrop when tiles are missing/loading

export function RouteMap({
  stops,
  width = 680,
  height = 320,
}: {
  stops: GeoPoint[];
  width?: number;
  height?: number;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const clipId = `routemap-clip-${uid}`;

  const view = useMemo(
    () => computeRouteMapView(stops, width, height),
    [stops, width, height]
  );

  // Track tiles that fail to load so we can tell when the base imagery is gone
  // entirely (dead tile server, offline) and show the schematic + caption.
  const [failed, setFailed] = useState<Set<string>>(() => new Set());

  if (!view) return null;
  const { points, tiles } = view;

  const allTilesFailed = tiles.length > 0 && failed.size >= tiles.length;
  const routePath = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      role="img"
      aria-label="Route map showing all shoot locations"
      style={{
        display: "block",
        width: "100%",
        height: "auto",
        border: "1px solid #e7e7e7",
        borderRadius: "2px",
        background: PAPER,
      }}
    >
      <defs>
        <clipPath id={clipId}>
          <rect x={0} y={0} width={width} height={height} />
        </clipPath>
      </defs>

      <g clipPath={`url(#${clipId})`}>
        {/* Base tiles. A failed tile is hidden so the paper backdrop shows. */}
        {!allTilesFailed &&
          tiles.map((t) => (
            <image
              key={t.key}
              href={t.url}
              x={t.left}
              y={t.top}
              width={256}
              height={256}
              preserveAspectRatio="none"
              opacity={failed.has(t.key) ? 0 : 1}
              onError={() =>
                setFailed((prev) => {
                  if (prev.has(t.key)) return prev;
                  const next = new Set(prev);
                  next.add(t.key);
                  return next;
                })
              }
            />
          ))}

        {/* Route line through every stop, in shoot order. */}
        {points.length >= 2 && (
          <polyline
            points={routePath}
            fill="none"
            stroke={PIN}
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeOpacity={0.85}
          />
        )}

        {/* Numbered pins. */}
        {points.map((p) => (
          <g key={p.label}>
            <circle
              cx={p.x}
              cy={p.y}
              r={11}
              fill={PIN}
              stroke="#ffffff"
              strokeWidth={2}
            />
            <text
              x={p.x}
              y={p.y}
              dy="0.35em"
              textAnchor="middle"
              fontSize={12}
              fontWeight={700}
              fill="#ffffff"
              fontFamily='"Helvetica Neue", Helvetica, Arial, sans-serif'
            >
              {p.label}
            </text>
          </g>
        ))}
      </g>

      {/* Attribution (OSM tile usage policy) — omitted when imagery is absent. */}
      {!allTilesFailed && (
        <text
          x={width - 5}
          y={height - 5}
          textAnchor="end"
          fontSize={8}
          fill="#6b6b6b"
          fontFamily='"Helvetica Neue", Helvetica, Arial, sans-serif'
        >
          © OpenStreetMap
        </text>
      )}

      {/* Graceful fallback caption when no tile could load. The route line +
          numbered pins above still convey the journey shape. */}
      {allTilesFailed && (
        <text
          x={width / 2}
          y={14}
          textAnchor="middle"
          fontSize={9}
          fontWeight={700}
          letterSpacing="0.08em"
          fill="#6b6b6b"
          fontFamily='"Helvetica Neue", Helvetica, Arial, sans-serif'
          style={{ textTransform: "uppercase" }}
        >
          Map preview unavailable — see numbered stops below
        </text>
      )}
    </svg>
  );
}
