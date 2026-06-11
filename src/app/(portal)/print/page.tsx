"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  RefreshCw,
  Calendar,
  CheckCircle2,
  Circle,
  ExternalLink,
  Filter,
  AlertCircle,
  Layers,
  Megaphone,
  FileText,
  Tag,
  Loader2,
} from "lucide-react";

interface TimelineMilestone {
  label: string;
  issue: string;
  date: string;
  rawDate: string;
  status: "past" | "today" | "future";
}

interface Feature {
  iconType: string;
  name: string;
  description: string;
  confirmed: string;
  category: string;
  status: string;
  contact: string;
  notes: string;
}

interface AdSlot {
  slot: string;
  brand: string;
  format: string;
  confirmed: string;
  category: string;
  status: string;
  contact: string;
  assetsReceived: string;
  interviewDone: string;
  readyForDesign: string;
  notes: string;
}

interface FlatPlanSpread {
  pages: string;
  content: string;
  category: string;
}

interface PaidFeature {
  type: "360 Deal" | "Advertorial";
  brand: string;
  status: string;
  notes: string;
}

interface ContentTrackerRow {
  ad: string;
  assetsReceived: string;
  interviewDone: string;
  readyForDesign: string;
  notes: string;
  status: string;
}

interface PrintData {
  fetchedAt: string;
  sheetTitle: string | null;
  sheetNames: string[];
  issues: string[];
  timeline: TimelineMilestone[];
  features: Feature[];
  adSlots: AdSlot[];
  flatPlan: FlatPlanSpread[];
  paidFeatures: PaidFeature[];
  contentTracker: ContentTrackerRow[];
  error: string | null;
  connected: boolean;
  cached?: boolean;
}

const ISSUES = ["Issue 01", "Issue 02"] as const;

const CATEGORY_COLORS: Record<
  string,
  { bg: string; text: string; ring: string; dot: string }
> = {
  FOB: { bg: "bg-blue-50", text: "text-blue-700", ring: "ring-blue-200", dot: "bg-blue-400" },
  Fashion: { bg: "bg-pink-50", text: "text-pink-700", ring: "ring-pink-200", dot: "bg-pink-400" },
  Community: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    ring: "ring-emerald-200",
    dot: "bg-emerald-400",
  },
  Sponsored: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    ring: "ring-amber-200",
    dot: "bg-amber-400",
  },
  Feature: {
    bg: "bg-purple-50",
    text: "text-purple-700",
    ring: "ring-purple-200",
    dot: "bg-purple-400",
  },
  Culinary: {
    bg: "bg-orange-50",
    text: "text-orange-700",
    ring: "ring-orange-200",
    dot: "bg-orange-400",
  },
  Cover: { bg: "bg-gray-900", text: "text-white", ring: "ring-gray-700", dot: "bg-gray-900" },
  Other: { bg: "bg-gray-50", text: "text-gray-600", ring: "ring-gray-200", dot: "bg-gray-300" },
};

const ICON_TYPE_BADGES: Record<string, string> = {
  "LOCAL ICON": "bg-emerald-50 text-emerald-700",
  "BRAND ICON": "bg-blue-50 text-blue-700",
  "INDUSTRY ICON": "bg-purple-50 text-purple-700",
  "FUTURE ICON": "bg-pink-50 text-pink-700",
  "CULINARY ICON": "bg-orange-50 text-orange-700",
};

function statusPill(value: string): { label: string; className: string } {
  const v = (value || "").toUpperCase().trim();
  if (v === "TRUE" || v === "CONFIRMED" || v === "YES")
    return { label: "Confirmed", className: "bg-emerald-100 text-emerald-700" };
  if (v === "MAYBE")
    return { label: "Maybe", className: "bg-amber-100 text-amber-700" };
  if (v === "PROBS NOT" || v === "NO" || v === "FALSE")
    return { label: "Probs Not", className: "bg-gray-100 text-gray-500" };
  if (v === "SENT")
    return { label: "Sent", className: "bg-blue-100 text-blue-700" };
  if (v === "IN PROGRESS")
    return { label: "In Progress", className: "bg-amber-100 text-amber-700" };
  if (v === "REACHED OUT")
    return { label: "Reached Out", className: "bg-blue-50 text-blue-600" };
  if (v === "INTERESTED")
    return { label: "Interested", className: "bg-emerald-50 text-emerald-600" };
  if (v === "N/A" || v === "N/a")
    return { label: "—", className: "bg-gray-50 text-gray-400" };
  if (!value) return { label: "—", className: "bg-gray-50 text-gray-400" };
  return { label: value, className: "bg-gray-100 text-gray-600" };
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

export default function PrintPortalPage() {
  const [data, setData] = useState<PrintData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [issue, setIssue] = useState<(typeof ISSUES)[number]>("Issue 01");
  const [featureFilter, setFeatureFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [expandedFeature, setExpandedFeature] = useState<string | null>(null);

  async function load(force = false) {
    if (force) setRefreshing(true);
    try {
      const res = await fetch(`/api/print${force ? "?refresh=true" : ""}`, {
        cache: "no-store",
      });
      const d = (await res.json()) as PrintData;
      setData(d);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load(false);
  }, []);

  const issueTimeline = useMemo(
    () => (data?.timeline ?? []).filter((m) => m.issue === issue),
    [data, issue]
  );

  const filteredFeatures = useMemo(() => {
    let list = data?.features ?? [];
    if (featureFilter !== "all") {
      list = list.filter((f) => {
        const v = f.confirmed.toUpperCase();
        if (featureFilter === "confirmed") return v === "TRUE" || v === "CONFIRMED";
        if (featureFilter === "maybe") return v === "MAYBE";
        if (featureFilter === "probs") return v === "PROBS NOT";
        return true;
      });
    }
    if (categoryFilter !== "all") {
      list = list.filter((f) => f.category === categoryFilter);
    }
    return list;
  }, [data, featureFilter, categoryFilter]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    (data?.features ?? []).forEach((f) => f.category && set.add(f.category));
    return Array.from(set).sort();
  }, [data]);

  const stats = useMemo(() => {
    const features = data?.features ?? [];
    const ads = data?.adSlots ?? [];
    const tracker = data?.contentTracker ?? [];
    const flat = data?.flatPlan ?? [];
    const featuresConfirmed = features.filter(
      (f) => f.confirmed.toUpperCase() === "TRUE" || f.confirmed.toUpperCase() === "CONFIRMED"
    ).length;
    const adsBooked = ads.filter(
      (a) => a.confirmed.toUpperCase() === "TRUE" || a.confirmed.toUpperCase() === "CONFIRMED"
    ).length;
    const trackerReceived = tracker.filter(
      (t) => t.assetsReceived.toUpperCase() === "TRUE" || t.assetsReceived.toUpperCase() === "YES"
    ).length;
    const totalContent = tracker.length || 1;
    const contentReceivedPct = Math.round((trackerReceived / totalContent) * 100);
    const pagesAssigned = flat.reduce((sum, s) => {
      const m = s.pages.match(/(\d+)\s*-\s*(\d+)/);
      if (!m) return sum;
      return sum + (parseInt(m[2]) - parseInt(m[1]) + 1);
    }, 0);
    return {
      featuresConfirmed,
      featuresTotal: features.length,
      adsBooked,
      adsTotal: ads.length || 12,
      contentReceivedPct,
      pagesAssigned,
    };
  }, [data]);

  const timelineProgress = useMemo(() => {
    if (!issueTimeline.length) return { pct: 0, done: 0, total: 0, currentLabel: "" };
    const done = issueTimeline.filter((m) => m.status === "past").length;
    const today = issueTimeline.find((m) => m.status === "today");
    const pct = Math.round((done / issueTimeline.length) * 100);
    const currentLabel =
      today?.label ?? issueTimeline.find((m) => m.status === "future")?.label ?? "Complete";
    return { pct, done, total: issueTimeline.length, currentLabel };
  }, [issueTimeline]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#1D9E75]" />
      </div>
    );
  }

  if (!data || !data.connected) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-gray-50 px-6 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50">
          <AlertCircle className="h-8 w-8 text-amber-500" />
        </div>
        <h2 className="text-base font-semibold text-gray-900">Connect Google Sheets</h2>
        <p className="mt-2 max-w-md text-sm text-gray-500">
          {data?.error ??
            "The Print portal pulls live data from the Outlander Magazine master planning sheet. Connect your Google account in Admin → Settings to enable."}
        </p>
        <button
          onClick={() => load(true)}
          className="mt-4 flex items-center gap-1.5 rounded-lg bg-[#1D9E75] px-4 py-2 text-xs font-semibold text-white hover:bg-[#178563]"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-30 glass-header flex items-center justify-between px-6 py-3">
        <div>
          <h1 className="flex items-center gap-2 text-base font-semibold text-gray-900"><span className="h-2 w-2 rounded-full bg-[#1D9E75]" />Print — Outlander Magazine</h1>
          <p className="text-xs text-gray-500">
            {data.sheetTitle ?? "Master Planning"}
            {data.cached ? " · cached" : ""} · refreshed {new Date(data.fetchedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-gray-100 p-0.5">
            {ISSUES.map((iss) => (
              <button
                key={iss}
                onClick={() => setIssue(iss)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  issue === iss
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {iss}
              </button>
            ))}
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <a
            href={`https://docs.google.com/spreadsheets/d/1INpLAczQSTp0RdLV2_bPHC_2xO_Jhwy6MUDR2aALjZw`}
            target="_blank"
            rel="noopener"
            className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-700"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Sheet
          </a>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl space-y-8 px-6 py-6">
          {/* Overview */}
          <section id="overview" className="space-y-4 scroll-mt-20">
            {/* Timeline progress */}
            <div className="card-apple p-5">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Production Timeline</h2>
                  <p className="text-xs text-gray-500">
                    {issue} · {timelineProgress.done} of {timelineProgress.total} milestones complete · Now: {timelineProgress.currentLabel}
                  </p>
                </div>
                <span className="text-xs font-bold text-[#1D9E75]">{timelineProgress.pct}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#1D9E75] to-emerald-400 transition-all"
                  style={{ width: `${timelineProgress.pct}%` }}
                />
              </div>
            </div>

            {/* Stats cards */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <StatCard
                icon={<FileText className="h-4 w-4" />}
                label="Features Confirmed"
                value={`${stats.featuresConfirmed}`}
                subtext={`of ${stats.featuresTotal} total`}
              />
              <StatCard
                icon={<Megaphone className="h-4 w-4" />}
                label="Ad Slots Booked"
                value={`${stats.adsBooked}`}
                subtext={`of ${stats.adsTotal} slots`}
              />
              <StatCard
                icon={<CheckCircle2 className="h-4 w-4" />}
                label="Content Received"
                value={`${stats.contentReceivedPct}%`}
                subtext="assets in"
              />
              <StatCard
                icon={<Layers className="h-4 w-4" />}
                label="Pages Assigned"
                value={`${stats.pagesAssigned}`}
                subtext="across flat plan"
              />
            </div>

            {/* Quick links */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <QuickLink href="#timeline" label="Timeline" icon={<Calendar className="h-4 w-4" />} />
              <QuickLink href="#content-plan" label="Content Plan" icon={<FileText className="h-4 w-4" />} />
              <QuickLink href="#ad-tracker" label="Ad Tracker" icon={<Megaphone className="h-4 w-4" />} />
              <QuickLink href="#flat-plan" label="Flat Plan" icon={<Layers className="h-4 w-4" />} />
            </div>
          </section>

          {/* Timeline detail */}
          <section id="timeline" className="space-y-3 scroll-mt-20">
            <SectionHeader title="Timeline" subtitle={`Milestones for ${issue}`} />
            {issueTimeline.length === 0 ? (
              <EmptyState message="No timeline milestones found in the sheet." />
            ) : (
              <div className="card-apple p-5">
                <ol className="relative border-l border-gray-200 pl-6">
                  {issueTimeline.map((m, i) => (
                    <li key={i} className="mb-5 last:mb-0">
                      <span
                        className={`absolute -left-[7px] flex h-3.5 w-3.5 items-center justify-center rounded-full ring-4 ring-white ${
                          m.status === "past"
                            ? "bg-emerald-500"
                            : m.status === "today"
                              ? "bg-[#1D9E75]"
                              : "bg-gray-300"
                        }`}
                      >
                        {m.status === "today" && (
                          <span className="absolute h-3.5 w-3.5 animate-ping rounded-full bg-[#1D9E75] opacity-50" />
                        )}
                      </span>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p
                            className={`text-sm font-semibold ${
                              m.status === "past"
                                ? "text-gray-500 line-through"
                                : m.status === "today"
                                  ? "text-gray-900"
                                  : "text-gray-700"
                            }`}
                          >
                            {m.label}
                          </p>
                          <p className="text-xs text-gray-400">{formatDate(m.date) === "—" ? m.rawDate : formatDate(m.date)}</p>
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                            m.status === "past"
                              ? "bg-emerald-50 text-emerald-700"
                              : m.status === "today"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {m.status === "past" ? "Done" : m.status === "today" ? "Today" : "Upcoming"}
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </section>

          {/* Content Plan */}
          <section id="content-plan" className="space-y-3 scroll-mt-20">
            <SectionHeader
              title="Content Plan"
              subtitle={`${filteredFeatures.length} editorial features`}
              actions={
                <div className="flex items-center gap-2">
                  <FilterChip
                    icon={<Filter className="h-3 w-3" />}
                    value={featureFilter}
                    onChange={setFeatureFilter}
                    options={[
                      { value: "all", label: "All status" },
                      { value: "confirmed", label: "Confirmed" },
                      { value: "maybe", label: "Maybe" },
                      { value: "probs", label: "Probs not" },
                    ]}
                  />
                  <FilterChip
                    icon={<Tag className="h-3 w-3" />}
                    value={categoryFilter}
                    onChange={setCategoryFilter}
                    options={[
                      { value: "all", label: "All categories" },
                      ...categories.map((c) => ({ value: c, label: c })),
                    ]}
                  />
                </div>
              }
            />
            {filteredFeatures.length === 0 ? (
              <EmptyState message="No features match these filters." />
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {filteredFeatures.map((f, i) => {
                  const id = `${f.name}-${i}`;
                  const expanded = expandedFeature === id;
                  const conf = statusPill(f.confirmed);
                  const stat = statusPill(f.status);
                  return (
                    <button
                      key={id}
                      onClick={() => setExpandedFeature(expanded ? null : id)}
                      className="card-apple group flex flex-col p-4 text-left"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        {f.iconType ? (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                              ICON_TYPE_BADGES[f.iconType.toUpperCase()] ?? "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {f.iconType}
                          </span>
                        ) : (
                          <span className="text-[9px] text-gray-300">—</span>
                        )}
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${conf.className}`}>
                          {conf.label}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-gray-900">{f.name}</h3>
                      {f.description && (
                        <p
                          className={`mt-1 text-xs text-gray-500 ${expanded ? "" : "line-clamp-2"}`}
                        >
                          {f.description}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        {f.category && (
                          <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                            {f.category}
                          </span>
                        )}
                        {f.status && (
                          <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${stat.className}`}>
                            {stat.label}
                          </span>
                        )}
                      </div>
                      {(f.contact || (expanded && f.notes)) && (
                        <div className="mt-3 border-t border-gray-100 pt-2 text-[11px] text-gray-500">
                          {f.contact && (
                            <p>
                              <span className="text-gray-400">Contact:</span> {f.contact}
                            </p>
                          )}
                          {expanded && f.notes && (
                            <p className="mt-1 whitespace-pre-wrap">
                              <span className="text-gray-400">Notes:</span> {f.notes}
                            </p>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Ad Tracker */}
          <section id="ad-tracker" className="space-y-3 scroll-mt-20">
            <SectionHeader title="Ad Tracker" subtitle={`${data.adSlots.length} ad slots`} />
            {data.adSlots.length === 0 ? (
              <EmptyState message="No ad bookings found." />
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                {data.adSlots.map((slot, i) => {
                  const conf = statusPill(slot.confirmed);
                  return (
                    <div key={i} className="card-apple flex flex-col p-4">
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                          {slot.slot}
                        </span>
                        {slot.format && (
                          <span className="rounded bg-gray-900 px-1.5 py-0.5 text-[9px] font-bold text-white">
                            {slot.format}
                          </span>
                        )}
                      </div>
                      <h4 className="truncate text-sm font-semibold text-gray-900">
                        {slot.brand || <span className="text-gray-300">Unassigned</span>}
                      </h4>
                      {slot.category && (
                        <p className="mt-0.5 truncate text-[10px] text-gray-500">{slot.category}</p>
                      )}
                      <div className="mt-3 flex items-center justify-between">
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${conf.className}`}>
                          {conf.label}
                        </span>
                        {slot.status && (
                          <span className="text-[9px] uppercase tracking-wide text-gray-400">
                            {slot.status}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Flat Plan */}
          <section id="flat-plan" className="space-y-3 scroll-mt-20">
            <SectionHeader
              title="Flat Plan"
              subtitle={`${data.flatPlan.length} spreads · ${stats.pagesAssigned} pages assigned`}
            />
            {data.flatPlan.length === 0 ? (
              <EmptyState message="No flat plan assignments found." />
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3 text-[10px] text-gray-500">
                  {Object.entries(CATEGORY_COLORS).map(([cat, c]) => (
                    <span key={cat} className="flex items-center gap-1.5">
                      <span className={`h-2.5 w-2.5 rounded-full ${c.dot}`} />
                      <span>{cat}</span>
                    </span>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
                  {data.flatPlan.map((spread, i) => {
                    const c = CATEGORY_COLORS[spread.category] ?? CATEGORY_COLORS.Other;
                    return (
                      <div
                        key={i}
                        className={`flex flex-col rounded-xl p-3 ring-1 ${c.bg} ${c.text} ${c.ring}`}
                      >
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                          p. {spread.pages}
                        </span>
                        <p className="mt-1 text-xs font-semibold leading-snug">{spread.content}</p>
                        <span className="mt-2 text-[9px] uppercase tracking-wide opacity-60">
                          {spread.category}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </section>

          {/* Paid Features Pipeline */}
          <section id="paid-features" className="space-y-3 scroll-mt-20">
            <SectionHeader
              title="Paid Features"
              subtitle="360 Deals & Advertorials"
              actions={
                <p className="text-[11px] text-gray-400">
                  Paid features are tracked in the{" "}
                  <Link
                    href="/commercial/pipeline"
                    className="font-semibold text-[#D4A853] hover:underline"
                  >
                    Commercial pipeline
                  </Link>
                </p>
              }
            />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <PaidColumn
                title="360 Deals"
                items={data.paidFeatures.filter((p) => p.type === "360 Deal")}
              />
              <PaidColumn
                title="Advertorials"
                items={data.paidFeatures.filter((p) => p.type === "Advertorial")}
              />
            </div>
          </section>

          <div className="pb-12 pt-2 text-center text-[10px] text-gray-400">
            Source: {data.sheetTitle ?? "Outlander Magazine Master Planning"} ·{" "}
            {data.sheetNames.length} tabs detected
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  subtext,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext?: string;
}) {
  return (
    <div className="card-apple p-4">
      <div className="mb-2 flex items-center gap-2 text-gray-400">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <p className="font-mono-nums text-2xl font-bold text-gray-900">{value}</p>
      {subtext && <p className="mt-0.5 text-[10px] text-gray-500">{subtext}</p>}
    </div>
  );
}

function QuickLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="card-apple flex items-center gap-2 p-3 text-xs font-semibold text-gray-700 hover:text-[#1D9E75]"
    >
      <span className="text-[#1D9E75]">{icon}</span>
      <span>{label}</span>
    </a>
  );
}

function SectionHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="card-apple flex flex-col items-center justify-center px-6 py-10 text-center">
      <Circle className="mb-2 h-6 w-6 text-gray-300" />
      <p className="text-xs text-gray-500">{message}</p>
    </div>
  );
}

function FilterChip({
  icon,
  value,
  onChange,
  options,
}: {
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-600">
      <span className="text-gray-400">{icon}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent font-medium text-gray-700 focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function PaidColumn({ title, items }: { title: string; items: PaidFeature[] }) {
  return (
    <div className="card-apple p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <span className="text-[10px] text-gray-400">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="py-6 text-center text-xs text-gray-400">No items.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((p, i) => {
            const s = statusPill(p.status);
            return (
              <li
                key={i}
                className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-gray-900">{p.brand}</p>
                  {p.notes && <p className="truncate text-[10px] text-gray-500">{p.notes}</p>}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold ${s.className}`}
                >
                  {s.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

