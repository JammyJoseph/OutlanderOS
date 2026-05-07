"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, RefreshCw, AlertCircle, BarChart2 } from "lucide-react";
import PostCard from "./_components/PostCard";
import PostModal from "./_components/PostModal";
import FilterBar, { Filters } from "./_components/FilterBar";
import BulkActionBar from "./_components/BulkActionBar";
import { AccountSummary, BrandSummary, IgPost, PipelineCard } from "./_components/types";
import { compactNumber, timeAgo } from "./_components/utils";

const DEFAULT_FILTERS: Filters = {
  search: "",
  brand: "",
  postType: "ALL",
  mediaType: "ALL",
  dateFrom: "",
  dateTo: "",
  sort: "date",
};

export default function ContentTrackerPage() {
  const [posts, setPosts] = useState<IgPost[]>([]);
  const [total, setTotal] = useState(0);
  const [account, setAccount] = useState<AccountSummary | null>(null);
  const [brands, setBrands] = useState<BrandSummary[]>([]);
  const [campaigns, setCampaigns] = useState<PipelineCard[]>([]);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openPost, setOpenPost] = useState<IgPost | null>(null);
  const lastClickIndex = useRef<number | null>(null);

  const loadAccount = useCallback(async () => {
    try {
      const r = await fetch("/api/instagram/sync");
      if (r.ok) setAccount(await r.json());
    } catch {
      /* ignore */
    }
  }, []);

  const loadBrands = useCallback(async () => {
    try {
      const r = await fetch("/api/content-tracker/brands");
      if (r.ok) {
        const j = await r.json();
        setBrands(j.brands ?? []);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const loadCampaigns = useCallback(async () => {
    try {
      const r = await fetch("/api/trello");
      if (!r.ok) return;
      const j = await r.json();
      const cards: PipelineCard[] = [];
      for (const stage of j.stages ?? []) {
        for (const c of stage.cards ?? []) {
          cards.push({ id: c.id, name: c.name, client: c.client ?? "" });
        }
      }
      setCampaigns(cards);
    } catch {
      /* ignore */
    }
  }, []);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.search) params.set("search", filters.search);
      if (filters.brand) params.set("brand", filters.brand);
      if (filters.postType !== "ALL") params.set("postType", filters.postType);
      if (filters.mediaType !== "ALL") params.set("mediaType", filters.mediaType);
      if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
      if (filters.dateTo) params.set("dateTo", filters.dateTo);
      params.set("sort", filters.sort);
      params.set("limit", "120");

      const r = await fetch(`/api/content-tracker?${params.toString()}`);
      const j = await r.json();
      setPosts(j.posts ?? []);
      setTotal(j.total ?? 0);
    } catch {
      setPosts([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadAccount();
    loadBrands();
    loadCampaigns();
  }, [loadAccount, loadBrands, loadCampaigns]);

  useEffect(() => {
    const t = setTimeout(loadPosts, 200);
    return () => clearTimeout(t);
  }, [loadPosts]);

  async function runSync() {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const r = await fetch("/api/instagram/sync", { method: "POST" });
      const j = await r.json();
      if (!r.ok || !j.ok) {
        setSyncMessage(
          j.errors?.[0] || j.error || "Sync failed — check Instagram credentials."
        );
      } else {
        setSyncMessage(
          `Synced ${j.fetched} posts (${j.inserted} new, ${j.updated} updated)`
        );
      }
      await Promise.all([loadAccount(), loadBrands(), loadPosts()]);
    } catch (e) {
      setSyncMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncing(false);
    }
  }

  function handleCardClick(post: IgPost, index: number, e: React.MouseEvent) {
    if (e.shiftKey && lastClickIndex.current !== null) {
      const start = Math.min(lastClickIndex.current, index);
      const end = Math.max(lastClickIndex.current, index);
      const next = new Set(selected);
      for (let i = start; i <= end; i++) next.add(posts[i].id);
      setSelected(next);
      return;
    }
    if (e.metaKey || e.ctrlKey) {
      const next = new Set(selected);
      if (next.has(post.id)) next.delete(post.id);
      else next.add(post.id);
      setSelected(next);
      lastClickIndex.current = index;
      return;
    }
    setOpenPost(post);
  }

  function toggleSelect(post: IgPost, index: number, e: React.MouseEvent) {
    e.stopPropagation();
    const next = new Set(selected);
    if (next.has(post.id)) next.delete(post.id);
    else next.add(post.id);
    setSelected(next);
    lastClickIndex.current = index;
  }

  function onPostSaved(updated: IgPost) {
    setPosts((arr) => arr.map((p) => (p.id === updated.id ? updated : p)));
    setOpenPost(null);
    loadAccount();
    loadBrands();
  }

  const selectedIds = useMemo(() => Array.from(selected), [selected]);
  const unclassified = account?.unclassifiedCount ?? 0;

  return (
    <div className="mx-auto max-w-7xl px-6 py-6 font-[Manrope,system-ui,sans-serif]">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Content Tracker</h1>
          <p className="mt-1 text-sm text-gray-500">
            Track every post, classify it, attribute it to brands and campaigns.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/commercial/content-tracker/brands"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <BarChart2 className="h-4 w-4" />
            Brand Performance
          </Link>
          <button
            onClick={runSync}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#D4A853] px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#c29846] disabled:opacity-60"
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {syncing ? "Syncing…" : "Sync"}
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Account"
          value={account?.username ? `@${account.username}` : "Not connected"}
          avatar={account?.profilePicture}
        />
        <StatCard label="Total posts" value={compactNumber(account?.postCount ?? 0)} />
        <StatCard
          label="Need tagging"
          value={String(unclassified)}
          highlight={unclassified > 0}
        />
        <StatCard
          label="Last synced"
          value={account?.lastSyncedAt ? timeAgo(account.lastSyncedAt) : "Never"}
        />
      </div>

      {syncMessage && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{syncMessage}</span>
        </div>
      )}

      <div className="mb-4">
        <FilterBar filters={filters} brands={brands} onChange={setFilters} />
      </div>

      <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
        <span>
          {loading ? "Loading…" : `${posts.length} of ${total} posts`}
          {filters.brand && ` · brand: ${filters.brand}`}
        </span>
        <span className="hidden md:inline">
          Tip: shift-click for range, ⌘/Ctrl-click to multi-select
        </span>
      </div>

      {loading && posts.length === 0 ? (
        <div className="flex h-64 items-center justify-center text-gray-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white text-gray-500">
          <p className="text-sm">No posts found.</p>
          {!account?.accountId && (
            <p className="mt-2 text-xs">
              Set <code>INSTAGRAM_ACCESS_TOKEN</code> and{" "}
              <code>INSTAGRAM_BUSINESS_ACCOUNT_ID</code>, then click Sync.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {posts.map((p, i) => (
            <PostCard
              key={p.id}
              post={p}
              selected={selected.has(p.id)}
              onSelect={(e) => handleCardClick(p, i, e)}
              onToggleSelect={(e) => toggleSelect(p, i, e)}
              onClickBrand={(b) => setFilters({ ...filters, brand: b })}
            />
          ))}
        </div>
      )}

      {selectedIds.length > 0 && (
        <BulkActionBar
          selectedIds={selectedIds}
          campaigns={campaigns}
          onClear={() => setSelected(new Set())}
          onComplete={() => {
            setSelected(new Set());
            loadPosts();
            loadBrands();
            loadAccount();
          }}
        />
      )}

      {openPost && (
        <PostModal
          post={openPost}
          campaigns={campaigns}
          onClose={() => setOpenPost(null)}
          onSave={onPostSaved}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  avatar,
  highlight,
}: {
  label: string;
  value: string;
  avatar?: string | null;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border bg-white p-4 ${
        highlight ? "border-amber-300" : "border-gray-200"
      }`}
    >
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
      ) : null}
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wider text-gray-500">{label}</p>
        <p
          className={`truncate text-lg font-semibold ${
            highlight ? "text-amber-700" : "text-gray-900"
          }`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
