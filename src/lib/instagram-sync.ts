import prisma from "./prisma";

const GRAPH_API_VERSION = process.env.IG_GRAPH_VERSION || "v21.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export interface InstagramSyncReport {
  ok: boolean;
  accountId: string | null;
  fetched: number;
  inserted: number;
  updated: number;
  errors: string[];
  durationMs: number;
}

interface IgMedia {
  id: string;
  caption?: string;
  media_type: string;
  media_product_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
}

interface IgInsightValue {
  value: number;
}

interface IgInsightItem {
  name: string;
  values: IgInsightValue[];
}

interface IgPagedResponse<T> {
  data: T[];
  paging?: {
    cursors?: { after?: string };
    next?: string;
  };
}

const MEDIA_FIELDS =
  "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count";

function getCreds(): { token: string; accountId: string } | null {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN || process.env.IG_ACCESS_TOKEN;
  const accountId =
    process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID ||
    process.env.IG_BUSINESS_ACCOUNT_ID ||
    process.env.IG_USER_ID;
  if (!token || !accountId) return null;
  return { token, accountId };
}

async function igFetch<T>(path: string, token: string): Promise<T> {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${GRAPH_API_BASE}${path}${sep}access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`IG API ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

async function fetchAllMedia(accountId: string, token: string): Promise<IgMedia[]> {
  const all: IgMedia[] = [];
  let next: string | null = `/${accountId}/media?fields=${MEDIA_FIELDS}&limit=50`;
  let pages = 0;
  const maxPages = 40;

  while (next && pages < maxPages) {
    const page: IgPagedResponse<IgMedia> = await igFetch<IgPagedResponse<IgMedia>>(next, token);
    all.push(...page.data);
    pages += 1;
    if (page.paging?.next) {
      const u = new URL(page.paging.next);
      next = `${u.pathname}${u.search}`.replace(`/${GRAPH_API_VERSION}`, "");
    } else {
      next = null;
    }
  }
  return all;
}

async function fetchInsights(
  mediaId: string,
  mediaType: string,
  token: string
): Promise<{ reach: number; saves: number; shares: number; views: number }> {
  const isVideoLike = mediaType === "VIDEO" || mediaType === "REEL";
  const metrics = isVideoLike
    ? "reach,saved,shares,plays,total_interactions"
    : "reach,saved,shares";
  try {
    const res = await igFetch<IgPagedResponse<IgInsightItem>>(
      `/${mediaId}/insights?metric=${metrics}`,
      token
    );
    const get = (n: string): number => {
      const item = res.data.find((d) => d.name === n);
      return item?.values?.[0]?.value ?? 0;
    };
    return {
      reach: get("reach"),
      saves: get("saved"),
      shares: get("shares"),
      views: isVideoLike ? get("plays") : 0,
    };
  } catch {
    return { reach: 0, saves: 0, shares: 0, views: 0 };
  }
}

function normalizeMediaType(media_type: string, media_product_type?: string): string {
  if (media_product_type === "REELS") return "REEL";
  return media_type;
}

function calcEngagementRate(
  likes: number,
  comments: number,
  saves: number,
  shares: number,
  reach: number
): number {
  if (!reach) return 0;
  const eng = likes + comments + saves + shares;
  return Math.round((eng / reach) * 10000) / 100;
}

export async function runInstagramSync(): Promise<InstagramSyncReport> {
  const startedAt = Date.now();
  const report: InstagramSyncReport = {
    ok: false,
    accountId: null,
    fetched: 0,
    inserted: 0,
    updated: 0,
    errors: [],
    durationMs: 0,
  };

  const creds = getCreds();
  if (!creds) {
    report.errors.push(
      "Instagram credentials missing — set INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_BUSINESS_ACCOUNT_ID."
    );
    report.durationMs = Date.now() - startedAt;
    return report;
  }
  report.accountId = creds.accountId;

  let media: IgMedia[];
  try {
    media = await fetchAllMedia(creds.accountId, creds.token);
  } catch (err) {
    report.errors.push(err instanceof Error ? err.message : String(err));
    report.durationMs = Date.now() - startedAt;
    return report;
  }
  report.fetched = media.length;

  for (const m of media) {
    try {
      const mediaType = normalizeMediaType(m.media_type, m.media_product_type);
      const likeCount = m.like_count ?? 0;
      const commentCount = m.comments_count ?? 0;
      const insights = await fetchInsights(m.id, mediaType, creds.token);
      const engagementRate = calcEngagementRate(
        likeCount,
        commentCount,
        insights.saves,
        insights.shares,
        insights.reach
      );

      const existing = await prisma.instagramPost.findUnique({ where: { igId: m.id } });

      if (existing) {
        await prisma.instagramPost.update({
          where: { igId: m.id },
          data: {
            caption: m.caption ?? existing.caption,
            mediaType,
            mediaUrl: m.media_url ?? existing.mediaUrl,
            thumbnailUrl: m.thumbnail_url ?? existing.thumbnailUrl,
            permalink: m.permalink ?? existing.permalink,
            timestamp: new Date(m.timestamp),
            likeCount,
            commentCount,
            reachCount: insights.reach,
            savesCount: insights.saves,
            sharesCount: insights.shares,
            viewsCount: insights.views,
            engagementRate,
            lastSynced: new Date(),
          },
        });
        report.updated += 1;
      } else {
        await prisma.instagramPost.create({
          data: {
            igId: m.id,
            igAccountId: creds.accountId,
            caption: m.caption ?? null,
            mediaType,
            mediaUrl: m.media_url ?? null,
            thumbnailUrl: m.thumbnail_url ?? null,
            permalink: m.permalink ?? null,
            timestamp: new Date(m.timestamp),
            likeCount,
            commentCount,
            reachCount: insights.reach,
            savesCount: insights.saves,
            sharesCount: insights.shares,
            viewsCount: insights.views,
            engagementRate,
          },
        });
        report.inserted += 1;
      }
    } catch (err) {
      report.errors.push(
        `media ${m.id}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  report.ok = report.errors.length === 0 || report.inserted + report.updated > 0;
  report.durationMs = Date.now() - startedAt;
  return report;
}

export async function getAccountSummary(): Promise<{
  accountId: string | null;
  username: string | null;
  profilePicture: string | null;
  postCount: number;
  unclassifiedCount: number;
  lastSyncedAt: Date | null;
}> {
  const creds = getCreds();
  let username: string | null = null;
  let profilePicture: string | null = null;

  if (creds) {
    try {
      const profile = await igFetch<{
        username?: string;
        profile_picture_url?: string;
      }>(
        `/${creds.accountId}?fields=username,profile_picture_url`,
        creds.token
      );
      username = profile.username ?? null;
      profilePicture = profile.profile_picture_url ?? null;
    } catch {
      // ignore profile fetch errors — account may still have posts in DB
    }
  }

  const [postCount, unclassifiedCount, latest] = await Promise.all([
    prisma.instagramPost.count(),
    prisma.instagramPost.count({ where: { postType: "UNCLASSIFIED" } }),
    prisma.instagramPost.findFirst({
      orderBy: { lastSynced: "desc" },
      select: { lastSynced: true },
    }),
  ]);

  return {
    accountId: creds?.accountId ?? null,
    username,
    profilePicture,
    postCount,
    unclassifiedCount,
    lastSyncedAt: latest?.lastSynced ?? null,
  };
}
