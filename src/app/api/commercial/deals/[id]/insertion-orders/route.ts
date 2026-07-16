import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { formatIoNumber, type IOLineItem } from "@/lib/io-template";
import { format } from "date-fns";

// GET /api/commercial/deals/[id]/insertion-orders — list IOs for a deal
export const GET = withAuth(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;
    const insertionOrders = await prisma.insertionOrder.findMany({
      where: { campaignId: id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ insertionOrders });
  } catch (err) {
    console.error("GET /api/commercial/deals/[id]/insertion-orders", err);
    return NextResponse.json({ error: "Failed to fetch insertion orders" }, { status: 500 });
  }
});

// POST /api/commercial/deals/[id]/insertion-orders — create a new IO,
// prefilled from the deal (client, title, billing contact, deliverables).
export const POST = withAuth(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  user
) => {
  try {
    const { id } = await params;
    const deal = await prisma.campaign.findUnique({
      where: { id },
      include: {
        client: { select: { name: true } },
        billingContact: { select: { name: true, email: true } },
        deliverables: {
          where: { isAdditional: false },
          orderBy: { dueDate: { sort: "asc", nulls: "last" } },
        },
      },
    });
    if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

    // Seed line items from the contracted deliverables. Deliverables carry no
    // per-line pricing, so rates start at 0 for the editor to fill in.
    const lineItems: IOLineItem[] = deal.deliverables.map((d) => {
      const when = d.dueDate ? format(d.dueDate, "MMM yyyy") : "";
      return {
        startDate: when,
        endDate: when,
        description: `${d.quantity}x ${(d.title ?? d.type).toUpperCase()}`,
        quantity: d.quantity,
        rate: 0,
        subtotal: 0,
      };
    });
    if (lineItems.length === 0) {
      // Always give the editor at least one row to start from.
      lineItems.push({
        startDate: "",
        endDate: "",
        description: "",
        quantity: 1,
        rate: deal.value ?? 0,
        subtotal: deal.value ?? 0,
      });
    }

    // Auto-generate the IO number inside the transaction: max sequence for the
    // current year, +1. The unique constraint on ioNumber backstops any race.
    const year = new Date().getFullYear();
    const prefix = `OM-${year}-`;
    const io = await prisma.$transaction(async (tx) => {
      const existing = await tx.insertionOrder.findMany({
        where: { ioNumber: { startsWith: prefix } },
        select: { ioNumber: true },
      });
      const maxSeq = existing.reduce((max, { ioNumber }) => {
        const seq = parseInt(ioNumber.slice(prefix.length), 10);
        return Number.isFinite(seq) && seq > max ? seq : max;
      }, 0);
      return tx.insertionOrder.create({
        data: {
          campaignId: id,
          ioNumber: formatIoNumber(year, maxSeq + 1),
          advertiserName: deal.client.name,
          campaignName: deal.title,
          contactName: deal.billingContact?.name ?? null,
          contactEmail: deal.billingContact?.email ?? null,
          lineItems: lineItems as unknown as object,
          totalNet: deal.value ?? lineItems.reduce((t, li) => t + li.subtotal, 0),
          createdById: user.userId,
        },
      });
    });

    await prisma.dealActivity.create({
      data: {
        campaignId: id,
        type: "field_update",
        message: `Insertion order ${io.ioNumber} created`,
        meta: { ioId: io.id, ioNumber: io.ioNumber },
        userId: user.userId,
        userName: user.name,
      },
    });

    return NextResponse.json({ insertionOrder: io }, { status: 201 });
  } catch (err) {
    console.error("POST /api/commercial/deals/[id]/insertion-orders", err);
    return NextResponse.json({ error: "Failed to create insertion order" }, { status: 500 });
  }
});
