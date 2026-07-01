import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { withAuth } from "@/lib/auth";
import {
  parseShotList,
  parseDeliverables,
  emptyShot,
  emptyShotStyle,
  type Shot,
  type ShotStyle,
  type ParsedDeliverable,
} from "@/app/(portal)/production/[id]/call-sheets/[csId]/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Claude model used for the intelligent parser. The route falls back to the
// regex parser if this ever 404s or the call fails.
const MODEL = "claude-sonnet-4-6";

type ContentType = "shotlist" | "deliverables";

// Pull the first JSON object out of a model response, tolerating markdown code
// fences or stray prose around it.
function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("no json object in response");
  return JSON.parse(body.slice(start, end + 1));
}

const str = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));

// Coerce an LLM shot object into our Shot shape (all fields present, safe types).
function normaliseShot(raw: Record<string, unknown>): Shot {
  return {
    ...emptyShot(),
    shotNumber: str(raw.shotNumber || raw.number),
    description: str(raw.description || raw.headline || raw.title),
    locationRef: str(raw.locationRef || raw.location),
    scene: str(raw.scene),
    video: str(raw.video || raw.videoNotes || raw.videoDirection),
    dialogue: str(raw.dialogue || raw.interview || raw.dialoguePrompts),
    stills: str(raw.stills || raw.stillsList),
    talent: str(raw.talent),
    equipment: str(raw.equipment),
    duration: str(raw.duration),
    tone: str(raw.tone),
    status: "planned",
  };
}

const DELIVERABLE_TYPES = new Set(["photo", "video", "reel", "bts", "other"]);
function normaliseDeliverable(raw: Record<string, unknown>): ParsedDeliverable {
  let type = str(raw.type).toLowerCase();
  if (!DELIVERABLE_TYPES.has(type)) type = "other";
  // Fold an LLM-provided category into the notes so nothing is lost against our
  // flatter ProductionDeliverable model.
  const category = str(raw.category);
  const notes = [category ? `Category: ${category}` : "", str(raw.notes || raw.description || raw.specs)]
    .filter(Boolean)
    .join("\n");
  return { type, title: str(raw.title || raw.name), notes };
}

const SHOTLIST_SYSTEM =
  "You are a production coordinator for Outlander, a UK fashion & culture magazine. " +
  "You turn a pasted shot list or creative brief — in any format — into clean structured JSON for a call sheet. " +
  "Respond with ONLY a JSON object, no prose and no markdown fences.";

function shotlistUser(text: string): string {
  return (
    "Parse the shot list below into this exact JSON shape:\n" +
    `{
  "style": { "tone": string, "visualDevice": string, "notes": string },
  "shots": [
    {
      "shotNumber": string,
      "description": string,
      "locationRef": string,
      "scene": string,
      "video": string,
      "dialogue": string,
      "stills": string,
      "talent": string,
      "equipment": string,
      "duration": string,
      "tone": string
    }
  ]
}\n` +
    "Rules: `style` captures the overall tone / visual approach / style notes for the whole shoot " +
    "(empty strings if none stated). Each shot: `description` is a short headline; `video` is camera " +
    "direction/framing/movement; `dialogue` is interview or VO prompts; `stills` is what the photographer " +
    "should capture. Use \"\" for any field with no information — never null. Keep the shoot's own order.\n\n" +
    "SHOT LIST:\n" +
    text
  );
}

const DELIVERABLES_SYSTEM =
  "You are a production coordinator for Outlander, a UK fashion & culture magazine. " +
  "You turn a pasted deliverables brief — in any format — into clean structured JSON. " +
  "Respond with ONLY a JSON object, no prose and no markdown fences.";

function deliverablesUser(text: string): string {
  return (
    "Parse the deliverables brief below into this exact JSON shape:\n" +
    `{
  "deliverables": [
    { "type": "photo|video|reel|bts|other", "title": string, "category": string, "notes": string }
  ]
}\n` +
    "Rules: one entry per distinct deliverable. `type` is the best fit from the enum. `title` should lead " +
    "with the quantity where given (e.g. \"8x Edited Hero Images\"). `category` is the grouping heading if the " +
    "brief uses one (e.g. \"Core Hero Assets\", \"Social Video Edits\") else \"\". `notes` holds format specs, " +
    "dimensions, duration, and any bullet-point detail. Use \"\" for missing fields — never null.\n\n" +
    "DELIVERABLES BRIEF:\n" +
    text
  );
}

export const POST = withAuth(async (request: NextRequest) => {
  const body = await request.json().catch(() => ({}));
  const text: string = typeof body?.text === "string" ? body.text : "";
  const type: ContentType = body?.type === "deliverables" ? "deliverables" : "shotlist";

  if (!text.trim()) {
    return NextResponse.json({ error: "No text provided" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  // Regex fallback — used when there's no API key or the model call fails, so the
  // paste-to-parse feature always returns something usable.
  const regex = () =>
    type === "shotlist"
      ? { source: "regex", style: emptyShotStyle(), shots: parseShotList(text) }
      : { source: "regex", deliverables: parseDeliverables(text) };

  if (!apiKey) {
    return NextResponse.json(regex());
  }

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: type === "shotlist" ? SHOTLIST_SYSTEM : DELIVERABLES_SYSTEM,
      messages: [
        { role: "user", content: type === "shotlist" ? shotlistUser(text) : deliverablesUser(text) },
      ],
    });
    const block = response.content.find((b) => b.type === "text");
    const raw = block && "text" in block ? block.text : "";
    const parsed = extractJson(raw) as Record<string, unknown>;

    if (type === "shotlist") {
      const shotsIn = Array.isArray(parsed.shots) ? (parsed.shots as Record<string, unknown>[]) : [];
      const shots = shotsIn.map(normaliseShot).filter((s) => s.description || s.scene || s.stills || s.video);
      if (shots.length === 0) return NextResponse.json(regex());
      const styleRaw = (parsed.style ?? {}) as Record<string, unknown>;
      const style: ShotStyle = {
        tone: str(styleRaw.tone),
        visualDevice: str(styleRaw.visualDevice || styleRaw.visual),
        notes: str(styleRaw.notes),
      };
      return NextResponse.json({ source: "llm", style, shots });
    }

    const delivIn = Array.isArray(parsed.deliverables)
      ? (parsed.deliverables as Record<string, unknown>[])
      : [];
    const deliverables = delivIn.map(normaliseDeliverable).filter((d) => d.title);
    if (deliverables.length === 0) return NextResponse.json(regex());
    return NextResponse.json({ source: "llm", deliverables });
  } catch (e) {
    // Any model/parse failure degrades to the regex parser rather than erroring.
    return NextResponse.json({ ...regex(), warning: e instanceof Error ? e.message : "AI parse failed" });
  }
});
