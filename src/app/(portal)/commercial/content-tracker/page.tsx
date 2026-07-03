"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, BarChart2 } from "lucide-react";
import PostCard from "./_components/PostCard";
import PostModal from "./_components/PostModal";
import FilterBar, { Filters } from "./_components/FilterBar";
import BulkActionBar from "./_components/BulkActionBar";
import { BrandSummary, IgPost, PipelineCard } from "./_components/types";

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
  const [brands, setBrands] = useState<BrandSummary[]>([]);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openPost, setOpenPost] = useState<IgPost | null>(null);
  const lastClickIndex = useRef<number | null>(null);

  // Native pipeline replaces the old Trello campaign list — empty until rebuilt.
  const campaigns: PipelineCard[] = [];

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
    loadBrands();
  }, [loadBrands]);

  useEffect(() => {
    const t = setTimeout(loadPosts, 200);
    return () => clearTimeout(t);
  }, [loadPosts]);

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
    loadBrands();
  }

  const selectedIds = useMemo(() => Array.from(selected), [selected]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-6 font-[Manrope,system-ui,sans-serif]">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Content Tracker</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Track every post, classify it, attribute it to brands and campaigns.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/commercial/content-tracker/brands"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <BarChart2 className="h-4 w-4" />
            Brand Performance
          </Link>
        </div>
      </div>

      <div className="mb-4">
        <FilterBar filters={filters} brands={brands} onChange={setFilters} />
      </div>

      <div className="mb-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>
          {loading ? "Loading…" : `${posts.length} of ${total} posts`}
          {filters.brand && ` · brand: ${filters.brand}`}
        </span>
        <span className="hidden md:inline">
          Tip: shift-click for range, ⌘/Ctrl-click to multi-select
        </span>
      </div>

      {loading && posts.length === 0 ? (
        <div className="flex h-64 items-center justify-center text-gray-400 dark:text-gray-500">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400">
          <p className="text-sm">No posts found.</p>
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
