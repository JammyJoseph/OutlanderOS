import { google } from "googleapis";
import { getToken } from "./token-store";
import { fetchAllXeroData } from "./xero-api";
import { analyseEmailsForCampaign, EmailMessage, XeroEvidence } from "./deal-intelligence";
import prisma from "./prisma";

export interface SyncReport {
  runId: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  campaignsAnalyzed: number;
  updatesApplied: number;
  flagsRaised: number;
  errors: number;
  summary: string[];
}

async function searchGmailForClient(
  tokenData: Record<string, unknown>,
  clientName: string
): Promise<EmailMessage[]> {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  auth.setCredentials(tokenData as Parameters<typeof auth.setCredentials>[0]);
  const gmail = google.gmail({ version: "v1", auth });

  const res = await gmail.users.messages.list({
    userId: "me",
    q: `"${clientName}" newer_than:60d`,
    maxResults: 10,
  });

  const messages: EmailMessage[] = [];
  for (const msg of (res.data.messages ?? []).slice(0, 7)) {
    const detail = await gmail.users.messages.get({
      userId: "me",
      id: msg.id!,
      format: "metadata",
      metadataHeaders: ["Subject", "Date", "From"],
    });
    const headers = detail.data.payload?.headers ?? [];
    messages.push({
      subject: headers.find((h) => h.name === "Subject")?.value ?? "(no subject)",
      from: headers.find((h) => h.name === "From")?.value ?? "",
      date: headers.find((h) => h.name === "Date")?.value ?? "",
      snippet: detail.data.snippet ?? "",
    });
  }

  return messages;
}

function matchXeroForClient(
  clientName: string,
  xeroInvoices: Array<{ contact?: string; total?: number; amountDue?: number; status?: string }>
): XeroEvidence {
  const name = clientName.toLowerCase();
  const matched = xeroInvoices.filter((inv) => {
    const contact = (inv.contact ?? "").toLowerCase();
    return contact.includes(name) || name.includes(contact);
  });

  if (matched.length === 0) {
    return { hasInvoice: false, invoicePaid: false, amountInvoiced: 0, amountOutstanding: 0 };
  }

  const amountInvoiced = matched.reduce((s, i) => s + (i.total ?? 0), 0);
  const amountOutstanding = matched.reduce((s, i) => s + (i.amountDue ?? 0), 0);

  return {
    hasInvoice: true,
    invoicePaid: amountOutstanding === 0,
    amountInvoiced,
    amountOutstanding,
  };
}

export async function runCampaignSync(): Promise<SyncReport> {
  const runId = `sync_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const startedAt = new Date();

  const summary: string[] = [];
  let updatesApplied = 0;
  let flagsRaised = 0;
  let errors = 0;

  // Fetch all active campaigns
  const campaigns = await prisma.campaign.findMany({
    where: { status: { not: "ARCHIVED" as never } },
    include: { client: { select: { id: true, name: true } } },
    orderBy: { updatedAt: "asc" },
  });

  summary.push(`Analyzing ${campaigns.length} active campaigns`);

  // Load tokens
  const primaryToken = getToken("google_primary");
  const billingToken = getToken("google_billing");
  const xeroToken = getToken("xero");

  // Fetch Xero data once and reuse
  let xeroInvoices: Array<{ contact?: string; total?: number; amountDue?: number; status?: string }> = [];
  if (xeroToken) {
    try {
      const xeroResult = await fetchAllXeroData(JSON.stringify(xeroToken));
      xeroInvoices = xeroResult.data?.invoices ?? [];
    } catch {
      summary.push("Xero fetch failed — invoice matching skipped");
    }
  }

  // Process campaigns sequentially to respect Gmail rate limits
  for (const campaign of campaigns) {
    const clientName = campaign.client.name;

    // Gather Gmail evidence from primary account (deal correspondence)
    let emails: EmailMessage[] = [];
    if (primaryToken) {
      try {
        emails = await searchGmailForClient(
          primaryToken as Record<string, unknown>,
          clientName
        );
      } catch {
        // Non-fatal — continue with what we have
      }
    }

    // Also search billing inbox for invoice/payment signals
    if (billingToken && emails.length < 5) {
      try {
        const billingEmails = await searchGmailForClient(
          billingToken as Record<string, unknown>,
          clientName
        );
        // Merge, dedup by subject+date
        const seen = new Set(emails.map((e) => `${e.subject}|${e.date}`));
        for (const e of billingEmails) {
          if (!seen.has(`${e.subject}|${e.date}`)) {
            emails.push(e);
            seen.add(`${e.subject}|${e.date}`);
          }
        }
      } catch {
        // Non-fatal
      }
    }

    const xeroEvidence = matchXeroForClient(clientName, xeroInvoices);

    // Run AI analysis
    let result;
    try {
      result = await analyseEmailsForCampaign(
        {
          id: campaign.id,
          title: campaign.title,
          clientName,
          currentStatus: campaign.status,
          currentValue: campaign.value,
          ioSigned: campaign.ioSigned,
          currency: campaign.currency,
        },
        emails,
        xeroEvidence
      );
    } catch (err) {
      errors++;
      await prisma.intelligenceLog.create({
        data: {
          runId,
          campaignId: campaign.id,
          type: "error",
          finding: `Analysis failed: ${err instanceof Error ? err.message : "unknown error"}`,
          confidence: 0,
          sources: [],
        },
      });
      continue;
    }

    // Determine what sources contributed
    const sources: string[] = [];
    if (emails.length > 0) sources.push("gmail");
    if (xeroEvidence.hasInvoice) sources.push("xero");

    // Apply updates if confident enough
    const changes: Record<string, unknown> = {};
    let logType = "no_change";
    let actionDesc: string | null = null;

    if (result.shouldUpdate) {
      if (
        result.suggestedStatus &&
        result.suggestedStatus !== campaign.status
      ) {
        changes.status = result.suggestedStatus;
        logType = "status_update";
        actionDesc = `Status: ${campaign.status} → ${result.suggestedStatus}`;
      }

      if (result.suggestedIoSigned === true && !campaign.ioSigned) {
        changes.ioSigned = true;
        changes.ioSignedAt = new Date();
        logType = logType === "status_update" ? "status_update" : "io_signed";
        actionDesc = actionDesc
          ? `${actionDesc}, IO marked signed`
          : "IO marked as signed";
      }

      if (
        result.suggestedValue !== null &&
        result.suggestedValue > 0 &&
        result.suggestedValue !== campaign.value
      ) {
        changes.value = result.suggestedValue;
        if (logType === "no_change") logType = "value_update";
        actionDesc = actionDesc
          ? `${actionDesc}, value set to £${result.suggestedValue}`
          : `Value set to £${result.suggestedValue}`;
      }

      if (Object.keys(changes).length > 0) {
        await prisma.campaign.update({
          where: { id: campaign.id },
          data: changes as Parameters<typeof prisma.campaign.update>[0]["data"],
        });
        updatesApplied++;
        summary.push(
          `✓ ${clientName} — ${campaign.title}: ${actionDesc}`
        );
      }
    }

    // Raise flags regardless of whether we updated
    if (result.flags.length > 0) {
      flagsRaised += result.flags.length;
      for (const flag of result.flags) {
        summary.push(`⚑ ${clientName}: ${flag}`);
      }
    }

    if (logType === "no_change" && result.flags.length > 0) {
      logType = "flag";
    }

    // Always log
    await prisma.intelligenceLog.create({
      data: {
        runId,
        campaignId: campaign.id,
        type: logType,
        finding: result.reasoning,
        action: actionDesc,
        confidence: result.confidence,
        sources,
        rawData: {
          findings: result.findings,
          flags: result.flags,
          emailCount: emails.length,
          xeroHasInvoice: xeroEvidence.hasInvoice,
          xeroInvoicePaid: xeroEvidence.invoicePaid,
          xeroAmountInvoiced: xeroEvidence.amountInvoiced,
          xeroAmountOutstanding: xeroEvidence.amountOutstanding,
        },
      },
    });
  }

  const completedAt = new Date();

  return {
    runId,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    durationMs: completedAt.getTime() - startedAt.getTime(),
    campaignsAnalyzed: campaigns.length,
    updatesApplied,
    flagsRaised,
    errors,
    summary,
  };
}
