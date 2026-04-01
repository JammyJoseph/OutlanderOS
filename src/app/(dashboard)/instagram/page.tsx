"use client";

import {
  instagramPosts,
  instagramMonthlyMetrics,
  ContentType,
} from "@/lib/mock-data";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend,
} from "recharts";
import { TrendingUp, Users, Eye, Heart, Bookmark } from "lucide-react";

const tooltipStyle = {
  contentStyle: {
    background: "#18181b",
    border: "1px solid #27272a",
    borderRadius: "6px",
    fontSize: "12px",
    color: "#f4f4f5",
  },
};

const TYPE_COLORS: Record<ContentType, string> = {
  reel: "#D4A853",
  carousel: "#B8860B",
  single: "#8B6914",
};

const TYPE_BG: Record<ContentType, string> = {
  reel: "bg-[#D4A853]/15 text-[#D4A853]",
  carousel: "bg-amber-700/15 text-amber-600",
  single: "bg-amber-900/15 text-amber-800",
};

function avgByType(type: ContentType) {
  const posts = instagramPosts.filter(p => p.contentType === type);
  if (posts.length === 0) return { engagement: 0, reach: 0, count: 0 };
  return {
    count: posts.length,
    engagement: +(posts.reduce((s, p) => s + p.engagementRate, 0) / posts.length).toFixed(1),
    reach: Math.round(posts.reduce((s, p) => s + p.reach, 0) / posts.length),
  };
}

export default function InstagramPage() {
  const latest = instagramMonthlyMetrics[instagramMonthlyMetrics.length - 1];
  const prev = instagramMonthlyMetrics[instagramMonthlyMetrics.length - 2];
  const followerGrowth = latest.followers - prev.followers;
  const topPosts = [...instagramPosts].sort((a, b) => b.engagementRate - a.engagementRate).slice(0, 3);

  const reelStats = avgByType("reel");
  const carouselStats = avgByType("carousel");
  const singleStats = avgByType("single");

  const contentTypeData = [
    { type: "Reels", count: reelStats.count, avgEngagement: reelStats.engagement, avgReach: reelStats.reach },
    { type: "Carousels", count: carouselStats.count, avgEngagement: carouselStats.engagement, avgReach: carouselStats.reach },
    { type: "Single", count: singleStats.count, avgEngagement: singleStats.engagement, avgReach: singleStats.reach },
  ];

  const kpis = [
    { label: "Followers", value: `${(latest.followers / 1000).toFixed(1)}K`, sub: `+${followerGrowth.toLocaleString()} this month`, icon: Users },
    { label: "Avg Engagement", value: `${latest.avgEngagementRate}%`, sub: "March 2026", icon: Heart },
    { label: "Weekly Reach", value: `${(latest.weeklyReach / 1000).toFixed(0)}K`, sub: "avg this month", icon: Eye },
    { label: "Profile Visits", value: `${(latest.profileVisits / 1000).toFixed(1)}K`, sub: "March 2026", icon: TrendingUp },
    { label: "Website Clicks", value: `${(latest.websiteClicks / 1000).toFixed(1)}K`, sub: "March 2026", icon: Bookmark },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Instagram Analytics</h1>
        <p className="text-xs text-zinc-500">@outlandermagazine · {latest.followers.toLocaleString()} followers</p>
      </div>

      {/* Account KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
              <div className="flex items-center gap-2">
                <Icon className="h-3.5 w-3.5 text-[#D4A853]" />
                <p className="text-[11px] uppercase tracking-wider text-zinc-500">{kpi.label}</p>
              </div>
              <p className="mt-1 font-mono text-2xl font-bold text-zinc-100">{kpi.value}</p>
              <p className="mt-0.5 text-[11px] text-zinc-500">{kpi.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Engagement Trend */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 lg:col-span-2">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">Engagement Rate Trend — 12 Months</h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={instagramMonthlyMetrics} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="engGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#D4A853" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#D4A853" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="month" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} domain={[0, 12]} />
              <Tooltip {...tooltipStyle} formatter={(v) => [`${Number(v)}%`, "Engagement"]} />
              <Area type="monotone" dataKey="avgEngagementRate" name="Engagement Rate" stroke="#D4A853" strokeWidth={2} fill="url(#engGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Content Type Comparison */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">Content Type Performance</h2>
          <div className="space-y-4">
            {contentTypeData.map((ct) => (
              <div key={ct.type} className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-xs font-medium text-zinc-300">{ct.type}</span>
                  <span className="text-[11px] text-zinc-500">{ct.count} posts</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-zinc-500">Avg engagement</span>
                  <span className={`font-mono font-semibold ${ct.avgEngagement >= 8 ? "text-emerald-400" : ct.avgEngagement >= 6 ? "text-[#D4A853]" : "text-zinc-400"}`}>
                    {ct.avgEngagement}%
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(ct.avgEngagement / 12) * 100}%`, background: "#D4A853" }}
                  />
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-zinc-500">Avg reach</span>
                  <span className="font-mono text-zinc-400">{(ct.avgReach / 1000).toFixed(0)}K</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Reach & Follower Growth Chart */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">Monthly Reach Trend</h2>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={instagramMonthlyMetrics} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="reachGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#B8860B" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#B8860B" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="month" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
              <Tooltip {...tooltipStyle} formatter={(v) => [`${(Number(v) / 1000).toFixed(0)}K`, "Weekly Reach"]} />
              <Area type="monotone" dataKey="weeklyReach" stroke="#B8860B" strokeWidth={2} fill="url(#reachGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">Follower Growth</h2>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={instagramMonthlyMetrics} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="follGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8B6914" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#8B6914" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="month" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} domain={[100000, 160000]} />
              <Tooltip {...tooltipStyle} formatter={(v) => [`${(Number(v) / 1000).toFixed(1)}K`, "Followers"]} />
              <Area type="monotone" dataKey="followers" stroke="#8B6914" strokeWidth={2} fill="url(#follGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Best Performing Posts */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">Best Performing Posts</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {topPosts.map((post, i) => (
            <div key={post.id} className="rounded-lg border border-zinc-800 bg-zinc-950 overflow-hidden">
              {/* Thumbnail placeholder */}
              <div
                className="relative flex h-40 items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${post.color}40, ${post.color}15)`, borderColor: post.color + "30" }}
              >
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold"
                  style={{ background: post.color + "30", color: post.color }}
                >
                  #{post.postNumber}
                </div>
                <div className="absolute left-2 top-2">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${TYPE_BG[post.contentType]}`}>
                    {post.contentType}
                  </span>
                </div>
                <div className="absolute right-2 top-2">
                  <span className="rounded bg-black/50 px-1.5 py-0.5 font-mono text-[11px] font-bold text-[#D4A853]">
                    #{i + 1}
                  </span>
                </div>
              </div>
              <div className="p-3">
                <p className="mb-2 text-[11px] text-zinc-400 line-clamp-2">{post.caption}</p>
                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                  <div>
                    <span className="text-zinc-600">Engagement</span>
                    <p className="font-mono font-bold text-[#D4A853]">{post.engagementRate}%</p>
                  </div>
                  <div>
                    <span className="text-zinc-600">Reach</span>
                    <p className="font-mono text-zinc-200">{(post.reach / 1000).toFixed(0)}K</p>
                  </div>
                  <div>
                    <span className="text-zinc-600">Likes</span>
                    <p className="font-mono text-zinc-200">{post.likes.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-zinc-600">Saves</span>
                    <p className="font-mono text-zinc-200">{post.saves.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Post Performance Table */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">All Posts — Performance Metrics</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-[11px] text-zinc-600">
                <th className="pb-2 font-medium">Post</th>
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium">Type</th>
                <th className="pb-2 font-medium text-right">Likes</th>
                <th className="pb-2 font-medium text-right">Comments</th>
                <th className="pb-2 font-medium text-right">Saves</th>
                <th className="pb-2 font-medium text-right">Shares</th>
                <th className="pb-2 font-medium text-right">Reach</th>
                <th className="pb-2 font-medium text-right">Impressions</th>
                <th className="pb-2 font-medium text-right">Eng. Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/40">
              {instagramPosts.map((post) => (
                <tr key={post.id} className="hover:bg-zinc-800/30">
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-7 w-7 flex-shrink-0 rounded flex items-center justify-center text-[10px] font-bold"
                        style={{ background: post.color + "25", color: post.color }}
                      >
                        {post.postNumber}
                      </div>
                      <span className="max-w-[120px] truncate text-zinc-300">{post.caption}</span>
                    </div>
                  </td>
                  <td className="py-2 font-mono text-[11px] text-zinc-500">{post.date}</td>
                  <td className="py-2">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${TYPE_BG[post.contentType]}`}>
                      {post.contentType}
                    </span>
                  </td>
                  <td className="py-2 text-right font-mono text-zinc-300">{post.likes.toLocaleString()}</td>
                  <td className="py-2 text-right font-mono text-zinc-300">{post.comments.toLocaleString()}</td>
                  <td className="py-2 text-right font-mono text-zinc-300">{post.saves.toLocaleString()}</td>
                  <td className="py-2 text-right font-mono text-zinc-300">{post.shares.toLocaleString()}</td>
                  <td className="py-2 text-right font-mono text-zinc-300">{(post.reach / 1000).toFixed(0)}K</td>
                  <td className="py-2 text-right font-mono text-zinc-400">{(post.impressions / 1000).toFixed(0)}K</td>
                  <td className="py-2 text-right">
                    <span className={`font-mono font-semibold ${post.engagementRate >= 8 ? "text-emerald-400" : post.engagementRate >= 6 ? "text-[#D4A853]" : "text-zinc-400"}`}>
                      {post.engagementRate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
