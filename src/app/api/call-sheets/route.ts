import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { validateRequired, validateDate } from "@/lib/validate";

export const GET = withAuth(async () => {
  try {
    const sheets = await prisma.callSheet.findMany({
      include: { production: { select: { title: true } } },
      orderBy: { shootDate: "desc" },
      take: 20,
    });
    return NextResponse.json({ sheets });
  } catch {
    return NextResponse.json({ sheets: [] });
  }
});

export const POST = withAuth(async (request: NextRequest) => {
  const body = await request.json();

  const missing = validateRequired(body, ["productionId", "shootDate"]);
  if (missing) return NextResponse.json({ error: missing }, { status: 400 });
  if (!validateDate(body.shootDate)) {
    return NextResponse.json({ error: "Invalid shootDate" }, { status: 400 });
  }

  try {
    // Pull the brief from the linked Commercial deal (or the production's own
    // brief) so a fresh call sheet starts with production notes filled in.
    const production = await prisma.production.findUnique({
      where: { id: body.productionId },
      select: {
        title: true,
        brief: true,
        campaign: { select: { briefContent: true } },
      },
    });
    if (!production) {
      return NextResponse.json({ error: "Production not found" }, { status: 404 });
    }
    const autoNotes = production.campaign?.briefContent || production.brief || null;

    // Optional richer fields — used by the call-sheet wizard and clone (Phase
    // 4G) to create a fully-populated sheet in a single call. All are JSON
    // columns with sensible defaults, so unset values just fall back.
    const opt: Record<string, unknown> = {};
    if (body.wrapTime !== undefined) opt.wrapTime = body.wrapTime;
    if (body.locationLat !== undefined) opt.locationLat = body.locationLat;
    if (body.locationLng !== undefined) opt.locationLng = body.locationLng;
    if (body.locations !== undefined) opt.locations = body.locations;
    if (body.shotStyle !== undefined) opt.shotStyle = body.shotStyle;
    if (body.shotlist !== undefined) opt.shotlist = body.shotlist;
    if (body.cateringDetails !== undefined) opt.cateringDetails = body.cateringDetails;
    if (body.documents !== undefined) opt.documents = body.documents;
    if (body.weatherData !== undefined) opt.weatherData = body.weatherData;
    if (body.header !== undefined) opt.header = body.header;
    if (body.clientTeam !== undefined) opt.clientTeam = body.clientTeam;
    if (body.agencyTeam !== undefined) opt.agencyTeam = body.agencyTeam;
    if (body.productionCompany !== undefined) opt.productionCompany = body.productionCompany;
    if (body.callTimes !== undefined) opt.callTimes = body.callTimes;
    if (body.productionMobiles !== undefined) opt.productionMobiles = body.productionMobiles;
    if (body.movementOrder !== undefined) opt.movementOrder = body.movementOrder;
    if (body.equipment !== undefined) opt.equipment = body.equipment;
    if (body.safetyNotes !== undefined) opt.safetyNotes = body.safetyNotes;
    if (body.parkingNotes !== undefined) opt.parkingNotes = body.parkingNotes;

    const sheet = await prisma.callSheet.create({
      data: {
        productionId: body.productionId,
        shootTitle: body.shootTitle || body.title || production.title,
        shootDate: new Date(body.shootDate),
        callTime: body.callTime || "08:00",
        location: body.location || {},
        schedule: body.schedule || [],
        crew: body.crew || [],
        talent: body.talent || [],
        productionNotes: body.productionNotes ?? autoNotes,
        notes: body.notes || "",
        status: body.status || "DRAFT",
        ...opt,
      },
    });
    return NextResponse.json({ sheet });
  } catch (e) {
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
});
