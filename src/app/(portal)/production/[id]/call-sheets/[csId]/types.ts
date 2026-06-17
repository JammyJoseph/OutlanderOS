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
  nearestStation?: string;
  transportNotes?: string;
  safetyNotes?: string;
}

// ── Industry-standard call sheet sections ──
export interface CallSheetHeader {
  productionCompany: string; // default "Outlander"
  jobNumber: string;
}

export interface ClientTeamMember {
  role: string;
  name: string;
}

export interface AgencyTeamMember {
  role: string;
  name: string;
  phone: string;
  email: string;
}

export interface ProductionCompanyInfo {
  name: string;
  address: string;
  execProducer: string;
  producer: string;
}

export interface CallTimeRow {
  time: string;
  department: string;
}

export interface ProductionMobile {
  role: string;
  name: string;
  phone: string;
}

export interface MovementOrder {
  siteEntrance: string;
  techParking: string;
  crewParking: string;
  routeNotes: string;
}

export interface EquipmentInfo {
  cameraSupplier: string;
  cameraContact: string;
  cameraEmail: string;
  lightingSupplier: string;
  lightingContact: string;
  lightingEmail: string;
  otherNotes: string;
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

export interface HourlyForecast {
  time: string; // HH:mm
  date: string; // YYYY-MM-DD
  temp: number;
  condition: string;
  description: string;
  icon: string;
  wind: number;
  windDeg: number;
  pop: number; // precipitation probability %
  humidity: number;
}

export interface WeatherData {
  forecast: DailyForecast[];
  hourly?: HourlyForecast[];
  hourlyDate?: string;
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
  clientShareToken: string | null;
  header: CallSheetHeader;
  clientTeam: ClientTeamMember[];
  agencyTeam: AgencyTeamMember[];
  productionCompany: ProductionCompanyInfo;
  callTimes: CallTimeRow[];
  productionMobiles: ProductionMobile[];
  movementOrder: MovementOrder;
  equipment: EquipmentInfo;
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
  return {
    address: "",
    parkingNotes: "",
    nearestHospital: "",
    whatThreeWords: "",
    nearestStation: "",
    transportNotes: "",
    safetyNotes: "",
  };
}

export function emptyHeader(): CallSheetHeader {
  return { productionCompany: "Outlander", jobNumber: "" };
}

export function emptyProductionCompany(): ProductionCompanyInfo {
  return { name: "", address: "", execProducer: "", producer: "" };
}

export function emptyMovementOrder(): MovementOrder {
  return { siteEntrance: "", techParking: "", crewParking: "", routeNotes: "" };
}

export function emptyEquipment(): EquipmentInfo {
  return {
    cameraSupplier: "",
    cameraContact: "",
    cameraEmail: "",
    lightingSupplier: "",
    lightingContact: "",
    lightingEmail: "",
    otherNotes: "",
  };
}

// Default staggered call-time template (Jimmy Choo format)
export function defaultCallTimes(): CallTimeRow[] {
  return [
    { time: "08:00", department: "Prod / Runners / Director" },
    { time: "08:00", department: "HMU" },
    { time: "08:00", department: "Glam & Styling" },
    { time: "08:30", department: "Talent Call" },
    { time: "09:30", department: "Client Call" },
    { time: "10:00", department: "Main Unit Call" },
  ];
}

// Default client-side roles
export const CLIENT_TEAM_ROLES = [
  "SVP of Creative",
  "Comms Director",
  "Art Director",
  "Head of Marketing",
  "Head of Socials",
];

// Default Outlander agency roles
export const AGENCY_TEAM_ROLES = [
  "Commercial Director",
  "Operations Manager",
  "Head of Creative",
];

// Common crew role presets for the Unit List
export const CREW_ROLE_PRESETS = [
  "Director / Photographer",
  "Producer",
  "2nd AD",
  "AD Runner",
  "1st Assistant Camera",
  "2nd Assistant Camera",
  "Camera Car Driver",
  "DIT",
  "Digi Op",
  "Gaffer",
  "Electrician",
  "Production Designer",
  "Stylist",
  "Grooming",
  "Make Up",
  "MU + Wardrobe Split",
  "Socials Photographer",
  "Socials Photo Assist",
];

// Auto-included boilerplate — fixed text shown on every call sheet
export const CONDUCT_POLICY = `Outlander is committed to providing a safe, professional and respectful working environment for everyone on set. All cast, crew and clients are expected to treat colleagues fairly and with respect, regardless of role, seniority, gender, race, sexuality, disability or background.

Bullying, harassment, discrimination and intimidation of any kind will not be tolerated. If you experience or witness unacceptable behaviour, please raise it confidentially with the Producer or a member of the Outlander team.

This production follows AdGreen sustainability guidelines. Please minimise waste, recycle where facilities allow, avoid single-use plastics, and switch off equipment and lighting when not in use. Car-share or use public transport to the location where possible.`;

export const CONFIDENTIALITY_NOTICE = `This call sheet and all information contained within it — including talent, location, schedule, contact details and creative direction — is strictly confidential and the property of Outlander and its client.

It is intended solely for the named recipients. Do not forward, copy, photograph or share this document, the shoot details or any imagery from set on social media or with third parties without prior written approval from the production team. Any breach of confidentiality may result in removal from the production.`;

// Section keys for the PDF export toggle and document rendering
export type SectionKey =
  | "header"
  | "agencyTeam"
  | "productionCompany"
  | "callTimes"
  | "productionMobiles"
  | "location"
  | "schedule"
  | "shotlist"
  | "conduct"
  | "confidentiality"
  | "crew"
  | "talent"
  | "catering"
  | "equipment"
  | "documents"
  | "weather"
  | "notes";

export const ALL_SECTIONS: { key: SectionKey; label: string }[] = [
  { key: "header", label: "Header & Client Info" },
  { key: "agencyTeam", label: "Agency Team" },
  { key: "productionCompany", label: "Production Company" },
  { key: "callTimes", label: "Call Times" },
  { key: "productionMobiles", label: "Production Mobiles" },
  { key: "location", label: "Location & Movement Order" },
  { key: "weather", label: "Weather" },
  { key: "schedule", label: "Schedule" },
  { key: "shotlist", label: "Shotlist" },
  { key: "conduct", label: "Conduct Policy" },
  { key: "confidentiality", label: "Confidentiality Notice" },
  { key: "crew", label: "Unit List (Crew)" },
  { key: "talent", label: "Talent" },
  { key: "catering", label: "Catering" },
  { key: "equipment", label: "Equipment" },
  { key: "documents", label: "Documents" },
  { key: "notes", label: "Notes" },
];

export function allSectionsVisible(): Record<SectionKey, boolean> {
  return ALL_SECTIONS.reduce(
    (acc, s) => ({ ...acc, [s.key]: true }),
    {} as Record<SectionKey, boolean>
  );
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
