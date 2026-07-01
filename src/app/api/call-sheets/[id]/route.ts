import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { validateDate } from "@/lib/validate";
import { applyLegacyNotesShim } from "@/lib/call-sheet-legacy";

// Production context the editor needs: identity, budget reference, the linked
// Commercial deal (brief + client contact), and the team for crew import.
const productionInclude = {
  production: {
    select: {
      id: true,
      title: true,
      status: true,
      // Budget is never surfaced on a call sheet (portal overhaul rule #6).
      clientName: true,
      campaign: {
        select: {
          title: true,
          briefContent: true,
          client: { select: { name: true } },
          billingContact: {
            select: { name: true, email: true, phone: true, role: true },
          },
        },
      },
      teamMembers: {
        select: { name: true, role: true, email: true, phone: true, status: true },
        orderBy: { createdAt: "asc" as const },
      },
    },
  },
};

export const GET = withAuth(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  try {
    const sheet = await prisma.callSheet.findUnique({
      where: { id },
      include: productionInclude,
    });
    if (!sheet) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ sheet: applyLegacyNotesShim(sheet) });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
});

export const PUT = withAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const body = await request.json();
  if (body.shootDate !== undefined && !validateDate(body.shootDate)) {
    return NextResponse.json({ error: "Invalid shootDate" }, { status: 400 });
  }
  try {
    const updateData: Record<string, unknown> = {};
    if (body.shootTitle !== undefined) updateData.shootTitle = body.shootTitle;
    if (body.shootDate !== undefined) updateData.shootDate = new Date(body.shootDate);
    if (body.callTime !== undefined) updateData.callTime = body.callTime;
    if (body.wrapTime !== undefined) updateData.wrapTime = body.wrapTime;
    if (body.location !== undefined) updateData.location = body.location;
    if (body.locationLat !== undefined) updateData.locationLat = body.locationLat;
    if (body.locationLng !== undefined) updateData.locationLng = body.locationLng;
    if (body.schedule !== undefined) updateData.schedule = body.schedule;
    if (body.shotlist !== undefined) updateData.shotlist = body.shotlist;
    if (body.locations !== undefined) updateData.locations = body.locations;
    if (body.shotStyle !== undefined) updateData.shotStyle = body.shotStyle;
    if (body.crew !== undefined) updateData.crew = body.crew;
    if (body.talent !== undefined) updateData.talent = body.talent;
    if (body.cateringDetails !== undefined) updateData.cateringDetails = body.cateringDetails;
    if (body.documents !== undefined) updateData.documents = body.documents;
    if (body.weatherData !== undefined) updateData.weatherData = body.weatherData;
    if (body.header !== undefined) updateData.header = body.header;
    if (body.clientTeam !== undefined) updateData.clientTeam = body.clientTeam;
    if (body.agencyTeam !== undefined) updateData.agencyTeam = body.agencyTeam;
    if (body.productionCompany !== undefined) updateData.productionCompany = body.productionCompany;
    if (body.callTimes !== undefined) updateData.callTimes = body.callTimes;
    if (body.productionMobiles !== undefined) updateData.productionMobiles = body.productionMobiles;
    if (body.movementOrder !== undefined) updateData.movementOrder = body.movementOrder;
    if (body.equipment !== undefined) updateData.equipment = body.equipment;
    if (body.productionNotes !== undefined) updateData.productionNotes = body.productionNotes;
    if (body.safetyNotes !== undefined) updateData.safetyNotes = body.safetyNotes;
    if (body.parkingNotes !== undefined) updateData.parkingNotes = body.parkingNotes;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.distributions !== undefined) updateData.distributions = body.distributions;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.distributedAt !== undefined) {
      updateData.distributedAt = body.distributedAt ? new Date(body.distributedAt) : null;
    }

    // Publishing mints the public share tokens (once each — the links stay
    // stable across unpublish/republish cycles). The internal token shows the
    // full sheet; the client token renders the redacted version.
    if (body.status === "PUBLISHED") {
      const existing = await prisma.callSheet.findUnique({
        where: { id },
        select: { shareToken: true, clientShareToken: true },
      });
      if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
      if (!existing.shareToken) updateData.shareToken = randomUUID();
      if (!existing.clientShareToken) updateData.clientShareToken = randomUUID();
    }

    const sheet = await prisma.callSheet.update({
      where: { id },
      data: updateData,
      include: productionInclude,
    });
    return NextResponse.json({ sheet: applyLegacyNotesShim(sheet) });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
});

export const DELETE = withAuth(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  try {
    await prisma.callSheet.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
});
