export type CallSheetStatus = "DRAFT" | "SAVED" | "PUBLISHED";

export interface ScheduleItem {
  time: string;
  description: string;
  notes: string;
  // Name of the CallSheetLocation this block happens at. Optional/back-compat —
  // when set, the movement order auto-inserts a travel leg on location changes.
  locationRef?: string;
  // ── Day-schedule fields (all optional, so old sheets read unchanged) ──
  // How long the block runs. Shown beside the time and used to sanity-read the
  // day; not enforced against the next row's start.
  durationMins?: number | null;
  // One of SCHEDULE_CATEGORIES' ids — drives the colour coding. Free rows
  // without one render neutral.
  category?: string | null;
  // Free-text location for this block ("Barbican 1"). Distinct from
  // locationRef, which must name a CallSheetLocation.
  location?: string | null;
  // A sub-point between key timings ("09:55 Talent to Location 1, 5 mins").
  // Renders lighter and indented, on screen and in print.
  minor?: boolean;
}

// ── Day-schedule categories ─────────────────────────────────────────────────
// The colour coding. Muted, print-legible tones — the sheet is a hairline
// monochrome document, so colour is a small accent that must survive print,
// not a highlighter pen.
export const SCHEDULE_CATEGORIES: { id: string; label: string; hex: string }[] = [
  { id: "CREW", label: "Crew / prep", hex: "#52525b" },
  { id: "TALENT", label: "Talent", hex: "#0e7490" },
  { id: "GLAM", label: "Glam / HMUA", hex: "#be185d" },
  { id: "STYLING", label: "Styling", hex: "#b45309" },
  { id: "PHOTO", label: "Photography", hex: "#1a7f4b" },
  { id: "VIDEO", label: "Video", hex: "#5b21b6" },
  { id: "TRAVEL", label: "Travel", hex: "#0369a1" },
  { id: "MEAL", label: "Meals", hex: "#92400e" },
  { id: "WRAP", label: "Wrap", hex: "#111111" },
  { id: "OTHER", label: "Other", hex: "#6b7280" },
];

export const scheduleCategoryHex = (id: string | null | undefined): string =>
  SCHEDULE_CATEGORIES.find((c) => c.id === id)?.hex ?? "#6b7280";

// Guess the category from the words people actually write. Order matters:
// "Talent travel" is travel, "Look 1 Photo" is photography not styling, and
// "Talent Call / Glam" is glam time even though it names the talent.
export function inferScheduleCategory(text: string): string | null {
  const t = (text || "").toLowerCase();
  if (!t.trim()) return null;
  if (/\bwrap\b/.test(t)) return "WRAP";
  if (/\b(lunch|breakfast|dinner|catering|meal)\b/.test(t)) return "MEAL";
  if (/\b(travel|transit|move (?:to|talent|crew)|departure|walk|arriv(?:e|al)s?)\b/.test(t)) return "TRAVEL";
  if (/\b(video|motion|film(?:ing)?)\b/.test(t)) return "VIDEO";
  if (/\bphoto(?:graphy|grapher)?s?\b/.test(t)) return "PHOTO";
  if (/\b(glam|hmua?|hair|make[- ]?up|grooming)\b/.test(t)) return "GLAM";
  if (/\b(styling|wardrobe|fitting|look[- ]?\d*\s*change|change)\b/.test(t)) return "STYLING";
  if (/\b(crew (?:call|prep)|prep|set[- ]?up|equipment|derig|pack[- ]?down)\b/.test(t)) return "CREW";
  if (/\btalent\b/.test(t)) return "TALENT";
  return null;
}

export interface CrewMember {
  role: string;
  name: string;
  // The one time this person is called. Blank means they're on the unit call —
  // read it through effectiveCallTime(), which resolves that fallback.
  callTime: string;
  email: string;
  phone: string;
}

export type TalentMember = CrewMember;

// ── Call times ───────────────────────────────────────────────────────────────
// Every person on the sheet has exactly ONE call time, shown once, in the crew
// or talent list. The sheet's unit call is the default a blank row falls back
// to — nothing more. A person called at a different time is not a special case
// and is never labelled, flagged, or listed a second time anywhere; it is just
// their call time. Older sheets have no unitCallTime, so it falls back to the
// legacy `callTime` column (kept mirrored on save).

export function resolveUnitCall(
  unitCallTime: string | null | undefined,
  legacyCallTime: string | null | undefined
): string {
  return (unitCallTime || "").trim() || (legacyCallTime || "").trim();
}

// The call time this person actually turns up at.
export function effectiveCallTime(
  person: { callTime?: string },
  unitCall: string
): string {
  return (person.callTime || "").trim() || unitCall;
}

// ── Chronological ordering ───────────────────────────────────────────────────
// Every time-based list on a call sheet — the run of the day, the call-time
// table, the crew and talent rosters — reads in clock order. Rows with no time
// yet sink to the bottom instead of sorting as though they were midnight, and
// the sort is stable, so rows sharing a time keep the order they were entered
// in (which is how a dragged-into-place run of the day survives).

// "HH:mm" → minutes since midnight. Untimed / unparseable rows rank last.
export function timeRank(time: string | null | undefined): number {
  const m = String(time ?? "").trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return Number.POSITIVE_INFINITY;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return Number.POSITIVE_INFINITY;
  return h * 60 + min;
}

export function sortByTime<T>(rows: T[], time: (row: T) => string | null | undefined): T[] {
  return [...rows].sort((a, b) => {
    const ra = timeRank(time(a));
    const rb = timeRank(time(b));
    if (ra === rb) return 0; // includes two untimed rows (Infinity === Infinity)
    return ra < rb ? -1 : 1;
  });
}

export function sortSchedule(items: ScheduleItem[]): ScheduleItem[] {
  return sortByTime(items, (s) => s.time);
}

export function sortCallTimes(rows: CallTimeRow[]): CallTimeRow[] {
  return sortByTime(rows, (r) => r.time);
}

// Crew / talent by the time they actually turn up: someone with no override
// sorts on the unit call, so the roster stays in call order end to end.
export function sortRoster<T extends { callTime?: string }>(people: T[], unitCall: string): T[] {
  return sortByTime(people, (p) => effectiveCallTime(p, unitCall));
}

// The roster order used on the printed sheet: call time first, then production
// hierarchy within each time.
//
// Time has to lead, because the sheet is read on the day by someone asking "who
// is here now" — sorting by role first scatters a single call time down the
// page. Role breaks the tie so that everyone arriving at 08:00 still reads
// Producer, Director, DOP rather than in entry order.
//
// Defined here rather than composing sortByTime and sortByRolePriority: running
// them in sequence works only because JS sorts are stable, which is a subtle
// thing to depend on and silently wrong if either is ever reordered.
export function sortRosterByCallThenRole<T extends { callTime?: string; role?: string }>(
  people: T[],
  unitCall: string
): T[] {
  return people
    .map((p, i) => ({ p, i }))
    .sort((a, b) => {
      const ta = timeRank(effectiveCallTime(a.p, unitCall));
      const tb = timeRank(effectiveCallTime(b.p, unitCall));
      // Both untimed is a tie — subtracting two Infinities gives NaN, which
      // makes the comparator incoherent and the result order arbitrary.
      if (ta !== tb) return ta < tb ? -1 : 1;

      const ra = roleRank(a.p.role);
      const rb = roleRank(b.p.role);
      if (ra !== rb) return ra - rb;
      if (ra === ROLE_PRIORITY_OTHER) {
        const cmp = (a.p.role || "").localeCompare(b.p.role || "");
        if (cmp !== 0) return cmp;
      }
      return a.i - b.i; // stable within a time + rank
    })
    .map((x) => x.p);
}

// ── Who the talent actually is ───────────────────────────────────────────────
//
// The sheet's header calls out one person as the talent. It used to take the
// first row of the talent array, which is only right when that array holds
// nothing but talent — and in practice a whole unit often gets entered into one
// list, so the header named whoever happened to be typed first (a photographer,
// on the sheet that surfaced this).
//
// Match on the role instead, and prefer a bare "Talent" over "Talent Assist" or
// "Talent Manager", which also contain the word.
// Someone who is actually the subject of the shoot, as opposed to the people
// who come with them. Shared so the header, the call-times block and anything
// later can't drift on what counts as talent.
export function isPrincipalTalent(role: string | null | undefined): boolean {
  const r = (role || "").trim();
  if (!r) return false;
  return (
    /\b(talent|model|cast|actor|actress)\b/i.test(r) &&
    !/\b(assist(?:ant)?|manager|mgmt|management|agent|rep|handler|double|stand[- ]?in)\b/i.test(r)
  );
}

export function findTalent<T extends { role?: string; name?: string; callTime?: string }>(
  people: T[]
): T | undefined {
  const named = people.filter((p) => (p.name || "").trim() || p.callTime);
  const role = (p: T) => (p.role || "").trim();

  // "Talent", "Model", "Cast" — but not "Talent Assist" / "Talent Manager".
  const exact = named.find((p) => /^(talent|model|cast|artist)$/i.test(role(p)));
  if (exact) return exact;

  // A qualified principal — "Lead Talent", "Talent (Cover)" — still beats an
  // assistant or a manager, so those are excluded rather than merely ranked.
  const principal = named.find((p) => isPrincipalTalent(role(p)));
  if (principal) return principal;

  // Nothing is labelled talent. Returning the first row here is what caused the
  // original bug, so only fall back when no row carries a role at all — that is
  // the legacy shape where the talent list genuinely was just names.
  if (named.every((p) => !role(p))) return named[0];
  return undefined;
}

// ── Role priority ordering ───────────────────────────────────────────────────
// The unit list reads in production-hierarchy order — Producer at the top, down
// through the departments — rather than in the order people were added. Roles
// are free text, so we match on keywords. Patterns are tested in MATCH-specificity
// order (not rank order) so a broad keyword can't swallow a more specific role:
// e.g. "Art Director" and "Director of Photography" are recognised before a bare
// "Director". The first pattern that hits decides the rank; anything unrecognised
// sinks to the bottom and sorts alphabetically among its peers.
export const ROLE_PRIORITY_OTHER = 100;

const ROLE_PRIORITY_MATCHERS: { rank: number; re: RegExp }[] = [
  // Assistant variants are matched BEFORE the role they assist, so "Photo
  // Assist" doesn't rank as the photographer.
  { rank: 13, re: /\b(photo(?:graphy)?|camera)\s*(assist(?:ant)?|intern)\b/i },
  { rank: 1, re: /\b(exec(?:utive)?\s+producer|producer|ep)\b/i }, // Producer / Exec Producer
  { rank: 1, re: /\b(eic|editor[- ]?in[- ]?chief|editorial director)\b/i }, // EIC — runs the shoot editorially
  // On a stills shoot the photographer is the lead creative, the equivalent of
  // the director on a film unit. Without this they fell to the unranked bucket
  // and sorted alphabetically halfway down the sheet.
  { rank: 2, re: /\bphotograph(?:er|y)\b/i },
  { rank: 3, re: /\b(director of photography|d\.?o\.?p\.?|dop|cinematographer)\b/i }, // DOP — before "Director"
  // A lighting director is a head of department, not a director. It only ranked
  // near the top before because it contains the word "Director" — same place,
  // but by intent rather than by accident.
  { rank: 3, re: /\blighting director\b/i }, // before the generic "Director"
  { rank: 4, re: /(\b\d+(?:st|nd|rd|th)?\s*ad\b|first ad|assistant director)/i }, // 1st AD — before "Director"
  // "Art Direction" as well as "Art Director" — the noun form is what gets
  // typed in practice and it missed the old pattern entirely.
  { rank: 6, re: /\b(art director|art direction|production design(?:er)?)\b/i }, // before "Director"
  { rank: 7, re: /\bfashion director\b/i }, // Fashion Director — before "Director"
  { rank: 2, re: /\bdirector\b/i }, // Director
  { rank: 5, re: /\b(production manager|pm)\b/i }, // Production Manager
  { rank: 7, re: /\b(stylist|styling|wardrobe)\b/i }, // Stylist / wardrobe
  // `make[- ]?up` — the hyphenated spelling is the common one and the old
  // `make ?up` didn't match it, so every "Make-Up Artist" went unranked.
  { rank: 8, re: /\b(hair|make[- ]?up|h&?mu|hmu|mua|grooming|glam|mu)\b/i }, // Hair & Make Up
  { rank: 9, re: /\bset design(?:er)?\b/i }, // Set Designer
  { rank: 10, re: /\b(gaffer|lighting|electric(?:ian)?|spark|best boy)\b/i }, // Gaffer / Lighting
  { rank: 11, re: /\b(sound|audio|boom|recordist)\b/i }, // Sound
  { rank: 12, re: /\b(digi ?tech|digi ?op|dit|data)\b/i }, // Digi Tech / DIT
  { rank: 13, re: /(\b\d*(?:st|nd)?\s*a\.?c\.?\b|assistant camera|camera assistant|focus puller)/i }, // Camera Assist
  { rank: 14, re: /\b(bts|behind[- ]the[- ]scenes|videographer|content)\b/i }, // BTS / content capture
  { rank: 14, re: /\bgrip\b/i }, // Grip
  { rank: 15, re: /\b(runner|production assistant|prod\.? assist(?:ant)?|pa)\b/i }, // Runner / PA
  { rank: 16, re: /\b(talent|model|cast|actor|actress)\b/i }, // Talent / Model / Cast
];

// Rank of a free-text role in the production hierarchy (lower = higher up). An
// unrecognised role gets ROLE_PRIORITY_OTHER and is later ordered alphabetically.
export function roleRank(role: string | null | undefined): number {
  const r = (role || "").trim();
  if (!r) return ROLE_PRIORITY_OTHER;
  for (const m of ROLE_PRIORITY_MATCHERS) {
    if (m.re.test(r)) return m.rank;
  }
  return ROLE_PRIORITY_OTHER;
}

// Order people by production-hierarchy role priority. Same-rank rows keep their
// existing order (stable), except the unrecognised "other" bucket, which sorts
// alphabetically by role so the tail of the list is predictable.
export function sortByRolePriority<T extends { role?: string }>(people: T[]): T[] {
  return people
    .map((p, i) => ({ p, i }))
    .sort((a, b) => {
      const ra = roleRank(a.p.role);
      const rb = roleRank(b.p.role);
      if (ra !== rb) return ra - rb;
      if (ra === ROLE_PRIORITY_OTHER) {
        const cmp = (a.p.role || "").localeCompare(b.p.role || "");
        if (cmp !== 0) return cmp;
      }
      return a.i - b.i; // stable within a rank
    })
    .map((x) => x.p);
}

export interface LocationData {
  address: string;
  parkingNotes: string;
  nearestHospital: string;
  whatThreeWords: string;
  nearestStation?: string;
  transportNotes?: string;
  safetyNotes?: string;
}

// A single shoot location in the multi-location call sheet. The array order is
// the movement sequence for the shoot day (stop 1, stop 2, …).
export interface CallSheetLocation {
  name: string;
  address: string;
  postcode: string;
  nearestAE: string;
  parkingNotes: string;
  contactPerson: string;
  whatThreeWords: string;
  mapLink: string;
  lat: number | null;
  lng: number | null;
  // Cached drive estimate to the *next* stop in the movement order. Computed
  // from coordinates (Haversine + London-average speed) and persisted so the
  // shared/printed document doesn't have to recompute. Optional/back-compat.
  distanceToNextKm?: number | null;
  driveMinsToNext?: number | null;
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
  // Additional standard departments (Phase 4E). Optional for back-compat.
  soundSupplier?: string;
  soundContact?: string;
  soundEmail?: string;
  gripSupplier?: string;
  gripContact?: string;
  gripEmail?: string;
  dataSupplier?: string;
  dataContact?: string;
  dataEmail?: string;
  // One-click kit-list items from a template (Phase 4E).
  kitList?: string[];
  otherNotes: string;
}

// Standard equipment departments (Phase 4E).
export const EQUIPMENT_CATEGORIES: { key: "camera" | "lighting" | "sound" | "grip" | "data"; label: string }[] = [
  { key: "camera", label: "Camera" },
  { key: "lighting", label: "Lighting" },
  { key: "sound", label: "Sound" },
  { key: "grip", label: "Grip" },
  { key: "data", label: "Data" },
];

// One-click kit-list templates (Phase 4E).
export const KIT_TEMPLATES: { name: string; items: string[] }[] = [
  {
    name: "Standard interview setup",
    items: [
      "2× camera bodies",
      "Interview lens kit",
      "3-point LED lighting",
      "Lav + boom mic",
      "Reflector",
      "C-stands",
    ],
  },
  {
    name: "Studio shoot",
    items: [
      "Camera + prime set",
      "Studio strobe kit",
      "Softboxes + modifiers",
      "Backdrop + support",
      "Tethering station",
      "Colour meter",
    ],
  },
  {
    name: "Location run-and-gun",
    items: [
      "Mirrorless body + gimbal",
      "Zoom lens",
      "On-camera LED",
      "Wireless lav kit",
      "ND filters",
      "V-mount batteries",
    ],
  },
];

export type ShotStatus = "planned" | "in_progress" | "completed";

export interface Shot {
  description: string;
  setup: string;
  talent: string;
  equipment: string;
  duration: string;
  status: ShotStatus;
  // ── Structured fields (from the shot-list parser; all optional/back-compat) ──
  shotNumber?: string; // e.g. "1", "2a"
  locationRef?: string; // name of a CallSheetLocation this shot is at
  scene?: string; // scene description
  video?: string; // camera direction / framing / movement
  dialogue?: string; // dialogue / interview prompts
  stills?: string; // stills the photographer should capture
  tone?: string; // per-shot tone / style notes
  referenceImageUrl?: string; // visual reference image (URL) for this shot
}

// Overall creative approach shown at the top of the shot list.
export interface ShotStyle {
  tone: string;
  visualDevice: string;
  notes: string;
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

export interface SunInfo {
  sunrise: string | null;
  sunset: string | null;
  goldenHourAM: string | null;
  goldenHourPM: string | null;
  uvIndex: number;
}

export interface WeatherWarning {
  kind: "rain" | "wind" | "cold" | "heat";
  label: string;
}

export interface WeatherData {
  forecast: DailyForecast[];
  hourly?: HourlyForecast[];
  hourlyDate?: string;
  sun?: SunInfo | null;
  warnings?: WeatherWarning[];
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
  unitCallTime: string;
  wrapTime: string | null;
  location: LocationData;
  locationLat: number | null;
  locationLng: number | null;
  schedule: ScheduleItem[];
  shotlist: Shot[];
  locations: CallSheetLocation[];
  shotStyle: ShotStyle;
  crew: CrewMember[];
  talent: TalentMember[];
  // Roster arranged by hand — see sortRosterByCallThenRole. When set, the
  // stored array order is authoritative and nothing re-sorts it.
  crewManualOrder: boolean;
  talentManualOrder: boolean;
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
    clientName: string | null;
    figmaUrl: string | null;
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
    soundSupplier: "",
    soundContact: "",
    soundEmail: "",
    gripSupplier: "",
    gripContact: "",
    gripEmail: "",
    dataSupplier: "",
    dataContact: "",
    dataEmail: "",
    kitList: [],
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
  | "deliverables"
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
  { key: "deliverables", label: "Deliverables" },
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

export function emptyCallSheetLocation(): CallSheetLocation {
  return {
    name: "",
    address: "",
    postcode: "",
    nearestAE: "",
    parkingNotes: "",
    contactPerson: "",
    whatThreeWords: "",
    mapLink: "",
    lat: null,
    lng: null,
  };
}

export function emptyShotStyle(): ShotStyle {
  return { tone: "", visualDevice: "", notes: "" };
}

// Build the multi-location array for a call sheet, migrating older single-
// location sheets. If `locations` already has entries they win; otherwise a
// single stop is synthesised from the legacy `location` + lat/lng so existing
// call sheets keep their location after the upgrade.
export function deriveLocations(
  locations: unknown,
  legacy: LocationData | null | undefined,
  lat: number | null,
  lng: number | null
): CallSheetLocation[] {
  if (Array.isArray(locations) && locations.length > 0) {
    return locations.map((l) => ({ ...emptyCallSheetLocation(), ...(l as object) }));
  }
  const base = legacy ?? emptyLocation();
  const hasAny = !!(
    base.address ||
    base.parkingNotes ||
    base.nearestHospital ||
    base.whatThreeWords
  );
  if (!hasAny && lat == null) return [];
  return [
    {
      ...emptyCallSheetLocation(),
      name: "Location 1",
      address: base.address || "",
      parkingNotes: base.parkingNotes || "",
      nearestAE: base.nearestHospital || "",
      whatThreeWords: base.whatThreeWords || "",
      lat,
      lng,
    },
  ];
}

// Parse a raw pasted shot list into structured Shot cards. Shots are delimited
// by "Shot N" or a leading number ("1.", "2)"). Within each shot, recognised
// headers — Scene / Video / Dialogue / Stills / Location / Tone — capture the
// text that follows (across multiple lines) until the next header or shot.
export function parseShotList(raw: string): Shot[] {
  const text = (raw || "").replace(/\r\n/g, "\n");
  if (!text.trim()) return [];

  const isShotStart = (l: string) =>
    /^\s*shot\s*#?\s*\d+[a-z]?/i.test(l) || /^\s*\d+[a-z]?[.)]\s+\S/.test(l);
  const shotNumOf = (l: string): string => {
    const m = l.match(/^\s*shot\s*#?\s*(\d+[a-z]?)/i) || l.match(/^\s*(\d+[a-z]?)[.)]\s+/);
    return m ? m[1] : "";
  };

  const headers: { re: RegExp; field: keyof Shot }[] = [
    { re: /^\s*scene\s*:?\s*(.*)$/i, field: "scene" },
    { re: /^\s*video(?:\s*notes)?\s*:?\s*(.*)$/i, field: "video" },
    { re: /^\s*(?:dialogue|interview|vo)(?:\s*prompts?)?\s*:?\s*(.*)$/i, field: "dialogue" },
    { re: /^\s*stills(?:\s*list)?\s*:?\s*(.*)$/i, field: "stills" },
    { re: /^\s*(?:location|loc)\s*:?\s*(.*)$/i, field: "locationRef" },
    { re: /^\s*(?:tone|style)\s*:?\s*(.*)$/i, field: "tone" },
  ];

  const shots: Shot[] = [];
  let cur: Shot | null = null;
  let field: keyof Shot | null = null;

  const append = (val: string) => {
    if (!cur || !field) return;
    const existing = ((cur[field] as string | undefined) || "").trim();
    (cur as Record<string, unknown>)[field] = existing ? `${existing}\n${val.trim()}` : val.trim();
  };

  for (const line of text.split("\n")) {
    if (isShotStart(line)) {
      if (cur) shots.push(cur);
      const num = shotNumOf(line);
      const after = line
        .replace(/^\s*shot\s*#?\s*\d+[a-z]?\s*[:.\-–)]*\s*/i, "")
        .replace(/^\s*\d+[a-z]?[.)]\s+/, "")
        .trim();
      cur = { ...emptyShot(), shotNumber: num, description: after };
      field = "description";
      continue;
    }
    if (!cur) continue; // preamble before the first shot
    let matched = false;
    for (const h of headers) {
      const m = line.match(h.re);
      if (m) {
        field = h.field;
        const rest = (m[1] || "").trim();
        (cur as Record<string, unknown>)[h.field] = "";
        if (rest) append(rest);
        matched = true;
        break;
      }
    }
    if (matched) continue;
    if (line.trim()) append(line);
  }
  if (cur) shots.push(cur);

  for (const s of shots) {
    if (!s.description && s.scene) s.description = s.scene.split("\n")[0];
  }
  return shots;
}

// ── Merged schedule + call-time input ──
// A single pasted "full schedule" is split into call-time rows and run-of-day
// schedule blocks. A line is treated as a CALL TIME when its label matches one
// of these keywords; everything else becomes a schedule block. Output stays
// split (CALL TIMES vs RUN OF THE DAY) even though the input is merged.
const CALL_TIME_KEYWORDS = [
  "crew call",
  "talent call",
  "cast call",
  "unit call",
  "main unit call",
  "client call",
  "hmu call",
  "wrap",
];

export function isCallTimeLabel(label: string): boolean {
  const t = (label || "").toLowerCase();
  if (CALL_TIME_KEYWORDS.some((k) => t.includes(k))) return true;
  // Generic "<department> call" (e.g. "Styling call", "Runners call").
  return /\bcall\b/.test(t);
}

// Pull a leading time token from a line: "08:00", "8.30", "8am", "08:00am".
// Returns { time, rest } with a normalised HH:MM time, or null if none found.
function extractLeadingTime(line: string): { time: string; rest: string } | null {
  const m = line.match(
    /^\s*(?:[-*•]\s*)?(\d{1,2})[:.](\d{2})\s*(am|pm)?\b[\s.\-–—:)]*|^\s*(?:[-*•]\s*)?(\d{1,2})\s*(am|pm)\b[\s.\-–—:)]*/i
  );
  if (!m) return null;
  let hour: number;
  let minute: number;
  let ampm: string | undefined;
  if (m[1] !== undefined) {
    hour = parseInt(m[1], 10);
    minute = parseInt(m[2], 10);
    ampm = m[3];
  } else {
    hour = parseInt(m[4], 10);
    minute = 0;
    ampm = m[5];
  }
  if (ampm) {
    const lower = ampm.toLowerCase();
    if (lower === "pm" && hour < 12) hour += 12;
    if (lower === "am" && hour === 12) hour = 0;
  }
  if (hour > 23 || minute > 59) return null;
  const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  const rest = line.slice(m[0].length).trim();
  return { time, rest };
}

export interface ParsedSchedule {
  callTimes: CallTimeRow[];
  schedule: ScheduleItem[];
}

// Parse a pasted "full schedule" (one entry per line) into split call-time rows
// and run-of-day schedule blocks. Lines whose label reads as a call time are
// routed to callTimes; the rest become schedule blocks. Lines without a
// recognisable time are still kept (as schedule blocks) so nothing is dropped.
export function parseSchedule(raw: string): ParsedSchedule {
  const text = (raw || "").replace(/\r\n/g, "\n");
  const callTimes: CallTimeRow[] = [];
  const schedule: ScheduleItem[] = [];
  if (!text.trim()) return { callTimes, schedule };

  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const parsed = extractLeadingTime(line);
    const time = parsed?.time ?? "";
    // Label = the text after the time; if there was no time, use the whole line.
    let label = (parsed ? parsed.rest : line).trim();
    label = label.replace(/^[-*•]\s*/, "").trim();
    if (!label && !time) continue;
    if (isCallTimeLabel(label)) {
      callTimes.push({ time, department: label });
    } else {
      schedule.push({ time, description: label, notes: "" });
    }
  }
  return { callTimes, schedule };
}

// A deliverable parsed from a pasted brief.
export interface ParsedDeliverable {
  type: string; // photo | video | reel | bts | other
  title: string;
  notes: string;
}

// Parse a raw pasted deliverables brief into structured items. Each item starts
// with a quantity ("8x …" / "8 x …"); bullet lines beneath become spec notes.
export function parseDeliverables(raw: string): ParsedDeliverable[] {
  const text = (raw || "").replace(/\r\n/g, "\n");
  if (!text.trim()) return [];
  const isItem = (l: string) => /^\s*(?:[-*•]\s*)?\d+\s*x\b/i.test(l);
  const inferType = (s: string): string => {
    const t = s.toLowerCase();
    if (/reel/.test(t)) return "reel";
    if (/video|edit|film|motion/.test(t)) return "video";
    if (/bts|behind the scenes/.test(t)) return "bts";
    if (/image|still|photo|hero|shot/.test(t)) return "photo";
    return "other";
  };
  const items: ParsedDeliverable[] = [];
  let cur: ParsedDeliverable | null = null;
  for (const line of text.split("\n")) {
    if (isItem(line)) {
      if (cur) items.push(cur);
      const title = line.replace(/^\s*[-*•]\s*/, "").trim();
      cur = { type: inferType(title), title, notes: "" };
    } else if (cur && line.trim()) {
      const spec = line.replace(/^\s*[-*•]\s*/, "").trim();
      cur.notes = cur.notes ? `${cur.notes}\n${spec}` : spec;
    }
  }
  if (cur) items.push(cur);
  return items;
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
