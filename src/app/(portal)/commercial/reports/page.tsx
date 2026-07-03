"use client";

import { useState, useEffect } from "react";
import {
  Camera,
  BarChart2,
  Download,
  Share2,
  Filter,
  Search,
  Heart,
  MessageCircle,
  Bookmark,
  Eye,
  TrendingUp,
} from "lucide-react";

interface Campaign {
  id: string;
  title: string;
  client: { name: string };
}

type PostType = "All" | "Post" | "Story" | "Reel" | "Carousel";

const POST_TYPE_COLORS: Record<PostType, string> = {
  All: "bg-gray-100 text-gray-700",
  Post: "bg-blue-100 text-blue-700",
  Story: "bg-purple-100 text-purple-700",
  Reel: "bg-pink-100 text-pink-700",
  Carousel: "bg-amber-100 text-amber-700",
};

export default function CampaignReportsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");
  const [postTypeFilter, setPostTypeFilter] = useState<PostType>("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/campaigns")
      .then((r) => r.json())
      .then(setCampaigns)
      .catch(() => {});
  }, []);

  const selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId);

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-6 py-3">
        <div>
          <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Campaign Reports
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">Instagram performance reporting</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            disabled
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-xs font-medium text-gray-400 cursor-not-allowed"
          >
            <Download className="h-3.5 w-3.5" />
            Export Report
          </button>
          <button
            disabled
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-xs font-medium text-gray-400 cursor-not-allowed"
          >
            <Share2 className="h-3.5 w-3.5" />
            Share with Client
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: post browser */}
        <div className="flex w-2/3 flex-col border-r border-gray-200 dark:border-gray-700">
          {/* Campaign selector + filters */}
          <div className="border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 space-y-3">
            <div className="flex items-center gap-3">
              <select
                value={selectedCampaignId}
                onChange={(e) => setSelectedCampaignId(e.target.value)}
                className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm focus:border-[#ffd700] focus:outline-none"
              >
                <option value="">Select a campaign…</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.client.name} — {c.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter bar */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[160px]">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by caption…"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 pl-8 pr-3 py-1.5 text-xs focus:border-[#ffd700] focus:outline-none"
                />
              </div>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs focus:border-[#ffd700] focus:outline-none"
              />
              <span className="text-xs text-gray-400">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs focus:border-[#ffd700] focus:outline-none"
              />
              <div className="flex items-center gap-1">
                <Filter className="h-3.5 w-3.5 text-gray-400" />
                {(["All", "Post", "Story", "Reel", "Carousel"] as PostType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setPostTypeFilter(t)}
                    className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                      postTypeFilter === t
                        ? POST_TYPE_COLORS[t]
                        : "bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Post grid — empty state */}
          <div className="flex-1 overflow-auto p-4">
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                <Camera className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Connect Instagram to see posts
              </p>
              <p className="mt-1 max-w-xs text-xs text-gray-400">
                Once your Meta developer app is approved and Instagram is
                connected, posts will appear here automatically.
              </p>
              <p className="mt-3 text-[10px] text-gray-300 uppercase tracking-widest font-semibold">
                Instagram API — pending Meta approval
              </p>
            </div>
          </div>
        </div>

        {/* Right: campaign report view */}
        <div className="flex w-1/3 flex-col bg-gray-50 dark:bg-gray-800">
          <div className="border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              {selectedCampaign
                ? `${selectedCampaign.client.name} — ${selectedCampaign.title}`
                : "Campaign Summary"}
            </h2>
            <p className="text-xs text-gray-400">
              {selectedCampaign
                ? "0 posts tagged"
                : "Select a campaign to view report"}
            </p>
          </div>

          <div className="flex-1 overflow-auto p-4 space-y-4">
            {/* Metric cards */}
            {[
              { label: "Total Reach", value: "—", icon: Eye, color: "text-blue-600", bg: "bg-blue-50" },
              { label: "Total Impressions", value: "—", icon: TrendingUp, color: "text-purple-600", bg: "bg-purple-50" },
              { label: "Total Engagement", value: "—", icon: Heart, color: "text-pink-500", bg: "bg-pink-50" },
              { label: "Engagement Rate", value: "—", icon: BarChart2, color: "text-amber-600", bg: "bg-amber-50" },
              { label: "Comments", value: "—", icon: MessageCircle, color: "text-gray-600", bg: "bg-gray-100" },
              { label: "Saves", value: "—", icon: Bookmark, color: "text-emerald-600", bg: "bg-emerald-50" },
            ].map((m) => {
              const Icon = m.icon;
              return (
                <div
                  key={m.label}
                  className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3"
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${m.bg}`}
                  >
                    <Icon className={`h-4 w-4 ${m.color}`} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{m.label}</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{m.value}</p>
                  </div>
                </div>
              );
            })}

            <div className="rounded-lg border border-dashed border-gray-200 dark:border-gray-700 p-4 text-center">
              <p className="text-xs text-gray-400">
                Tag posts to this campaign to see aggregated metrics.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
