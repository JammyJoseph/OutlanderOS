"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, TrendingUp } from "lucide-react";
import { BrandSummary } from "../_components/types";
import { brandColor, compactNumber } from "../_components/utils";
import BrandDetail from "./_components/BrandDetail";

export default function BrandPerformancePage() {
  const [brands, setBrands] = useState<BrandSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/content-tracker/brands");
      const j = await r.json();
      setBrands(j.brands ?? []);
    } catch {
      setBrands([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-6 font-[Manrope,system-ui,sans-serif]">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <Link
            href="/commercial/content-tracker"
            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Content Tracker
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-gray-900">Brand Performance</h1>
          <p className="mt-1 text-sm text-gray-500">
            How brands are performing across your tagged content.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center text-gray-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : brands.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white text-gray-500">
          <p className="text-sm">No brands tagged yet.</p>
          <p className="mt-2 text-xs">
            Tag posts with brand names from the Content Tracker to see them here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          {brands.map((b) => (
            <BrandCard key={b.name} brand={b} onClick={() => setActive(b.name)} />
          ))}
        </div>
      )}

      {active && <BrandDetail name={active} onClose={() => setActive(null)} />}
    </div>
  );
}

function BrandCard({ brand, onClick }: { brand: BrandSummary; onClick: () => void }) {
  const c = brandColor(brand.name);
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left transition-shadow hover:shadow-md"
    >
      <div
        className={`inline-flex rounded-full border px-3 py-1 text-sm font-medium ${c.bg} ${c.text} ${c.border}`}
      >
        {brand.name}
      </div>
      <div className="grid grid-cols-3 gap-2 text-center w-full">
        <Stat label="Posts" value={String(brand.postCount)} />
        <Stat label="Reach" value={compactNumber(brand.totalReach)} />
        <Stat
          label="Avg eng"
          value={`${brand.avgEngagement.toFixed(1)}%`}
          icon={<TrendingUp className="h-3 w-3" />}
        />
      </div>
    </button>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-0.5 inline-flex items-center gap-1 text-sm font-semibold text-gray-900">
        {icon}
        {value}
      </p>
    </div>
  );
}
