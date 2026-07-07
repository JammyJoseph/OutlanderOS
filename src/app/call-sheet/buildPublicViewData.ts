import type { CallSheetViewData } from "@/app/(portal)/production/[id]/call-sheets/[csId]/CallSheetDocument";
import type {
  CateringDetails,
  LocationData,
} from "@/app/(portal)/production/[id]/call-sheets/[csId]/types";
import {
  deriveLocations,
  emptyCatering,
  emptyEquipment,
  emptyHeader,
  emptyLocation,
  emptyMovementOrder,
  emptyProductionCompany,
  emptyShotStyle,
} from "@/app/(portal)/production/[id]/call-sheets/[csId]/types";

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

// Shared shape for the raw call sheet rows the public routes load.
interface RawSheet {
  shootTitle: string | null;
  shootDate: Date;
  callTime: string | null;
  wrapTime: string | null;
  location: unknown;
  locationLat: number | null;
  locationLng: number | null;
  weatherData: unknown;
  schedule: unknown;
  shotlist: unknown;
  locations: unknown;
  shotStyle: unknown;
  crew: unknown;
  talent: unknown;
  cateringDetails: unknown;
  documents: unknown;
  productionNotes: string | null;
  safetyNotes: string | null;
  parkingNotes: string | null;
  header: unknown;
  clientTeam: unknown;
  agencyTeam: unknown;
  productionCompany: unknown;
  callTimes: unknown;
  productionMobiles: unknown;
  movementOrder: unknown;
  equipment: unknown;
  production: {
    id: string;
    title: string;
    clientName: string | null;
    figmaUrl: string | null;
    campaign: { client: { name: string } } | null;
    prodDeliverables?: { type: string; title: string; notes: string | null }[];
  };
}

// Builds the CallSheetDocument view-model from a raw DB row for public routes.
export function buildPublicViewData(sheet: RawSheet): CallSheetViewData {
  const location =
    isObj(sheet.location)
      ? { ...emptyLocation(), ...(sheet.location as unknown as Partial<LocationData>) }
      : emptyLocation();
  const catering =
    isObj(sheet.cateringDetails)
      ? { ...emptyCatering(), ...(sheet.cateringDetails as unknown as Partial<CateringDetails>) }
      : emptyCatering();
  if (!Array.isArray(catering.dietary)) catering.dietary = [];

  const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

  return {
    shootTitle: sheet.shootTitle || sheet.production.title,
    clientName: sheet.production.campaign?.client?.name || sheet.production.clientName || "",
    productionTitle: sheet.production.title,
    shootDate: sheet.shootDate.toISOString().split("T")[0],
    callTime: sheet.callTime || "",
    wrapTime: sheet.wrapTime || "",
    location,
    locationLat: sheet.locationLat,
    locationLng: sheet.locationLng,
    locations: deriveLocations(sheet.locations, location, sheet.locationLat, sheet.locationLng),
    shotStyle: isObj(sheet.shotStyle)
      ? { ...emptyShotStyle(), ...(sheet.shotStyle as object) }
      : emptyShotStyle(),
    productionId: sheet.production.id,
    figmaUrl: sheet.production.figmaUrl ?? null,
    deliverables: (sheet.production.prodDeliverables ?? []).map((d) => ({
      type: d.type,
      title: d.title,
      notes: d.notes,
    })),
    weatherData: (sheet.weatherData as unknown as CallSheetViewData["weatherData"]) ?? null,
    schedule: arr(sheet.schedule),
    shotlist: arr(sheet.shotlist),
    crew: arr(sheet.crew),
    talent: arr(sheet.talent),
    catering,
    documents: arr(sheet.documents),
    notesGeneral: sheet.productionNotes || "",
    notesSafety: sheet.safetyNotes || "",
    notesParking: sheet.parkingNotes || "",
    header: isObj(sheet.header)
      ? { ...emptyHeader(), ...(sheet.header as object) }
      : emptyHeader(),
    clientTeam: arr(sheet.clientTeam),
    agencyTeam: arr(sheet.agencyTeam),
    productionCompany: isObj(sheet.productionCompany)
      ? { ...emptyProductionCompany(), ...(sheet.productionCompany as object) }
      : emptyProductionCompany(),
    callTimes: arr(sheet.callTimes),
    productionMobiles: arr(sheet.productionMobiles),
    movementOrder: isObj(sheet.movementOrder)
      ? { ...emptyMovementOrder(), ...(sheet.movementOrder as object) }
      : emptyMovementOrder(),
    equipment: isObj(sheet.equipment)
      ? { ...emptyEquipment(), ...(sheet.equipment as object) }
      : emptyEquipment(),
  };
}
