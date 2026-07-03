"use client";

import { useEffect, useState } from "react";
import {
  ExternalLink,
  Heart,
  MessageCircle,
  Bookmark,
  Share2,
  Eye,
  TrendingUp,
  X,
  Plus,
} from "lucide-react";
import { IgPost, POST_TYPES, PipelineCard } from "./types";
import { brandColor, compactNumber, postTypeStyle } from "./utils";

interface Props {
  post: IgPost;
  campaigns: PipelineCard[];
  onClose: () => void;
  onSave: (updated: IgPost) => void;
}

export default function PostModal({ post, campaigns, onClose, onSave }: Props) {
  const [brands, setBrands] = useState<string[]>(post.brands);
  const [postType, setPostType] = useState<string>(post.postType);
  const [campaignId, setCampaignId] = useState<string | null>(post.campaignId);
  const [campaignName, setCampaignName] = useState<string | null>(post.campaignName);
  const [notes, setNotes] = useState<string>(post.notes ?? "");
  const [newBrand, setNewBrand] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function addBrand() {
    const v = newBrand.trim();
    if (!v) return;
    if (brands.some((b) => b.toLowerCase() === v.toLowerCase())) {
      setNewBrand("");
      return;
    }
    setBrands([...brands, v]);
    setNewBrand("");
  }

  function removeBrand(b: string) {
    setBrands(brands.filter((x) => x !== b));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/content-tracker/${post.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brands,
          postType,
          campaignId,
          campaignName,
          notes: notes.trim() || null,
        }),
      });
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      const updated = await res.json();
      onSave(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const thumb = post.thumbnailUrl || post.mediaUrl;
  const typeStyle = postTypeStyle(postType);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="my-8 grid w-full max-w-5xl grid-cols-1 overflow-hidden rounded-2xl bg-white dark:bg-gray-900 shadow-2xl md:grid-cols-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative aspect-square bg-black md:aspect-auto md:max-h-[80vh]">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="" className="h-full w-full object-contain" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-gray-400">
              No media
            </div>
          )}
        </div>
        <div className="flex max-h-[80vh] flex-col overflow-y-auto">
          <div className="flex items-start justify-between border-b border-gray-100 dark:border-gray-800 p-5">
            <div>
              <span
                className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${typeStyle.cls}`}
              >
                {typeStyle.label}
              </span>
              <h2 className="mt-2 text-xs uppercase tracking-wider text-gray-400">
                {post.mediaType.replace("_", " ")} · {new Date(post.timestamp).toLocaleString()}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-400"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4 p-5">
            <div>
              <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Caption
              </h3>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-900 dark:text-gray-100">
                {post.caption || "(no caption)"}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 border-y border-gray-100 dark:border-gray-800 py-3 text-center">
              <Stat icon={<Heart className="h-3.5 w-3.5" />} label="Likes" value={post.likeCount} />
              <Stat icon={<MessageCircle className="h-3.5 w-3.5" />} label="Comments" value={post.commentCount} />
              <Stat icon={<Eye className="h-3.5 w-3.5" />} label="Reach" value={post.reachCount} />
              <Stat icon={<Bookmark className="h-3.5 w-3.5" />} label="Saves" value={post.savesCount} />
              <Stat icon={<Share2 className="h-3.5 w-3.5" />} label="Shares" value={post.sharesCount} />
              <Stat
                icon={<TrendingUp className="h-3.5 w-3.5" />}
                label="Engage"
                value={`${post.engagementRate.toFixed(2)}%`}
              />
            </div>

            <div>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Brands
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {brands.map((b) => {
                  const c = brandColor(b);
                  return (
                    <span
                      key={b}
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs ${c.bg} ${c.text} ${c.border}`}
                    >
                      {b}
                      <button onClick={() => removeBrand(b)} className="hover:opacity-70">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })}
                <div className="flex items-center gap-1">
                  <input
                    value={newBrand}
                    onChange={(e) => setNewBrand(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addBrand())}
                    placeholder="Add brand"
                    className="rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1 text-xs outline-none focus:border-amber-400"
                  />
                  <button
                    onClick={addBrand}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Post Type
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {POST_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setPostType(t)}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      postType === t
                        ? "border-amber-500 bg-amber-50 text-amber-900"
                        : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
                    }`}
                  >
                    {t.charAt(0) + t.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Campaign
              </h3>
              <select
                value={campaignId ?? ""}
                onChange={(e) => {
                  const id = e.target.value || null;
                  setCampaignId(id);
                  const c = campaigns.find((x) => x.id === id);
                  setCampaignName(c?.name ?? null);
                }}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm outline-none focus:border-amber-400"
              >
                <option value="">— Unassigned —</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.client ? `${c.client} · ${c.name}` : c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Notes
              </h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm outline-none focus:border-amber-400"
                placeholder="Internal notes…"
              />
            </div>
          </div>

          <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-5 py-3">
            {post.permalink ? (
              <a
                href={post.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Open on Instagram
              </a>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              {error && <span className="text-xs text-rose-600">{error}</span>}
              <button
                onClick={onClose}
                className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="rounded-lg bg-[#ffd700] px-4 py-1.5 text-sm font-medium text-black shadow-sm hover:bg-[#e6c200] disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <div>
      <div className="flex items-center justify-center gap-1 text-xs text-gray-500 dark:text-gray-400">
        {icon} {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-gray-100">
        {typeof value === "number" ? compactNumber(value) : value}
      </div>
    </div>
  );
}
