import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { sanitizeString } from "@/lib/validate";
import { sumLineItems, type IOLineItem, type IOStatus } from "@/lib/io-template";

const STATUSES: IOStatus[] = ["DRAFT", "SENT", "SIGNED", "VOID"];

// Coerce whatever the client sent into a clean line-item array. Subtotal is
// editable on the document (the PDF's subtotals aren't always qty × rate), so
// it's taken as sent and only falls back to qty × rate when missing.
function parseLineItems(raw: unknown): IOLineItem[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.map((li: Record<string, unknown>) => {
    const quantity = Number(li?.quantity) || 0;
    const rate = Number(li?.rate) || 0;
    const subtotal =
      li?.subtotal === undefined || li?.subtotal === null || li?.subtotal === ""
        ? quantity * rate
        : Number(li.subtotal) || 0;
    return {
      startDate: sanitizeString(li?.startDate),
      endDate: sanitizeString(li?.endDate),
      description: sanitizeString(li?.description),
      quantity,
      rate,
      subtotal,
    };
  });
}

// GET /api/insertion-orders/[ioId] — single IO with its deal context
export const GET = withAuth(async (
  _request: NextRequest,
  { params }: { params: Promise<{ ioId: string }> }
) => {
  try {
    const { ioId } = await params;
    const insertionOrder = await prisma.insertionOrder.findUnique({
      where: { id: ioId },
      include: {
        campaign: {
          select: {
            id: true,
            title: true,
            client: { select: { id: true, name: true } },
            billingContact: { select: { name: true, email: true } },
          },
        },
      },
    });
    if (!insertionOrder) return NextResponse.json({ error: "Insertion order not found" }, { status: 404 });
    return NextResponse.json({ insertionOrder });
  } catch (err) {
    console.error("GET /api/insertion-orders/[ioId]", err);
    return NextResponse.json({ error: "Failed to fetch insertion order" }, { status: 500 });
  }
});

// PUT /api/insertion-orders/[ioId] — update fields and/or transition status.
// totalNet is always recomputed server-side from the line items on the row.
export const PUT = withAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ ioId: string }> },
  user
) => {
  try {
    const { ioId } = await params;
    const body = await request.json();

    const existing = await prisma.insertionOrder.findUnique({
      where: { id: ioId },
      include: { campaign: { select: { id: true, title: true } } },
    });
    if (!existing) return NextResponse.json({ error: "Insertion order not found" }, { status: 404 });

    const data: Record<string, unknown> = {};

    const str = (key: string, nullable = true, maxLength = 1000) => {
      if (body[key] === undefined) return;
      const v = sanitizeString(String(body[key] ?? ""), maxLength);
      data[key] = v || (nullable ? null : "");
    };
    str("advertiserName", false);
    str("campaignName", false);
    str("poNumber");
    str("contactName");
    str("contactEmail");
    str("notes", true, 10000);
    str("signedName");
    str("signedTitle");
    str("signedFileUrl");
    if (body.clientOrAgency !== undefined) {
      data.clientOrAgency = body.clientOrAgency === "AGENCY" ? "AGENCY" : "CLIENT";
    }

    if (body.lineItems !== undefined) {
      const items = parseLineItems(body.lineItems);
      if (!items) return NextResponse.json({ error: "lineItems must be an array" }, { status: 400 });
      data.lineItems = items;
      data.totalNet = sumLineItems(items);
    }

    // ── Status transitions ──
    if (body.status !== undefined) {
      const status = String(body.status).toUpperCase() as IOStatus;
      if (!STATUSES.includes(status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      data.status = status;
      if (status === "SENT" && existing.status !== "SENT") data.sentAt = new Date();
      if (status === "SIGNED" && existing.status !== "SIGNED") {
        data.signedAt = new Date();
      }
    }

    const insertionOrder = await prisma.insertionOrder.update({
      where: { id: ioId },
      data,
    });

    // Signing the IO flips the deal's IO flags and logs the milestone.
    if (data.status === "SIGNED" && existing.status !== "SIGNED") {
      await prisma.campaign.update({
        where: { id: existing.campaignId },
        data: { ioSigned: true, ioSignedAt: new Date() },
      });
      await prisma.dealActivity.create({
        data: {
          campaignId: existing.campaignId,
          type: "field_update",
          message: `Insertion order ${existing.ioNumber} marked as signed`,
          meta: { ioId: existing.id, ioNumber: existing.ioNumber, status: "SIGNED" },
          userId: user.userId,
          userName: user.name,
        },
      });
    } else if (data.status === "SENT" && existing.status !== "SENT") {
      await prisma.dealActivity.create({
        data: {
          campaignId: existing.campaignId,
          type: "field_update",
          message: `Insertion order ${existing.ioNumber} sent to client`,
          meta: { ioId: existing.id, ioNumber: existing.ioNumber, status: "SENT" },
          userId: user.userId,
          userName: user.name,
        },
      });
    }

    return NextResponse.json({ insertionOrder });
  } catch (err) {
    console.error("PUT /api/insertion-orders/[ioId]", err);
    return NextResponse.json({ error: "Failed to update insertion order" }, { status: 500 });
  }
});

// DELETE /api/insertion-orders/[ioId] — drafts only; anything sent or signed
// is a record and must be voided instead.
export const DELETE = withAuth(async (
  _request: NextRequest,
  { params }: { params: Promise<{ ioId: string }> },
  user
) => {
  try {
    const { ioId } = await params;
    const existing = await prisma.insertionOrder.findUnique({ where: { id: ioId } });
    if (!existing) return NextResponse.json({ error: "Insertion order not found" }, { status: 404 });
    if (existing.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Only draft insertion orders can be deleted — void it instead." },
        { status: 400 }
      );
    }
    await prisma.insertionOrder.delete({ where: { id: ioId } });
    await prisma.dealActivity.create({
      data: {
        campaignId: existing.campaignId,
        type: "field_update",
        message: `Insertion order ${existing.ioNumber} (draft) deleted`,
        meta: { ioNumber: existing.ioNumber },
        userId: user.userId,
        userName: user.name,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/insertion-orders/[ioId]", err);
    return NextResponse.json({ error: "Failed to delete insertion order" }, { status: 500 });
  }
});
