"use client";

import { Search } from "lucide-react";
import { BrandSummary } from "./types";

export interface Filters {
  search: string;
  brand: string;
  postType: string;
  mediaType: string;
  dateFrom: string;
  dateTo: string;
  sort: string;
}

interface Props {
  filters: Filters;
  brands: BrandSummary[];
  onChange: (f: Filters) => void;
}

const POST_TYPE_OPTS = [
  { v: "ALL", l: "All types" },
  { v: "ORGANIC", l: "Organic" },
  { v: "EDITORIAL", l: "Editorial" },
  { v: "PAID", l: "Paid" },
  { v: "COMMUNITY", l: "Community" },
  { v: "UNCLASSIFIED", l: "Unclassified" },
];

const MEDIA_TYPE_OPTS = [
  { v: "ALL", l: "All media" },
  { v: "IMAGE", l: "Image" },
  { v: "VIDEO", l: "Video" },
  { v: "REEL", l: "Reel" },
  { v: "CAROUSEL_ALBUM", l: "Carousel" },
];

const SORT_OPTS = [
  { v: "date", l: "Newest" },
  { v: "likes", l: "Most likes" },
  { v: "reach", l: "Most reach" },
  { v: "engagement", l: "Most engagement" },
];

export default function FilterBar({ filters, brands, onChange }: Props) {
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => onChange({ ...filters, [k]: v });

  const baseSelect =
    "rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-400";

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-3">
      <div className="relative flex-1 min-w-[220px]">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
          placeholder="Search captions…"
          className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-amber-400"
        />
      </div>
      <select
        value={filters.brand}
        onChange={(e) => set("brand", e.target.value)}
        className={baseSelect}
      >
        <option value="">All brands</option>
        {brands.map((b) => (
          <option key={b.name} value={b.name}>
            {b.name} ({b.postCount})
          </option>
        ))}
      </select>
      <select
        value={filters.postType}
        onChange={(e) => set("postType", e.target.value)}
        className={baseSelect}
      >
        {POST_TYPE_OPTS.map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
      <select
        value={filters.mediaType}
        onChange={(e) => set("mediaType", e.target.value)}
        className={baseSelect}
      >
        {MEDIA_TYPE_OPTS.map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
      <input
        type="date"
        value={filters.dateFrom}
        onChange={(e) => set("dateFrom", e.target.value)}
        className={baseSelect}
      />
      <input
        type="date"
        value={filters.dateTo}
        onChange={(e) => set("dateTo", e.target.value)}
        className={baseSelect}
      />
      <select
        value={filters.sort}
        onChange={(e) => set("sort", e.target.value)}
        className={baseSelect}
      >
        {SORT_OPTS.map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
    </div>
  );
}
