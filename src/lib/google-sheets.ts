/**
 * Google Sheets integration for Outlander OS.
 *
 * Designed to read from "2026 MASTER BILLING TRACKER" and other sheets.
 * Swap mock data in src/lib/mock-data.ts for these real data functions
 * once credentials are configured.
 *
 * Required environment variables:
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL
 *   GOOGLE_PRIVATE_KEY
 *   GOOGLE_BILLING_SHEET_ID  (the "2026 MASTER BILLING TRACKER" spreadsheet ID)
 */

import { google, sheets_v4 } from "googleapis";

// ---- AUTH ----

function getAuthClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!email || !key) {
    throw new Error(
      "Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY environment variables."
    );
  }

  return new google.auth.JWT({
    email,
    key,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets.readonly",
      "https://www.googleapis.com/auth/drive.readonly",
    ],
  });
}

function getSheetsClient(): sheets_v4.Sheets {
  const auth = getAuthClient();
  return google.sheets({ version: "v4", auth });
}

// ---- RAW READ ----

export async function readRange(
  spreadsheetId: string,
  range: string
): Promise<string[][]> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  return (res.data.values as string[][] | null | undefined) ?? [];
}

export async function getSpreadsheetMetadata(spreadsheetId: string) {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.get({ spreadsheetId });
  return {
    title: res.data.properties?.title ?? "Untitled",
    sheetNames: res.data.sheets?.map((s) => s.properties?.title ?? "") ?? [],
  };
}

// ---- BILLING TRACKER ----
// Reads "2026 MASTER BILLING TRACKER" and returns typed BillingEntry objects.
//
// Expected sheet columns (row 1 = headers):
//   A: Invoice Number
//   B: Client Name
//   C: Campaign Name
//   D: Revenue Category
//   E: Amount Invoiced (£)
//   F: Amount Paid (£)
//   G: Invoice Date (YYYY-MM-DD)
//   H: Due Date (YYYY-MM-DD)
//   I: Payment Status (paid/pending/overdue/draft)
//   J: Days Outstanding
//   K: Notes

export interface SheetBillingEntry {
  id: string;
  invoiceNumber: string;
  clientName: string;
  campaignName: string;
  revenueCategory: string;
  amountInvoiced: number;
  amountPaid: number;
  invoiceDate: string;
  dueDate: string;
  paymentStatus: string;
  daysOutstanding: number | null;
  notes: string;
}

export async function getBillingEntries(
  spreadsheetId: string,
  sheetName = "Billing 2026"
): Promise<SheetBillingEntry[]> {
  const rows = await readRange(spreadsheetId, `${sheetName}!A2:K`);
  return rows
    .filter((row) => row[0]) // skip empty rows
    .map((row, i) => ({
      id: `sheet-${i}`,
      invoiceNumber: row[0] ?? "",
      clientName: row[1] ?? "",
      campaignName: row[2] ?? "",
      revenueCategory: row[3] ?? "",
      amountInvoiced: parseFloat(row[4]?.replace(/[£,]/g, "") ?? "0") || 0,
      amountPaid: parseFloat(row[5]?.replace(/[£,]/g, "") ?? "0") || 0,
      invoiceDate: row[6] ?? "",
      dueDate: row[7] ?? "",
      paymentStatus: (row[8] ?? "draft").toLowerCase(),
      daysOutstanding: row[9] ? parseInt(row[9], 10) : null,
      notes: row[10] ?? "",
    }));
}

// ---- CONNECTION TEST ----

export async function testConnection(
  spreadsheetId: string
): Promise<{ ok: boolean; title?: string; error?: string }> {
  try {
    const meta = await getSpreadsheetMetadata(spreadsheetId);
    return { ok: true, title: meta.title };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// ---- SPREADSHEET ID HELPERS ----

export function extractSheetId(urlOrId: string): string {
  // Handles full Google Sheets URLs like:
  // https://docs.google.com/spreadsheets/d/SHEET_ID/edit#gid=0
  const match = urlOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : urlOrId.trim();
}
