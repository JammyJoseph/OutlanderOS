"use client";

import { ExternalLink } from "lucide-react";

const FEEDS = [
  { name: "Business of Fashion", url: "https://www.businessoffashion.com/feed", key: "rss:bof" },
  { name: "Highsnobiety", url: "https://www.highsnobiety.com/feed/", key: "rss:highsnobiety" },
  { name: "Hypebeast", url: "https://hypebeast.com/feed", key: "rss:hypebeast" },
  { name: "Dezeen", url: "https://www.dezeen.com/feed/", key: "rss:dezeen" },
  { name: "Dazed", url: "https://www.dazeddigital.com/rss", key: "rss:dazed" },
  { name: "It's Nice That", url: "https://www.itsnicethat.com/rss/all", key: "rss:itsnicethat" },
  { name: "Wallpaper", url: "https://www.wallpaper.com/rss", key: "rss:wallpaper" },
];

const CATEGORIES = ["fashion", "luxury", "culture", "food", "art", "music", "lifestyle", "tech"];

export default function ThinkTankSettingsPage() {
  return (
    <div className="flex h-full flex-col font-[family-name:var(--font-manrope)]">
      <div className="border-b border-gray-200 bg-white px-6 py-3">
        <h1 className="text-base font-semibold text-gray-900">Think Tank Settings</h1>
        <p className="text-xs text-gray-500">Feed sources and categories.</p>
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-50 px-6 py-5">
        <div className="mx-auto flex max-w-3xl flex-col gap-5">
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900">RSS Feed Sources</h2>
            <p className="mt-1 text-xs text-gray-500">
              Signals are pulled from these feeds when you hit “Refresh Feeds”. Editing sources is a future enhancement — for now they are configured in code.
            </p>
            <ul className="mt-4 divide-y divide-gray-100">
              {FEEDS.map((f) => (
                <li key={f.key} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{f.name}</p>
                    <p className="text-[11px] text-gray-400">{f.key}</p>
                  </div>
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-[11px] font-medium text-[#E67E22] hover:text-[#CF6D14]"
                  >
                    Open feed <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900">Categories</h2>
            <p className="mt-1 text-xs text-gray-500">
              Auto-categorisation runs on title and summary keywords during ingestion.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <span key={c} className="rounded-full bg-purple-50 px-2.5 py-1 text-[11px] font-medium text-purple-700">
                  {c}
                </span>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
