"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Loader2, Sparkles, X } from "lucide-react";
import { IgPost } from "../../_components/types";
import { brandColor, compactNumber, formatDate } from "../../_components/utils";

interface BrandDetailData {
  brand: string;
  stats: {
    totalPosts: number;
    totalReach: number;
    totalLikes: number;
    totalComments: number;
    avgEngagement: number;
  };
  bestPost: IgPost | null;
  timeline: { month: string; posts: number; reach: number }[];
  posts: IgPost[];
}

interface Props {
  name: string;
  onClose: () => void;
}

export default function BrandDetail({ name, onClose }: Props) {
  const [data, setData] = useState<BrandDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(`/api/content-tracker/brands/${encodeURIComponent(name)}`)
      .then((r) => r.json())
      .then((j) => {
        if (live) {
          setData(j);
          setLoading(false);
        }
      })
      .catch(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [name]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function generateReport() {
    if (!data) return;
    setReporting(true);
    const { stats, bestPost, posts } = data;
    const lines: string[] = [];
    lines.push(`${name} — Performance Summary`);
    lines.push("");
    lines.push(
      `${stats.totalPosts} post${stats.totalPosts === 1 ? "" : "s"} tagged ` +
        `with ${name} reached ${compactNumber(stats.totalReach)} accounts ` +
        `with an average engagement rate of ${stats.avgEngagement.toFixed(2)}%.`
    );
    lines.push("");
    lines.push(
      `Total likes: ${compactNumber(stats.totalLikes)} · ` +
        `Total comments: ${compactNumber(stats.totalComments)}.`
    );
    if (bestPost) {
      lines.push("");
      lines.push(
        `Best performing post (${bestPost.engagementRate.toFixed(2)}% engagement): ` +
          `"${(bestPost.caption ?? "").slice(0, 120)}"`
      );
    }
    const paid = posts.filter((p) => p.postType === "PAID").length;
    const editorial = posts.filter((p) => p.postType === "EDITORIAL").length;
    const organic = posts.filter((p) => p.postType === "ORGANIC").length;
    if (paid + editorial + organic > 0) {
      lines.push("");
      lines.push(
        `Mix: ${paid} paid, ${editorial} editorial, ${organic} organic ` +
          `(plus ${posts.length - paid - editorial - organic} other).`
      );
    }
    setReport(lines.join("\n"));
    setReporting(false);
  }

  const c = brandColor(name);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="my-8 w-full max-w-5xl rounded-2xl bg-white dark:bg-gray-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-gray-100 dark:border-gray-800 p-5">
          <div>
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-sm font-medium ${c.bg} ${c.text} ${c.border}`}
            >
              {name}
            </span>
            <h2 className="mt-2 text-xl font-semibold text-gray-900 dark:text-gray-100">Brand Performance</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-400"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading || !data ? (
          <div className="flex h-64 items-center justify-center text-gray-400 dark:text-gray-500">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-5 p-5">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              <Big label="Posts" value={String(data.stats.totalPosts)} />
              <Big label="Total reach" value={compactNumber(data.stats.totalReach)} />
              <Big label="Total likes" value={compactNumber(data.stats.totalLikes)} />
              <Big label="Comments" value={compactNumber(data.stats.totalComments)} />
              <Big label="Avg engagement" value={`${data.stats.avgEngagement.toFixed(2)}%`} />
            </div>

            <div>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Reach over time
              </h3>
              <Timeline timeline={data.timeline} />
            </div>

            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Performance Summary
              </h3>
              <button
                onClick={generateReport}
                disabled={reporting}
                className="inline-flex items-center gap-1 rounded-lg bg-[#111111] px-3 py-1.5 text-xs font-medium text-white dark:bg-white dark:text-black shadow-sm hover:bg-[#111111] dark:hover:bg-white disabled:opacity-60"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Generate Report
              </button>
            </div>
            {report && (
              <pre className="whitespace-pre-wrap rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4 text-sm leading-relaxed text-gray-800 dark:text-gray-200">
                {report}
              </pre>
            )}

            <div>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                All posts ({data.posts.length})
              </h3>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-6">
                {data.posts.map((p) => (
                  <a
                    key={p.id}
                    href={p.permalink ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative aspect-square overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800"
                  >
                    {p.thumbnailUrl || p.mediaUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.thumbnailUrl || p.mediaUrl || ""}
                        alt=""
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : null}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                      <div className="flex items-center justify-between">
                        <span>{formatDate(p.timestamp)}</span>
                        <ExternalLink className="h-3 w-3" />
                      </div>
                      <div>
                        {compactNumber(p.likeCount)} likes · {p.engagementRate.toFixed(1)}%
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Big({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3">
      <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">{value}</p>
    </div>
  );
}

function Timeline({
  timeline,
}: {
  timeline: { month: string; posts: number; reach: number }[];
}) {
  if (timeline.length === 0) {
    return <p className="text-sm text-gray-400 dark:text-gray-500">No timeline data yet.</p>;
  }
  const max = Math.max(...timeline.map((t) => t.reach), 1);
  return (
    <div className="flex h-32 items-end gap-2 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 p-3">
      {timeline.map((t) => (
        <div key={t.month} className="flex flex-1 flex-col items-center gap-1">
          <div className="text-[10px] text-gray-500 dark:text-gray-400">{compactNumber(t.reach)}</div>
          <div
            className="w-full rounded-t bg-[#9C7C2E]/80 dark:bg-[#C9A44A]/80"
            style={{ height: `${(t.reach / max) * 100}%`, minHeight: "2px" }}
            title={`${t.month}: ${t.posts} posts, ${compactNumber(t.reach)} reach`}
          />
          <div className="text-[10px] text-gray-500 dark:text-gray-400">{t.month.slice(5)}</div>
        </div>
      ))}
    </div>
  );
}
