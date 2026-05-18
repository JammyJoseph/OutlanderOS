import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import {
  gatherDigestData,
  generateUserDigest,
  getTodaysDigestNotification,
} from "@/lib/daily-digest";

async function resolveUserId(request: NextRequest): Promise<string | null> {
  const me = getCurrentUser(request);
  if (me?.userId) return me.userId;
  const fallback = await prisma.user.findFirst({ select: { id: true } });
  return fallback?.id ?? null;
}

/**
 * Generates (or returns today's cached) daily digest for the current user.
 * Idempotent — the AI briefing is written once per user per day.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await resolveUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: "No user found" },
        { status: 401 }
      );
    }

    const existing = await getTodaysDigestNotification(userId);
    if (existing) {
      const { counts, items } = await gatherDigestData(userId);
      return NextResponse.json({
        cached: true,
        date: existing.createdAt.toISOString(),
        text: existing.message,
        counts,
        items,
      });
    }

    const digest = await generateUserDigest(userId);
    return NextResponse.json({ cached: false, ...digest });
  } catch (err) {
    console.error("POST /api/auto-ping/digest", err);
    return NextResponse.json(
      { error: "Failed to generate daily digest" },
      { status: 500 }
    );
  }
}
