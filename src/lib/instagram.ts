import { withRetry } from "@/lib/retry";

const GRAPH_VERSION = "v19.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

export type InstagramMediaType =
  | "IMAGE"
  | "VIDEO"
  | "CAROUSEL_ALBUM"
  | "REELS"
  | "STORY";

export interface InstagramProfile {
  id: string;
  username: string;
  name?: string;
  profile_picture_url?: string;
  followers_count: number;
  follows_count?: number;
  media_count: number;
}

export interface InstagramMedia {
  id: string;
  caption: string;
  media_type: InstagramMediaType;
  media_product_type?: string;
  media_url: string;
  thumbnail_url?: string;
  timestamp: string;
  permalink: string;
  like_count: number;
  comments_count: number;
}

export interface InstagramInsightsValue {
  name: string;
  value: number;
  title?: string;
  description?: string;
}

export interface InstagramAccountInsights {
  reach?: number;
  profile_views?: number;
  follower_count?: number;
  website_clicks?: number;
  accounts_engaged?: number;
}

interface GraphErrorBody {
  error?: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

export class InstagramApiError extends Error {
  code: number;
  subcode?: number;
  type: string;
  isTokenError: boolean;

  constructor(message: string, code: number, type: string, subcode?: number) {
    super(message);
    this.name = "InstagramApiError";
    this.code = code;
    this.type = type;
    this.subcode = subcode;
    this.isTokenError =
      code === 190 ||
      code === 102 ||
      code === 463 ||
      code === 467 ||
      type === "OAuthException";
  }
}

function getCreds() {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  const igUserId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;

  if (!accessToken || !igUserId) {
    throw new Error(
      "Instagram credentials missing: INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_BUSINESS_ACCOUNT_ID required"
    );
  }
  return { accessToken, appId, appSecret, igUserId };
}

let cachedToken: string | null = null;

function currentToken() {
  if (cachedToken) return cachedToken;
  return process.env.INSTAGRAM_ACCESS_TOKEN ?? "";
}

async function refreshLongLivedToken(): Promise<string | null> {
  const { appId, appSecret } = getCreds();
  const existing = currentToken();
  if (!appId || !appSecret || !existing) return null;

  const url = new URL(`${GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("fb_exchange_token", existing);

  const res = await withRetry(
    () => fetch(url.toString(), { cache: "no-store" }),
    { context: "instagram" }
  );
  if (!res.ok) return null;
  const body = (await res.json()) as { access_token?: string };
  if (!body.access_token) return null;
  cachedToken = body.access_token;
  return body.access_token;
}

async function graphGet<T>(
  path: string,
  params: Record<string, string | number | undefined> = {},
  retried = false
): Promise<T> {
  const { accessToken } = getCreds();
  const token = currentToken() || accessToken;
  const url = new URL(`${GRAPH_BASE}${path.startsWith("/") ? path : `/${path}`}`);

  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") {
      url.searchParams.set(k, String(v));
    }
  }
  url.searchParams.set("access_token", token);

  const res = await withRetry(
    () => fetch(url.toString(), { cache: "no-store" }),
    { context: "instagram" }
  );
  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Instagram Graph API: invalid JSON response (${res.status})`);
  }

  if (!res.ok) {
    const err = (data as GraphErrorBody).error;
    const apiErr = new InstagramApiError(
      err?.message ?? `HTTP ${res.status}`,
      err?.code ?? res.status,
      err?.type ?? "Unknown",
      err?.error_subcode
    );
    if (apiErr.isTokenError && !retried) {
      const refreshed = await refreshLongLivedToken();
      if (refreshed) {
        return graphGet<T>(path, params, true);
      }
    }
    throw apiErr;
  }

  return data as T;
}

export async function getProfile(): Promise<InstagramProfile> {
  const { igUserId } = getCreds();
  return graphGet<InstagramProfile>(`/${igUserId}`, {
    fields:
      "id,username,name,profile_picture_url,followers_count,follows_count,media_count",
  });
}

export async function getRecentMedia(limit = 25): Promise<InstagramMedia[]> {
  const { igUserId } = getCreds();
  const data = await graphGet<{ data: InstagramMedia[] }>(`/${igUserId}/media`, {
    fields:
      "id,caption,media_type,media_product_type,media_url,thumbnail_url,timestamp,permalink,like_count,comments_count",
    limit,
  });
  return data.data ?? [];
}

const POST_METRICS_BY_TYPE: Record<string, string[]> = {
  IMAGE: ["reach", "saved", "likes", "comments", "shares", "total_interactions"],
  CAROUSEL_ALBUM: [
    "reach",
    "saved",
    "likes",
    "comments",
    "shares",
    "total_interactions",
  ],
  VIDEO: [
    "reach",
    "saved",
    "likes",
    "comments",
    "shares",
    "total_interactions",
    "views",
  ],
  REELS: [
    "reach",
    "saved",
    "likes",
    "comments",
    "shares",
    "total_interactions",
    "views",
  ],
};

export interface InstagramMediaInsights {
  reach: number;
  saved: number;
  likes: number;
  comments: number;
  shares: number;
  total_interactions: number;
  views?: number;
  raw: InstagramInsightsValue[];
}

export async function getMediaInsights(
  mediaId: string,
  mediaType: string = "IMAGE"
): Promise<InstagramMediaInsights> {
  const metrics = POST_METRICS_BY_TYPE[mediaType] ?? POST_METRICS_BY_TYPE.IMAGE;

  const data = await graphGet<{
    data: Array<{
      name: string;
      values: Array<{ value: number }>;
      title?: string;
      description?: string;
    }>;
  }>(`/${mediaId}/insights`, {
    metric: metrics.join(","),
  });

  const out: InstagramMediaInsights = {
    reach: 0,
    saved: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    total_interactions: 0,
    raw: [],
  };

  for (const m of data.data ?? []) {
    const v = m.values?.[0]?.value ?? 0;
    out.raw.push({
      name: m.name,
      value: v,
      title: m.title,
      description: m.description,
    });
    if (m.name === "reach") out.reach = v;
    else if (m.name === "saved") out.saved = v;
    else if (m.name === "likes") out.likes = v;
    else if (m.name === "comments") out.comments = v;
    else if (m.name === "shares") out.shares = v;
    else if (m.name === "total_interactions") out.total_interactions = v;
    else if (m.name === "views") out.views = v;
  }

  return out;
}

export async function getAccountInsights(
  period: "day" | "week" | "days_28" = "day"
): Promise<InstagramAccountInsights> {
  const { igUserId } = getCreds();

  const totalValueMetrics = ["reach", "accounts_engaged", "profile_views", "website_clicks"];

  const data = await graphGet<{
    data: Array<{
      name: string;
      total_value?: { value: number };
      values?: Array<{ value: number }>;
    }>;
  }>(`/${igUserId}/insights`, {
    metric: totalValueMetrics.join(","),
    metric_type: "total_value",
    period,
  });

  const out: InstagramAccountInsights = {};
  for (const m of data.data ?? []) {
    const v = m.total_value?.value ?? m.values?.[0]?.value ?? 0;
    if (m.name === "reach") out.reach = v;
    else if (m.name === "profile_views") out.profile_views = v;
    else if (m.name === "website_clicks") out.website_clicks = v;
    else if (m.name === "accounts_engaged") out.accounts_engaged = v;
  }
  return out;
}

export function classifyMediaType(m: Pick<InstagramMedia, "media_type" | "media_product_type">): "Post" | "Reel" | "Carousel" | "Story" {
  if (m.media_product_type === "REELS") return "Reel";
  if (m.media_product_type === "STORY") return "Story";
  if (m.media_type === "CAROUSEL_ALBUM") return "Carousel";
  if (m.media_type === "VIDEO") return "Reel";
  return "Post";
}
