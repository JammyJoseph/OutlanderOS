import { withErrorHandling } from "@/lib/api-error"
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

const GET__h = withAuth(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;
    const plan = await prisma.mediaPlan.findUnique({
      where: { id },
      include: {
        lineItems: { orderBy: { sortOrder: "asc" } },
      },
    });
    if (!plan) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(plan);
  } catch (err) {
    console.error("GET /api/media-plans/[id]", err);
    return NextResponse.json({ error: "Failed to fetch media plan" }, { status: 500 });
  }
});

const PUT__h = withAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      clientName,
      campaignName,
      flightStart,
      flightEnd,
      currency,
      contactName,
      contactEmail,
      status,
      lineItems,
    } = body;

    await prisma.mediaPlanLineItem.deleteMany({ where: { mediaPlanId: id } });

    const plan = await prisma.mediaPlan.update({
      where: { id },
      data: {
        ...(clientName !== undefined ? { clientName: clientName.trim() } : {}),
        ...(campaignName !== undefined ? { campaignName: campaignName.trim() } : {}),
        ...(flightStart !== undefined
          ? { flightStart: flightStart ? new Date(flightStart) : null }
          : {}),
        ...(flightEnd !== undefined
          ? { flightEnd: flightEnd ? new Date(flightEnd) : null }
          : {}),
        ...(currency !== undefined ? { currency } : {}),
        ...(contactName !== undefined ? { contactName: contactName || null } : {}),
        ...(contactEmail !== undefined ? { contactEmail: contactEmail || null } : {}),
        ...(status !== undefined ? { status } : {}),
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

    return NextResponse.json(plan);
  } catch (err) {
    console.error("PUT /api/media-plans/[id]", err);
    return NextResponse.json({ error: "Failed to update media plan" }, { status: 500 });
  }
});

const DELETE__h = withAuth(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;
    await prisma.mediaPlan.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/media-plans/[id]", err);
    return NextResponse.json({ error: "Failed to delete media plan" }, { status: 500 });
  }
});

export const GET = withErrorHandling(GET__h as any)
export const PUT = withErrorHandling(PUT__h as any)
export const DELETE = withErrorHandling(DELETE__h as any)
