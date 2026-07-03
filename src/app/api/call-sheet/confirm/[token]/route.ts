import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeConfirmToken, recipientKey } from "@/lib/callsheet-confirm";

// Public receipt confirmation (Phase 4A). No auth — the token is the credential.
// GET returns the recipient/shoot so the confirmation page can render; POST
// stamps the recipient's confirmedAt on the call sheet's distributions array.

interface DistEntry {
  name: string;
  role: string;
  email: string;
  sentAt: string;
  confirmedAt?: string;
}

async function resolve(token: string) {
  const decoded = decodeConfirmToken(token);
  if (!decoded) return null;
  const sheet = await prisma.callSheet.findUnique({
    where: { id: decoded.callSheetId },
    select: {
      id: true,
      shootTitle: true,
      shootDate: true,
      distributions: true,
      production: { select: { title: true } },
    },
  });
  if (!sheet) return null;
  const distributions = (
    Array.isArray(sheet.distributions) ? sheet.distributions : []
  ) as unknown as DistEntry[];
  const entry = distributions.find((d) => recipientKey(d) === decoded.recipient);
  return { sheet, distributions, entry, recipient: decoded.recipient };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const resolved = await resolve(token);
  if (!resolved) return NextResponse.json({ error: "Invalid link" }, { status: 404 });
  const { sheet, entry } = resolved;
  return NextResponse.json({
    shootTitle: sheet.shootTitle || sheet.production.title,
    shootDate: sheet.shootDate,
    recipientName: entry?.name ?? null,
    alreadyConfirmed: !!entry?.confirmedAt,
    confirmedAt: entry?.confirmedAt ?? null,
    found: !!entry,
  });
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const resolved = await resolve(token);
  if (!resolved) return NextResponse.json({ error: "Invalid link" }, { status: 404 });
  const { sheet, distributions, entry, recipient } = resolved;
  const now = new Date().toISOString();

  let next: DistEntry[];
  if (entry) {
    next = distributions.map((d) =>
      recipientKey(d) === recipient ? { ...d, confirmedAt: d.confirmedAt || now } : d
    );
  } else {
    // Recipient wasn't in the stored list yet — record them as confirmed.
    next = [
      ...distributions,
      { name: recipient, role: "", email: recipient.includes("@") ? recipient : "", sentAt: now, confirmedAt: now },
    ];
  }

  await prisma.callSheet.update({
    where: { id: sheet.id },
    data: { distributions: next as unknown as object[] },
  });
  return NextResponse.json({ success: true, confirmedAt: now });
}
