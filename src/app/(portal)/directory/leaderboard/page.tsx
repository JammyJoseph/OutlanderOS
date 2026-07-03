"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Trophy,
  Loader2,
  Users,
  Handshake,
  Network as NetworkIcon,
  Crown,
} from "lucide-react";
import { CONTACT_CATEGORIES, DIRECTORY_ACCENT } from "@/lib/directory";
import { igHandle, fmtFollowers } from "@/lib/directory-utils";
import { InstagramIcon as Instagram } from "@/components/icons/InstagramIcon";

const ACCENT = DIRECTORY_ACCENT;

interface LeaderboardEntry {
  id: string;
  name: string;
  category: string;
  instagram: string | null;
  followers: number | null;
  profilePic: string | null;
  confidence: "VERIFIED" | "LIKELY" | "UNVERIFIED" | null;
  scannedAt: string | null;
  collaborationCount: number;
  creditCount: number;
  networkSize: number;
  recencyBonus: number;
  score: number;
}

type Period = "30" | "90" | "all";

// Gold / silver / bronze accents for the podium (top 3).
const MEDALS: Record<number, { color: string; label: string }> = {
  1: { color: "#f5b301", label: "1st" },
  2: { color: "#9ca3af", label: "2nd" },
  3: { color: "#cd7f32", label: "3rd" },
};

const PERIODS: { key: Period; label: string }[] = [
  { key: "30", label: "Last 30 days" },
  { key: "90", label: "Last 90 days" },
  { key: "all", label: "All time" },
];

// Quick-access category chips called out in the brief, then the full list.
const QUICK_CATEGORIES = ["Photographer", "Stylist", "MUA"];

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("all");
  const [category, setCategory] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (period !== "all") params.set("period", period);
    if (category !== "all") params.set("category", category);
    const res = await fetch(`/api/directory/leaderboard?${params.toString()}`);
    const data = await res.json();
    setEntries(Array.isArray(data.entries) ? data.entries : []);
    setLoading(false);
  }, [period, category]);

  useEffect(() => {
    load();
  }, [load]);

  const podium = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <div className="min-h-full px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/directory"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
        >
          <ArrowLeft size={15} /> Back to directory
        </Link>

        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <span
            className="flex h-11 w-11 items-center justify-center rounded-2xl"
            style={{ backgroundColor: `${ACCENT}1a`, color: ACCENT }}
          >
            <Trophy size={20} />
          </span>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
              Leaderboard
            </h1>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              The hottest creatives, ranked by collaborations, credits and reach.
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          {/* Period toggle */}
          <div className="inline-flex rounded-xl border border-border bg-card p-1">
            {PERIODS.map((p) => {
              const active = period === p.key;
              return (
                <button
                  key={p.key}
                  onClick={() => setPeriod(p.key)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-secondary text-gray-900 dark:text-gray-100"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                  }`}
                  style={active ? { boxShadow: `inset 0 0 0 1px ${ACCENT}33` } : undefined}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Quick category chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setCategory("all")}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                category === "all"
                  ? "border-[var(--ring)] text-gray-900 dark:text-gray-100"
                  : "border-border text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              }`}
            >
              All
            </button>
            {QUICK_CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  category === c
                    ? "border-[var(--ring)] text-gray-900 dark:text-gray-100"
                    : "border-border text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                }`}
              >
                Top {c}s
              </button>
            ))}
          </div>

          {/* Full category dropdown */}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="ml-auto rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 outline-none focus:border-[var(--ring)]"
          >
            <option value="all">All categories</option>
            {CONTACT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="animate-spin text-gray-600 dark:text-gray-400" size={24} />
          </div>
        ) : entries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-20 text-center">
            <Trophy size={28} className="mx-auto mb-3 text-gray-400 dark:text-gray-500" />
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">No ranked creatives yet</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Scan Instagram profiles to build up collaboration and credit data.
            </p>
          </div>
        ) : (
          <>
            {/* Podium — top 3 */}
            {podium.length > 0 && (
              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {podium.map((e, i) => (
                  <PodiumCard key={e.id} entry={e} rank={i + 1} />
                ))}
              </div>
            )}

            {/* The rest */}
            {rest.length > 0 && (
              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                {rest.map((e, i) => (
                  <LeaderboardRow key={e.id} entry={e} rank={i + 4} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Avatar({
  entry,
  size,
}: {
  entry: LeaderboardEntry;
  size: number;
}) {
  if (entry.profilePic) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={entry.profilePic}
        alt={entry.name}
        referrerPolicy="no-referrer"
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-gray-500 dark:text-gray-400"
      style={{ width: size, height: size }}
    >
      {entry.name.slice(0, 2).toUpperCase()}
    </span>
  );
}

function PodiumCard({ entry, rank }: { entry: LeaderboardEntry; rank: number }) {
  const medal = MEDALS[rank];
  const handle = igHandle(entry.instagram);
  const followers = fmtFollowers(entry.followers);
  return (
    <Link
      href={`/directory/${entry.id}`}
      className="group relative flex flex-col items-center gap-3 rounded-2xl border bg-card p-5 text-center transition-colors hover:border-[var(--ring)]"
      style={{ borderColor: `${medal.color}66` }}
    >
      {/* Rank badge */}
      <span
        className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
        style={{ backgroundColor: medal.color }}
      >
        {rank}
      </span>
      {rank === 1 && (
        <Crown
          size={18}
          className="absolute right-3 top-3"
          style={{ color: medal.color }}
        />
      )}

      <div className="relative mt-2">
        <span
          className="block rounded-full p-0.5"
          style={{ boxShadow: `0 0 0 2px ${medal.color}` }}
        >
          <Avatar entry={entry} size={64} />
        </span>
      </div>

      <div className="min-w-0">
        <p className="truncate text-base font-semibold text-gray-900 dark:text-gray-100">{entry.name}</p>
        <span className="mt-1 inline-flex items-center rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
          {entry.category}
        </span>
      </div>

      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
        <span className="inline-flex items-center gap-1" title="Collaborators">
          <Handshake size={12} /> {entry.collaborationCount}
        </span>
        {followers && (
          <span className="inline-flex items-center gap-1" title="Followers">
            <Users size={12} /> {followers}
          </span>
        )}
      </div>

      <span
        className="rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums"
        style={{ backgroundColor: `${medal.color}22`, color: medal.color }}
      >
        {entry.score} pts
      </span>
    </Link>
  );
}

function LeaderboardRow({ entry, rank }: { entry: LeaderboardEntry; rank: number }) {
  const handle = igHandle(entry.instagram);
  const followers = fmtFollowers(entry.followers);
  return (
    <Link
      href={`/directory/${entry.id}`}
      className="flex items-center gap-3 border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-secondary/50"
    >
      <span className="w-7 shrink-0 text-center text-sm font-bold tabular-nums text-gray-400 dark:text-gray-500">
        {rank}
      </span>
      <Avatar entry={entry} size={40} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{entry.name}</p>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {entry.category}
          </span>
          {handle && (
            <span className="inline-flex items-center gap-1 truncate text-[11px] font-medium text-[#dc2743]">
              <Instagram size={10} /> @{handle}
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="hidden items-center gap-4 text-xs text-gray-500 dark:text-gray-400 sm:flex">
        <span className="inline-flex items-center gap-1" title="Collaborators">
          <Handshake size={12} /> {entry.collaborationCount}
        </span>
        <span className="inline-flex items-center gap-1" title="Network connections">
          <NetworkIcon size={12} /> {entry.networkSize}
        </span>
        {followers && (
          <span className="inline-flex items-center gap-1" title="Followers">
            <Users size={12} /> {followers}
          </span>
        )}
      </div>

      <span
        className="ml-1 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums"
        style={{ backgroundColor: `${ACCENT}1a`, color: ACCENT }}
      >
        {entry.score}
      </span>
    </Link>
  );
}
