import { google } from "googleapis";
import Anthropic from "@anthropic-ai/sdk";
import prisma from "@/lib/prisma";
import { getUserGoogleTokens, createUserOAuthClient } from "@/lib/google-user-auth";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const VALID_TYPES = new Set([
  "deliverable",
  "follow_up",
  "meeting",
  "review",
  "payment",
  "response_needed",
]);

interface ExtractedTask {
  title: string;
  dueDate: string;
  startDate?: string;
  type: string;
  priority: string;
  fromMe: boolean;
  externalPerson?: string;
  emailSnippet: string;
  threadSubject: string;
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

function getHeader(headers: any[], name: string): string {
  return headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

async function analyzeThread(
  threadText: string,
  subject: string,
  userName: string,
  userEmail: string,
  today: string
): Promise<ExtractedTask[]> {
  const prompt = `Analyze this email thread and extract ALL tasks, deadlines, commitments, and follow-ups.

For each item found, return JSON with:
- title: clear task description (under 80 chars)
- dueDate: ISO date YYYY-MM-DD (infer from context like "by Friday", "next week", "June 15")
- startDate: ISO date YYYY-MM-DD when work should begin (1-3 days before due for quick tasks, 1 week for bigger ones)
- type: "deliverable" | "follow_up" | "meeting" | "review" | "payment" | "response_needed"
- priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
- fromMe: boolean (true = I made this commitment, false = someone else promised it)
- externalPerson: name of the other party (string or null)
- emailSnippet: the relevant sentence from the email establishing this item (under 200 chars)
- threadSubject: the email subject line

Important context:
- Today is ${today}
- The user is ${userName} (${userEmail})
- "By Friday" means this coming Friday
- "Next week" means the Monday of next week
- "End of month" means the last business day of the month
- Look for: "I'll send", "can you", "deadline is", "due by", "let's circle back", "follow up", "get back to you", "need this by", "please send", "waiting on", "reminder"
- Track commitments BOTH ways: what the user promised AND what others promised
- If someone said "I'll get back to you" 5+ days ago with no follow-up, flag as response_needed
- Skip newsletters, marketing emails, automated notifications, receipts
- Only return items with a real time component

Email subject: ${subject}

Thread:
${threadText.slice(0, 6000)}

Respond with ONLY a JSON array. Empty array if nothing found. No markdown fences, no prose.`;

  try {
    const res = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });

    const text = res.content[0]?.type === "text" ? res.content[0].text : "[]";
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (d): d is ExtractedTask =>
        d &&
        typeof d.title === "string" &&
        typeof d.dueDate === "string" &&
        typeof d.emailSnippet === "string"
    );
  } catch {
    return [];
  }
}

export async function scanEmailsForTasks(userId: string): Promise<{
  newTasks: number;
  updatedTasks: number;
  emailsScanned: number;
}> {
  const tokens = await getUserGoogleTokens(userId);
  if (!tokens) return { newTasks: 0, updatedTasks: 0, emailsScanned: 0 };

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, lastEmailScanAt: true },
  });
  if (!dbUser) return { newTasks: 0, updatedTasks: 0, emailsScanned: 0 };

  const client = createUserOAuthClient();
  client.setCredentials({ access_token: tokens.accessToken });
  const gmail = google.gmail({ version: "v1", auth: client });

  const query = [
    "in:inbox",
    "-category:promotions",
    "-category:social",
    "-category:updates",
    dbUser.lastEmailScanAt
      ? `after:${Math.floor(dbUser.lastEmailScanAt.getTime() / 1000)}`
      : "newer_than:30d",
  ]
    .filter(Boolean)
    .join(" ");

  const listRes = await gmail.users.threads.list({
    userId: "me",
    q: query,
    maxResults: 50,
  });

  const threads = listRes.data.threads ?? [];
  const today = new Date().toISOString().split("T")[0];

  let newTasks = 0;
  let updatedTasks = 0;
  let emailsScanned = 0;

  for (const thread of threads) {
    if (!thread.id) continue;
    emailsScanned++;

    try {
      const threadData = await gmail.users.threads.get({
        userId: "me",
        id: thread.id,
        format: "full",
      });

      const messages = threadData.data.messages ?? [];
      if (messages.length === 0) continue;

      const firstMsg = messages[0];
      const firstHeaders = firstMsg.payload?.headers ?? [];
      const subject = getHeader(firstHeaders, "subject") || "(no subject)";
      const firstFrom = getHeader(firstHeaders, "from");

      // Build combined thread text
      const parts: string[] = [];
      for (const msg of messages) {
        const headers = msg.payload?.headers ?? [];
        const from = getHeader(headers, "from");
        const date = getHeader(headers, "date");
        const body = decodeBody(msg.payload).slice(0, 1500);
        if (body.trim()) {
          parts.push(`--- ${from} (${date}) ---\n${body}`);
        }
      }
      const threadText = parts.join("\n\n");
      if (!threadText.trim()) continue;

      const extracted = await analyzeThread(
        threadText,
        subject,
        dbUser.name,
        dbUser.email,
        today
      );

      for (const task of extracted) {
        const due = new Date(task.dueDate);
        if (isNaN(due.getTime())) continue;

        const cleanType = VALID_TYPES.has(task.type) ? task.type : "follow_up";
        const cleanPriority = ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(task.priority)
          ? task.priority
          : "MEDIUM";

        const startDate = task.startDate ? new Date(task.startDate) : null;
        const validStartDate =
          startDate && !isNaN(startDate.getTime()) && startDate < due ? startDate : null;

        const sourceRef = thread.id;

        try {
          const existing = await prisma.deadline.findUnique({
            where: { source_sourceRef: { source: "email", sourceRef } },
          });

          if (existing) {
            await prisma.deadline.update({
              where: { id: existing.id },
              data: {
                title: task.title.slice(0, 200),
                dueDate: due,
                startDate: validStartDate,
                type: cleanType,
                priority: cleanPriority,
                emailSnippet: task.emailSnippet.slice(0, 500),
                emailFrom: task.externalPerson || firstFrom || null,
              },
            });
            updatedTasks++;
          } else {
            await prisma.deadline.create({
              data: {
                title: task.title.slice(0, 200),
                dueDate: due,
                startDate: validStartDate,
                type: cleanType,
                priority: cleanPriority,
                source: "email",
                sourceRef,
                sourceUrl: `https://mail.google.com/mail/u/0/#inbox/${thread.id}`,
                emailFrom: task.externalPerson || firstFrom || null,
                emailSnippet: task.emailSnippet.slice(0, 500),
                assignedTo: userId,
                createdBy: "email-scan",
              },
            });
            newTasks++;
          }
        } catch {
          // skip individual upsert failures
        }
      }
    } catch {
      // skip individual thread failures
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: { lastEmailScanAt: new Date() },
  });

  return { newTasks, updatedTasks, emailsScanned };
}
