export interface IgPost {
  id: string;
  igId: string;
  igAccountId: string;
  caption: string | null;
  mediaType: string;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  permalink: string | null;
  timestamp: string;
  likeCount: number;
  commentCount: number;
  reachCount: number;
  savesCount: number;
  sharesCount: number;
  viewsCount: number;
  engagementRate: number;
  brands: string[];
  postType: string;
  campaignId: string | null;
  campaignName: string | null;
  notes: string | null;
  lastSynced: string;
}

export interface BrandSummary {
  name: string;
  postCount: number;
  totalReach: number;
  avgEngagement: number;
}

export interface AccountSummary {
  accountId: string | null;
  username: string | null;
  profilePicture: string | null;
  postCount: number;
  unclassifiedCount: number;
  lastSyncedAt: string | null;
}

export interface PipelineCard {
  id: string;
  name: string;
  client: string;
}

export const POST_TYPES = ["ORGANIC", "EDITORIAL", "PAID", "COMMUNITY", "UNCLASSIFIED"] as const;
export type PostType = (typeof POST_TYPES)[number];

export const MEDIA_TYPES = ["IMAGE", "VIDEO", "REEL", "CAROUSEL_ALBUM"] as const;
