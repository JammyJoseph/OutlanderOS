import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { getUserGmail } from "@/lib/google-user-auth";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const VALID_TYPES = new Set([
  "follow_up",
  "deliverable",
  "meeting",
  "review",
  "payment",
  "other",
]);

interface ExtractedDeadline {
  title: string;
  dueDate: string;
  type: string;
  snippet: string;
}

async function extractDeadlinesFromEmail(
  subject: string,
  from: string,
  body: string,
  receivedDate: string
): Promise<ExtractedDeadline[]> {
  const prompt = `You are scanning an email for deadlines, follow-ups, commitments, or time-based promises.

Email received: ${receivedDate}
From: ${from}
Subject: ${subject}

Body:
${body.slice(0, 4000)}

Extract any deadlines, follow-ups, commitments, or time-based promises. For each, return JSON with:
- title: a short description (under 80 chars)
- dueDate: ISO 8601 date (YYYY-MM-DD or full ISO). Resolve relative dates ("Friday", "next week") using the received date as the reference point.
- type: one of "follow_up" | "deliverable" | "meeting" | "review" | "payment" | "other"
- snippet: the exact short quote from the email that establishes this deadline (under 200 chars)

Only return REAL commitments. Skip vague language with no time component. Skip newsletters, marketing, automated notifications.

Respond with ONLY a JSON array. Empty array if nothing found. No prose, no markdown fences.`;

  try {
    const res = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    });

    const text = res.content[0]?.type === "text" ? res.content[0].text : "[]";
    const cleaned = text
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (d): d is ExtractedDeadline =>
        d &&
        typeof d.title === "string" &&
        typeof d.dueDate === "string" &&
        typeof d.type === "string" &&
        typeof d.snippet === "string"
    );
  } catch (err) {
    console.error("Failed to extract deadlines:", err);
    return [];
  }
}

function decodeBody(payload: any): string {
  if (!payload) return "";
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf-8");
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return Buffer.from(part.body.data, "base64").toString("utf-8");
      }
    }
    for (const part of payload.parts) {
      const nested = decodeBody(part);
      if (nested) return nested;
    }
  }
  return "";
}

export async function POST(request: NextRequest) {
  const me = getCurrentUser(request);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = me.userId;

  try {
    // Each user's scan reads only their own inbox, via their personal token.
    const gmailResult = await getUserGmail(
      userId,
      "in:inbox -category:promotions -category:social",
      50
    );
    if (!gmailResult) {
      return NextResponse.json(
        {
          error: "Connect Google to enable email scanning",
          needsGoogle: true,
        },
        { status: 400 }
      );
    }
    const { gmail, messages } = gmailResult;

    const messageIds = messages.map((m) => m.id!).filter(Boolean);

    const existing = await prisma.deadline.findMany({
      where: {
        assignedTo: userId,
        source: "email",
        sourceRef: { in: messageIds },
      },
      select: { sourceRef: true },
    });
    const existingRefs = new Set(existing.map((e) => e.sourceRef));

    let created = 0;
    let scanned = 0;

    for (const msgId of messageIds) {
      if (existingRefs.has(msgId)) continue;
      scanned++;

      try {
        const msg = await gmail.users.messages.get({
          userId: "me",
          id: msgId,
          format: "full",
        });

        const headers = msg.data.payload?.headers || [];
        const subject =
          headers.find((h) => h.name?.toLowerCase() === "subject")?.value || "";
        const from =
          headers.find((h) => h.name?.toLowerCase() === "from")?.value || "";
        const dateHeader =
          headers.find((h) => h.name?.toLowerCase() === "date")?.value || "";
        const internalDate = msg.data.internalDate
          ? new Date(parseInt(msg.data.internalDate, 10)).toISOString()
          : new Date().toISOString();
        const body = decodeBody(msg.data.payload);

        const extracted = await extractDeadlinesFromEmail(
          subject,
          from,
          body,
          dateHeader || internalDate
        );

        for (const d of extracted) {
          const due = new Date(d.dueDate);
          if (isNaN(due.getTime())) continue;

          const cleanType = VALID_TYPES.has(d.type) ? d.type : "other";

          await prisma.deadline.create({
            data: {
              title: d.title.slice(0, 200),
              dueDate: due,
              type: cleanType,
              priority: "MEDIUM",
              source: "email",
              sourceRef: msgId,
              sourceUrl: `https://mail.google.com/mail/u/0/#inbox/${msgId}`,
              emailFrom: from,
              emailSnippet: d.snippet.slice(0, 500),
              assignedTo: userId,
              createdBy: "email-scan",
            },
          });
          created++;
        }
      } catch (err) {
        console.error(`Failed to process message ${msgId}:`, err);
      }
    }

    return NextResponse.json({ scanned, created });
  } catch (err) {
    console.error("POST /api/deadlines/scan-email", err);
    return NextResponse.json(
      { error: "Failed to scan email", detail: String(err) },
      { status: 500 }
    );
  }
}
