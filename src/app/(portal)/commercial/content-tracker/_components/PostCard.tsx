"use client";

import { Heart, MessageCircle, Eye, Film, Image as ImageIcon, Layers, Video } from "lucide-react";
import { IgPost } from "./types";
import { brandColor, postTypeStyle, compactNumber, formatDate } from "./utils";

interface Props {
  post: IgPost;
  selected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onToggleSelect: (e: React.MouseEvent) => void;
  onClickBrand: (b: string) => void;
}

function MediaTypeIcon({ type }: { type: string }) {
  switch (type) {
    case "REEL":
      return <Film className="h-3.5 w-3.5" />;
    case "VIDEO":
      return <Video className="h-3.5 w-3.5" />;
    case "CAROUSEL_ALBUM":
      return <Layers className="h-3.5 w-3.5" />;
    default:
      return <ImageIcon className="h-3.5 w-3.5" />;
  }
}

export default function PostCard({
  post,
  selected,
  onSelect,
  onToggleSelect,
  onClickBrand,
}: Props) {
  const typeStyle = postTypeStyle(post.postType);
  const isUnclassified = post.postType === "UNCLASSIFIED";
  const thumb = post.thumbnailUrl || post.mediaUrl;
  const captionSnippet = post.caption
    ? post.caption.replace(/\s+/g, " ").slice(0, 80) + (post.caption.length > 80 ? "…" : "")
    : "(no caption)";

  return (
    <div
      onClick={onSelect}
      className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border bg-white transition-shadow hover:shadow-md ${
        isUnclassified ? "border-rose-300/60 ring-1 ring-rose-100" : "border-gray-200"
      } ${selected ? "ring-2 ring-amber-400" : ""}`}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-gray-100">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt=""
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-400">
            <ImageIcon className="h-8 w-8" />
          </div>
        )}
        <div className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white">
          <MediaTypeIcon type={post.mediaType} />
        </div>
        <button
          onClick={onToggleSelect}
          aria-label="Select post"
          className={`absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-md border-2 transition-colors ${
            selected
              ? "border-amber-500 bg-amber-500 text-white"
              : "border-white/80 bg-black/30 text-transparent hover:bg-black/50"
          }`}
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
            <path d="M16.7 5.3a1 1 0 0 0-1.4 0L8 12.6 4.7 9.3a1 1 0 0 0-1.4 1.4l4 4a1 1 0 0 0 1.4 0l8-8a1 1 0 0 0 0-1.4z" />
          </svg>
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="text-sm leading-snug text-gray-900 line-clamp-2">{captionSnippet}</p>
        <p className="text-xs text-gray-500">{formatDate(post.timestamp)}</p>
        <div className="flex items-center gap-3 text-xs text-gray-600">
          <span className="inline-flex items-center gap-1">
            <Heart className="h-3.5 w-3.5" /> {compactNumber(post.likeCount)}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageCircle className="h-3.5 w-3.5" /> {compactNumber(post.commentCount)}
          </span>
          {post.reachCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" /> {compactNumber(post.reachCount)}
            </span>
          )}
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${typeStyle.cls}`}
          >
            {typeStyle.label}
          </span>
          {post.brands.slice(0, 3).map((b) => {
            const c = brandColor(b);
            return (
              <button
                key={b}
                onClick={(e) => {
                  e.stopPropagation();
                  onClickBrand(b);
                }}
                className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${c.bg} ${c.text} ${c.border} hover:opacity-80`}
              >
                {b}
              </button>
            );
          })}
          {post.brands.length > 3 && (
            <span className="text-[10px] text-gray-400">+{post.brands.length - 3}</span>
          )}
        </div>
      </div>
    </div>
  );
}
