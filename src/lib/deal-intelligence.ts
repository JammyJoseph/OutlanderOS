import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export interface EmailMessage {
  subject: string;
  from: string;
  date: string;
  snippet: string;
}

export interface XeroEvidence {
  hasInvoice: boolean;
  invoicePaid: boolean;
  amountInvoiced: number;
  amountOutstanding: number;
}

export interface CampaignContext {
  id: string;
  title: string;
  clientName: string;
  currentStatus: string;
  currentValue: number | null;
  ioSigned: boolean;
  currency: string;
}

export interface DealIntelligenceResult {
  campaignId: string;
  suggestedStatus: string | null;
  suggestedIoSigned: boolean | null;
  suggestedValue: number | null;
  confidence: number;
  reasoning: string;
  findings: string[];
  flags: string[];
  shouldUpdate: boolean;
}

// Static system prompt — cached across all per-campaign calls in a sync run
const SYSTEM_PROMPT = `You are a deal intelligence engine for Outlander, a UK fashion and culture media company.
Your job is to analyse email evidence and Xero invoice data to determine the current state of advertising campaigns and brand partnerships, and suggest database updates.

CAMPAIGN STATUS LADDER (always progresses forward, never back without exceptional evidence):
1. BRIEF_RECEIVED — client has sent a brief or enquiry
2. BRIEF_RESPONDED — we sent back a proposal, media plan, or rates card
3. BOOKED — deal agreed, IO (insertion order) issued or confirmed in writing
4. LIVE — campaign actively running, content being produced or published
5. DELIVERED — all deliverables complete, campaign report sent
6. PAID — invoice settled, payment confirmed

EMAIL SIGNALS TO LOOK FOR:
- "brief", "looking for a proposal", "campaign idea", "would you be interested" → BRIEF_RECEIVED
- "proposal", "media plan attached", "rates card", "please find our response" → BRIEF_RESPONDED
- "booking confirmed", "we'd like to proceed", "IO attached", "insertion order" → BOOKED
- "signed IO", "docusign", "executed", "countersigned", "all signed" → BOOKED + ioSigned=true
- "post scheduled", "goes live", "content live", "campaign running" → LIVE
- "campaign report", "final metrics", "all posts delivered", "wrap report" → DELIVERED
- "payment received", "invoice paid", "settled", "funds transferred" → PAID

XERO SIGNALS:
- AUTHORISED invoice exists → campaign at least at DELIVERED stage
- PAID invoice → campaign at PAID stage

RULES:
- Only suggest advancing status if you have clear evidence. If uncertain, set shouldUpdate: false.
- confidence: 0.0–1.0. Only set shouldUpdate: true when confidence >= 0.85.
- If email mentions signed IO but ioSigned is false in DB → high-value flag even if low confidence.
- If no emails found → flag "No email activity in 60 days" but do not suggest status change.
- suggestedStatus: null means no change suggested. "NO_CHANGE" is not valid — use null.
- Always return the tool call. Never respond in plain text.`;

const ANALYSIS_TOOL: Anthropic.Tool = {
  name: "deal_analysis",
  description: "Output structured deal intelligence analysis for a campaign",
  input_schema: {
    type: "object" as const,
    properties: {
      suggestedStatus: {
        type: "string",
        enum: [
          "BRIEF_RECEIVED",
          "BRIEF_RESPONDED",
          "BOOKED",
          "LIVE",
          "DELIVERED",
          "PAID",
        ],
        description:
          "The suggested new status. Omit or set to null if no change is warranted.",
      },
      suggestedIoSigned: {
        type: "boolean",
        description: "Set to true if email evidence clearly shows the IO has been signed.",
      },
      suggestedValue: {
        type: "number",
        description:
          "Suggested campaign value in the campaign currency if a clear £/$/€ figure is found in emails or Xero.",
      },
      confidence: {
        type: "number",
        description: "Confidence score 0.0–1.0 for your overall assessment.",
      },
      reasoning: {
        type: "string",
        description: "One or two sentences explaining what the evidence shows.",
      },
      findings: {
        type: "array",
        items: { type: "string" },
        description: "List of specific evidence items found (email subjects, Xero status, etc.)",
      },
      flags: {
        type: "array",
        items: { type: "string" },
        description:
          "Issues or discrepancies that need human attention (e.g. IO signed in email but not in DB).",
      },
      shouldUpdate: {
        type: "boolean",
        description: "true only if confidence >= 0.85 AND a meaningful change is suggested.",
      },
    },
    required: ["confidence", "reasoning", "findings", "flags", "shouldUpdate"],
  },
};

export async function analyseEmailsForCampaign(
  campaign: CampaignContext,
  emails: EmailMessage[],
  xero: XeroEvidence
): Promise<DealIntelligenceResult> {
  const prompt = `Analyse this campaign and all available evidence.

CAMPAIGN IN DATABASE:
- ID: ${campaign.id}
- Title: "${campaign.title}"
- Client: "${campaign.clientName}"
- Current status: ${campaign.currentStatus}
- IO signed in DB: ${campaign.ioSigned}
- Value in DB: ${campaign.currentValue ? `${campaign.currency}${campaign.currentValue}` : "not set"}

XERO INVOICE DATA for "${campaign.clientName}":
- Has invoice: ${xero.hasInvoice}
- Invoice paid: ${xero.invoicePaid}
- Amount invoiced: £${xero.amountInvoiced.toFixed(2)}
- Amount outstanding: £${xero.amountOutstanding.toFixed(2)}

EMAIL MESSAGES (${emails.length} found, last 60 days, most recent first):
${
  emails.length === 0
    ? "No emails found for this client in the last 60 days."
    : emails
        .map(
          (e, i) =>
            `${i + 1}. [${e.date}] FROM: ${e.from} | SUBJECT: "${e.subject}" | SNIPPET: ${e.snippet}`
        )
        .join("\n")
}

Based on all evidence, call the deal_analysis tool with your assessment.`;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [ANALYSIS_TOOL],
      tool_choice: { type: "tool", name: "deal_analysis" },
      messages: [{ role: "user", content: prompt }],
    });

    const toolUse = response.content.find((c) => c.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return noChangeResult(campaign.id, "AI returned no tool call");
    }

    const input = toolUse.input as {
      suggestedStatus?: string;
      suggestedIoSigned?: boolean;
      suggestedValue?: number;
      confidence: number;
      reasoning: string;
      findings: string[];
      flags: string[];
      shouldUpdate: boolean;
    };

    return {
      campaignId: campaign.id,
      suggestedStatus: input.suggestedStatus ?? null,
      suggestedIoSigned: input.suggestedIoSigned ?? null,
      suggestedValue: input.suggestedValue ?? null,
      confidence: input.confidence,
      reasoning: input.reasoning,
      findings: input.findings ?? [],
      flags: input.flags ?? [],
      shouldUpdate: input.shouldUpdate,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return noChangeResult(campaign.id, `AI call failed: ${msg}`);
  }
}

function noChangeResult(
  campaignId: string,
  reason: string
): DealIntelligenceResult {
  return {
    campaignId,
    suggestedStatus: null,
    suggestedIoSigned: null,
    suggestedValue: null,
    confidence: 0,
    reasoning: reason,
    findings: [],
    flags: [],
    shouldUpdate: false,
  };
}
