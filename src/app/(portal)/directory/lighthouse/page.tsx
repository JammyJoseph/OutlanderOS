"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Sparkles, Radar as RadarIcon, Lock, Star, Users } from "lucide-react";
import { DIRECTORY_ACCENT } from "@/lib/directory";

const ACCENT = DIRECTORY_ACCENT;

type Section = "spotlight" | "radar";

const SECTIONS: {
  key: Section;
  label: string;
  icon: React.ElementType;
  tagline: string;
}[] = [
  {
    key: "spotlight",
    label: "Spotlight",
    icon: Sparkles,
    tagline: "Your favourite creatives, front and centre.",
  },
  {
    key: "radar",
    label: "Radar",
    icon: RadarIcon,
    tagline: "Up-and-coming talent you're watching.",
  },
];

export default function LighthousePage() {
  const [section, setSection] = useState<Section>("spotlight");

  return (
    <div className="min-h-full px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/directory"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
        >
          <ArrowLeft size={15} /> Back to Directory
        </Link>

        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <span
            className="flex h-11 w-11 items-center justify-center rounded-2xl"
            style={{ backgroundColor: `${ACCENT}1a`, color: ACCENT }}
          >
            <Sparkles size={20} />
          </span>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Lighthouse</h1>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              A public-facing showcase of the creatives we rate and the talent we&apos;re watching.
            </p>
          </div>
        </div>

        {/* Section tabs */}
        <div className="mb-6 flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1 w-fit">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const isActive = section === s.key;
            return (
              <button
                key={s.key}
                onClick={() => setSection(s.key)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  isActive ? "text-black" : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                }`}
                style={isActive ? { backgroundColor: ACCENT } : undefined}
              >
                <Icon size={14} />
                {s.label}
              </button>
            );
          })}
        </div>

        {/* Active section — built out but greyed as "Coming Soon" */}
        {SECTIONS.filter((s) => s.key === section).map((s) => (
          <ComingSoonSection key={s.key} section={s} />
        ))}
      </div>
    </div>
  );
}

function ComingSoonSection({
  section,
}: {
  section: { key: Section; label: string; icon: React.ElementType; tagline: string };
}) {
  const Icon = section.icon;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card">
      {/* Placeholder content — deliberately inert and greyed out. */}
      <div className="pointer-events-none select-none p-6 opacity-40 blur-[1.5px]" aria-hidden>
        <div className="mb-5 flex items-center gap-2 text-gray-500 dark:text-gray-400">
          <Icon size={16} style={{ color: ACCENT }} />
          <span className="text-[11px] font-semibold uppercase tracking-wide">
            {section.label}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-xl border border-border bg-background p-4"
            >
              <span className="h-12 w-12 shrink-0 rounded-full bg-secondary" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3 w-3/4 rounded-full bg-secondary" />
                <div className="h-2.5 w-1/2 rounded-full bg-secondary" />
                <div className="flex items-center gap-2 pt-1 text-gray-400 dark:text-gray-500">
                  {section.key === "spotlight" ? (
                    <Star size={12} className="fill-[#ffd700] text-[#ffd700]" />
                  ) : (
                    <Users size={12} />
                  )}
                  <span className="h-2 w-10 rounded-full bg-secondary" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Coming Soon overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-card/60 px-6 text-center backdrop-blur-[2px]">
        <span
          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide"
          style={{ borderColor: `${ACCENT}55`, color: ACCENT, backgroundColor: `${ACCENT}14` }}
        >
          <Lock size={11} /> Coming Soon
        </span>
        <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{section.label}</p>
        <p className="max-w-md text-sm text-gray-500 dark:text-gray-400">{section.tagline}</p>
        <p className="max-w-md text-xs text-gray-400 dark:text-gray-500">
          This will become a public-facing feature. Nothing to configure here yet — check back soon.
        </p>
      </div>
    </div>
  );
}
