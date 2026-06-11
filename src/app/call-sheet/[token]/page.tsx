import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import { applyLegacyNotesShim } from "@/lib/call-sheet-legacy";
import type { CallSheetViewData } from "@/app/(portal)/production/[id]/call-sheets/[csId]/CallSheetDocument";
import type {
  CateringDetails,
  LocationData,
} from "@/app/(portal)/production/[id]/call-sheets/[csId]/types";
import {
  emptyCatering,
  emptyLocation,
} from "@/app/(portal)/production/[id]/call-sheets/[csId]/types";
import { PublicCallSheetView } from "./PublicCallSheetView";

export const metadata: Metadata = {
  title: "Call Sheet — Outlander",
};

// Public, token-gated call sheet for crew and talent. No login required —
// the proxy allowlists /call-sheet/ and the unguessable token is the only key.
export default async function PublicCallSheetPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const raw = token
    ? await prisma.callSheet.findUnique({
        where: { shareToken: token },
        include: {
          production: {
            select: {
              title: true,
              clientName: true,
              campaign: { select: { client: { select: { name: true } } } },
            },
          },
        },
      })
    : null;

  if (!raw || raw.status !== "PUBLISHED") {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <p className="text-sm font-extrabold tracking-[0.3em] uppercase text-gray-900 mb-6">
            Outlander
          </p>
          <h1 className="text-lg font-semibold text-gray-900 mb-2">
            Call sheet not available
          </h1>
          <p className="text-sm text-gray-500">
            This link is invalid or the call sheet is no longer published. Ask the
            production team for an updated link.
          </p>
        </div>
      </div>
    );
  }

  const sheet = applyLegacyNotesShim(raw);
  const location =
    sheet.location && typeof sheet.location === "object" && !Array.isArray(sheet.location)
      ? { ...emptyLocation(), ...(sheet.location as unknown as Partial<LocationData>) }
      : emptyLocation();
  const catering =
    sheet.cateringDetails &&
    typeof sheet.cateringDetails === "object" &&
    !Array.isArray(sheet.cateringDetails)
      ? { ...emptyCatering(), ...(sheet.cateringDetails as unknown as Partial<CateringDetails>) }
      : emptyCatering();
  if (!Array.isArray(catering.dietary)) catering.dietary = [];

  const viewData: CallSheetViewData = {
    shootTitle: sheet.shootTitle || sheet.production.title,
    clientName:
      sheet.production.campaign?.client?.name || sheet.production.clientName || "",
    shootDate: sheet.shootDate.toISOString().split("T")[0],
    callTime: sheet.callTime || "",
    wrapTime: sheet.wrapTime || "",
    location,
    locationLat: sheet.locationLat,
    locationLng: sheet.locationLng,
    weatherData: (sheet.weatherData as unknown as CallSheetViewData["weatherData"]) ?? null,
    schedule: Array.isArray(sheet.schedule)
      ? (sheet.schedule as unknown as CallSheetViewData["schedule"])
      : [],
    shotlist: Array.isArray(sheet.shotlist)
      ? (sheet.shotlist as unknown as CallSheetViewData["shotlist"])
      : [],
    crew: Array.isArray(sheet.crew) ? (sheet.crew as unknown as CallSheetViewData["crew"]) : [],
    talent: Array.isArray(sheet.talent)
      ? (sheet.talent as unknown as CallSheetViewData["talent"])
      : [],
    catering,
    documents: Array.isArray(sheet.documents)
      ? (sheet.documents as unknown as CallSheetViewData["documents"])
      : [],
    notesGeneral: sheet.productionNotes || "",
    notesSafety: sheet.safetyNotes || "",
    notesParking: sheet.parkingNotes || "",
  };

  return <PublicCallSheetView viewData={viewData} />;
}
