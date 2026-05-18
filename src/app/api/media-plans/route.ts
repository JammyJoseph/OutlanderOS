import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { validateRequired, sanitizeString } from "@/lib/validate";

export const GET = withAuth(async () => {
  try {
    const plans = await prisma.mediaPlan.findMany({
      include: {
        lineItems: { orderBy: { sortOrder: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(plans);
  } catch (err) {
    console.error("GET /api/media-plans", err);
    return NextResponse.json({ error: "Failed to fetch media plans" }, { status: 500 });
  }
});

export const POST = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const {
      campaignId,
      flightStart,
      flightEnd,
      currency,
      contactName,
      contactEmail,
      status,
      lineItems,
    } = body;

    const missing = validateRequired(body, ["clientName", "campaignName"]);
    if (missing) return NextResponse.json({ error: missing }, { status: 400 });

    const clientName = sanitizeString(body.clientName, 200);
    const campaignName = sanitizeString(body.campaignName, 300);

    const plan = await prisma.mediaPlan.create({
      data: {
        campaignId: campaignId || null,
        clientName,
        campaignName,
        flightStart: flightStart ? new Date(flightStart) : null,
        flightEnd: flightEnd ? new Date(flightEnd) : null,
        currency: currency ?? "GBP",
        contactName: contactName || null,
        contactEmail: contactEmail || null,
        status: status ?? "draft",
        lineItems: {
          create: (lineItems ?? []).map(
            (
              item: {
                site: string;
                startDate?: string;
                endDate?: string;
                placement: string;
                rate?: number;
                rateType?: string;
                discount?: number;
                units?: number;
                grossCost?: number;
                netCost?: number;
                projectedCreative?: string;
                deliveryStatus?: string;
                sortOrder?: number;
              },
              idx: number
            ) => ({
              site: item.site || "",
              startDate: item.startDate ? new Date(item.startDate) : null,
              endDate: item.endDate ? new Date(item.endDate) : null,
              placement: item.placement || "",
              rate: item.rate ?? 0,
              rateType: item.rateType ?? "Flat Fee",
              discount: item.discount ?? 0,
              units: item.units ?? 1,
              grossCost: item.grossCost ?? 0,
              netCost: item.netCost ?? 0,
              projectedCreative: item.projectedCreative || null,
              deliveryStatus: item.deliveryStatus ?? "planned",
              sortOrder: item.sortOrder ?? idx,
            })
          ),
        },
      },
      include: {
        lineItems: { orderBy: { sortOrder: "asc" } },
      },
    });

    return NextResponse.json(plan, { status: 201 });
  } catch (err) {
    console.error("POST /api/media-plans", err);
    return NextResponse.json({ error: "Failed to create media plan" }, { status: 500 });
  }
});
