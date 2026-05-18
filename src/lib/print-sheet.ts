/**
 * Print production sheet reader.
 *
 * Reads the "Proposed Timeline" tab from the print Google Sheet and returns
 * structured milestones. Used by the print sync job to roll timeline dates
 * into deadlines (cross-portal connection #6).
 */
import { google } from "googleapis";
import { getToken, setToken } from "./token-store";

const SHEET_ID = "1INpLAczQSTp0RdLV2_bPHC_2xO_Jhwy6MUDR2aALjZw";

export interface PrintMilestone {
  label: string;
  issue: string;
  date: Date;
}

function buildSheetsClient(): ReturnType<typeof google.sheets> | null {
  const tokenData =
    getToken("google_primary") || getToken("google_billing") || getToken("google_operations");
  if (tokenData) {
    const client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    client.setCredentials(tokenData as Parameters<typeof client.setCredentials>[0]);
    client.on("tokens", (newTokens) => {
      setToken("google_primary", { ...tokenData, ...newTokens });
    });
    return google.sheets({ version: "v4", auth: client });
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (email && key) {
    const jwt = new google.auth.JWT({
      email,
      key,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
    return google.sheets({ version: "v4", auth: jwt });
  }

  return null;
}

function parseDate(raw: string): Date | null {
  if (!raw) return null;
  const cleaned = raw.replace(/(st|nd|rd|th)/gi, "").trim();
  const d = new Date(cleaned);
  if (isNaN(d.getTime())) return null;
  return d;
}

/** Parse the timeline grid: rows of [label, Issue 01 date, Issue 02 date]. */
function parseTimeline(rows: string[][]): PrintMilestone[] {
  if (!rows.length) return [];
  let issueColRow = -1;
  let issue01Col = -1;
  let issue02Col = -1;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const row = rows[i] || [];
    for (let j = 0; j < row.length; j++) {
      const cell = (row[j] || "").toString().toUpperCase();
      if (cell.includes("ISSUE 01") || cell.includes("ISSUE 1")) {
        issue01Col = j;
        issueColRow = i;
      }
      if (cell.includes("ISSUE 02") || cell.includes("ISSUE 2")) {
        issue02Col = j;
        if (issueColRow === -1) issueColRow = i;
      }
    }
    if (issue01Col >= 0 || issue02Col >= 0) break;
  }

  if (issueColRow === -1) {
    issueColRow = 0;
    issue01Col = 1;
    issue02Col = 2;
  }

  const milestones: PrintMilestone[] = [];
  for (let i = issueColRow + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    let label = "";
    for (let j = 0; j < Math.max(issue01Col, issue02Col); j++) {
      if (row[j] && row[j].toString().trim()) {
        label = row[j].toString().trim();
        break;
      }
    }
    if (!label) continue;
    for (const [col, issue] of [
      [issue01Col, "Issue 01"],
      [issue02Col, "Issue 02"],
    ] as const) {
      if (col >= 0 && row[col]) {
        const date = parseDate(row[col].toString().trim());
        if (date) milestones.push({ label, issue, date });
      }
    }
  }
  return milestones;
}

/**
 * Fetch print timeline milestones from the Google Sheet.
 * Returns an empty array if Google is not connected or the sheet is unreadable.
 */
export async function fetchPrintTimelineMilestones(): Promise<PrintMilestone[]> {
  const sheets = buildSheetsClient();
  if (!sheets) return [];

  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
    const sheetNames = (meta.data.sheets || [])
      .map((s) => s.properties?.title || "")
      .filter(Boolean);
    const timelineTab =
      sheetNames.find((n) =>
        ["proposed timeline", "timeline", "schedule"].some((h) =>
          n.toLowerCase().includes(h)
        )
      ) ?? null;
    if (!timelineTab) return [];

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `'${timelineTab}'!A1:Z200`,
    });
    return parseTimeline((res.data.values as string[][]) || []);
  } catch (err) {
    console.error("[print-sheet] fetchPrintTimelineMilestones failed:", err);
    return [];
  }
}
