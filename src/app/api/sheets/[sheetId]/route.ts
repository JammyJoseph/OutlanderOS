import type { NextRequest } from "next/server";
import { extractSheetId, getBillingEntries, testConnection } from "@/lib/google-sheets";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sheetId: string }> }
) {
  const { sheetId: rawId } = await params;
  const sheetId = extractSheetId(decodeURIComponent(rawId));
  const { searchParams } = request.nextUrl;
  const action = searchParams.get("action") ?? "read";
  const range = searchParams.get("range") ?? "Billing 2026";

  if (!sheetId) {
    return Response.json({ error: "Missing sheetId" }, { status: 400 });
  }

  if (action === "test") {
    const result = await testConnection(sheetId);
    return Response.json(result, { status: result.ok ? 200 : 502 });
  }

  if (action === "billing") {
    const entries = await getBillingEntries(sheetId, range);
    return Response.json({ entries });
  }

  // Default: return metadata
  const { getSpreadsheetMetadata } = await import("@/lib/google-sheets");
  const meta = await getSpreadsheetMetadata(sheetId);
  return Response.json(meta);
}
