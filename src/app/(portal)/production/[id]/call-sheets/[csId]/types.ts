export type CallSheetStatus = "DRAFT" | "SAVED" | "PUBLISHED";

export interface ScheduleItem {
  time: string;
  description: string;
  notes: string;
}

export interface CrewMember {
  role: string;
  name: string;
  callTime: string;
  email: string;
  phone: string;
}

export type TalentMember = CrewMember;

export interface LocationData {
  address: string;
  parkingNotes: string;
  nearestHospital: string;
  whatThreeWords: string;
}

export type ShotStatus = "planned" | "in_progress" | "completed";

export interface Shot {
  description: string;
  setup: string;
  talent: string;
  equipment: string;
  duration: string;
  status: ShotStatus;
}

export interface DietaryItem {
  name: string;
  requirement: string;
}

export interface CateringDetails {
  headcountOverride: string;
  dietary: DietaryItem[];
  breakfast: string;
  lunch: string;
  snacks: string;
  provider: string;
  providerContact: string;
  notes: string;
}

export type DocType =
  | "shotlist"
  | "catering"
  | "location"
  | "release"
  | "insurance"
  | "other";

export interface Attachment {
  type: DocType;
  title: string;
  url: string;
}

export interface DailyForecast {
  date: string;
  tempMin: number;
  tempMax: number;
  condition: string;
  description: string;
  icon: string;
  wind: number;
  humidity: number;
}

export interface WeatherData {
  forecast: DailyForecast[];
  fetchedAt: string;
  lat: number;
  lng: number;
}

export interface NotesData {
  shootTitle: string;
  wrapTime: string;
  talent: TalentMember[];
  general: string;
  safety: string;
  parking: string;
}

export interface DistributionEntry {
  name: string;
  role: string;
  email: string;
  sentAt: string; // empty string until "Send to All" marks it sent
  confirmedAt?: string;
}

export interface ClientContactRef {
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
}

export interface TeamMemberRef {
  name: string;
  role: string;
  email: string | null;
  phone: string | null;
  status: string;
}

export interface CallSheet {
  id: string;
  status: CallSheetStatus;
  shootTitle: string | null;
  shootDate: string;
  callTime: string;
  wrapTime: string | null;
  location: LocationData;
  locationLat: number | null;
  locationLng: number | null;
  schedule: ScheduleItem[];
  shotlist: Shot[];
  crew: CrewMember[];
  talent: TalentMember[];
  cateringDetails: CateringDetails;
  documents: Attachment[];
  weatherData: WeatherData | null;
  productionNotes: string | null;
  safetyNotes: string | null;
  parkingNotes: string | null;
  notes: string | null; // legacy JSON blob, kept for backwards compat
  shareToken: string | null;
  distributions: DistributionEntry[];
  production: {
    id: string;
    title: string;
    budgetTotal: number | null;
    clientName: string | null;
    campaign: {
      title: string;
      briefContent: string | null;
      client: { name: string };
      billingContact: ClientContactRef | null;
    } | null;
    teamMembers: TeamMemberRef[];
  };
}

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  shotlist: "Shotlist",
  catering: "Catering Order",
  location: "Location Agreement",
  release: "Talent Release",
  insurance: "Insurance",
  other: "Other",
};

export const SHOT_STATUS_LABELS: Record<ShotStatus, string> = {
  planned: "Planned",
  in_progress: "In Progress",
  completed: "Completed",
};

export function emptyLocation(): LocationData {
  return { address: "", parkingNotes: "", nearestHospital: "", whatThreeWords: "" };
}

export function emptyCatering(): CateringDetails {
  return {
    headcountOverride: "",
    dietary: [],
    breakfast: "",
    lunch: "",
    snacks: "",
    provider: "",
    providerContact: "",
    notes: "",
  };
}

export function emptyShot(): Shot {
  return {
    description: "",
    setup: "",
    talent: "",
    equipment: "",
    duration: "",
    status: "planned",
  };
}

export function parseNotes(raw: string | null): NotesData {
  const defaults: NotesData = {
    shootTitle: "",
    wrapTime: "",
    talent: [],
    general: "",
    safety: "",
    parking: "",
  };
  if (!raw) return defaults;
  try {
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return defaults;
  }
}

export function serializeNotes(n: NotesData): string {
  return JSON.stringify(n);
}

interface LegacyCatering {
  vendor?: string;
  mealTimes?: string;
  dietaryNotes?: string;
}

// Reads catering from the cateringDetails column, falling back to the catering
// block that older call sheets stored inside their notes JSON.
export function migrateCatering(
  cateringDetails: CateringDetails | null | undefined,
  rawNotes: string | null
): CateringDetails {
  const base = emptyCatering();
  if (cateringDetails && typeof cateringDetails === "object" && !Array.isArray(cateringDetails)) {
    const merged = { ...base, ...cateringDetails };
    if (!Array.isArray(merged.dietary)) merged.dietary = [];
    const populated =
      merged.provider || merged.providerContact || merged.breakfast ||
      merged.lunch || merged.snacks || merged.notes || merged.dietary.length > 0;
    if (populated) return merged;
  }
  if (rawNotes) {
    try {
      const parsed = JSON.parse(rawNotes) as { catering?: LegacyCatering };
      const old = parsed.catering;
      if (old) {
        return {
          ...base,
          provider: old.vendor ?? "",
          snacks: old.mealTimes ?? "",
          notes: old.dietaryNotes ?? "",
        };
      }
    } catch {
      // ignore malformed notes
    }
  }
  return base;
}
