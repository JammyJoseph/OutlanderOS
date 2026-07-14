"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AgencyTeamMember, Attachment, CallSheet, CallSheetHeader, CallSheetLocation,
  CallTimeRow, CateringDetails, ClientTeamMember, CrewMember, EquipmentInfo,
  LocationData, MovementOrder, ProductionCompanyInfo, ProductionMobile,
  ScheduleItem, Shot, ShotStyle, TalentMember, WeatherData,
} from "./types";
import {
  deriveLocations, emptyEquipment, emptyHeader, emptyLocation,
  emptyMovementOrder, emptyProductionCompany, emptyShotStyle, migrateCatering,
  resolveUnitCall, sortCallTimes, sortRoster, sortSchedule,
} from "./types";

// ── The collaborative editing model ──────────────────────────────────────────
//
// The editor's state is 27 top-level fields, several of which are whole JSON
// arrays (crew, schedule, locations). "Per-field" therefore means per top-level
// field, which is the granularity the DB stores anyway — one column each.
//
// Every field has a *canonical form*: the exact JSON that gets persisted for it.
// That's not always the raw state — `schedule` is sorted chronologically on the
// way out, `crew` is sorted against the unit call, `locations` also mirrors
// itself into the legacy location/lat/lng columns. Both auto-save and remote
// merge compare canonical forms, never raw state. If they compared raw state,
// a locally-unsorted schedule would look permanently different from the sorted
// copy the server sent back, so the field would re-save forever and never
// accept a remote change.
//
// From there the two loops are simple:
//   save  — a field is dirty when its canonical form ≠ the server's. Debounce
//           300ms, PATCH only the dirty fields. Untouched fields are never in
//           the body, so two people on different fields never collide, and two
//           people on the same field resolve last-write-wins.
//   merge — poll, canonicalise what came back, and for each field where the
//           server disagrees with the baseline we last saw, take theirs — unless
//           it's a field this user is currently editing.

export type SheetState = {
  shootTitle: string;
  shootDate: string;
  unitCallTime: string;
  wrapTime: string;
  schedule: ScheduleItem[];
  location: LocationData;
  locationLat: number | null;
  locationLng: number | null;
  locations: CallSheetLocation[];
  shotStyle: ShotStyle;
  weatherData: WeatherData | null;
  shotlist: Shot[];
  crew: CrewMember[];
  talent: TalentMember[];
  catering: CateringDetails;
  documents: Attachment[];
  notesGeneral: string;
  notesSafety: string;
  notesParking: string;
  header: CallSheetHeader;
  clientTeam: ClientTeamMember[];
  agencyTeam: AgencyTeamMember[];
  productionCompany: ProductionCompanyInfo;
  callTimes: CallTimeRow[];
  productionMobiles: ProductionMobile[];
  movementOrder: MovementOrder;
  equipment: EquipmentInfo;
};

export type FieldKey = keyof SheetState;

const isObj = (v: unknown) => !!v && typeof v === "object" && !Array.isArray(v);

// Normalise a sheet row from the API into editor state. Used for the initial
// load and for every poll, so local state and remote state are always compared
// after the same normalisation.
export function sheetToState(s: CallSheet): SheetState {
  const unitCall = resolveUnitCall(s.unitCallTime, s.callTime) || "08:00";
  return {
    shootTitle: s.shootTitle || s.production.title,
    shootDate: s.shootDate.split("T")[0],
    unitCallTime: unitCall,
    wrapTime: s.wrapTime || "",
    schedule: sortSchedule(Array.isArray(s.schedule) ? s.schedule : []),
    location: isObj(s.location) ? { ...emptyLocation(), ...s.location } : emptyLocation(),
    locationLat: s.locationLat ?? null,
    locationLng: s.locationLng ?? null,
    locations: deriveLocations(s.locations, s.location, s.locationLat ?? null, s.locationLng ?? null),
    shotStyle: isObj(s.shotStyle) ? { ...emptyShotStyle(), ...s.shotStyle } : emptyShotStyle(),
    weatherData: s.weatherData ?? null,
    shotlist: Array.isArray(s.shotlist) ? s.shotlist : [],
    crew: sortRoster(Array.isArray(s.crew) ? s.crew : [], unitCall),
    talent: sortRoster(Array.isArray(s.talent) ? s.talent : [], unitCall),
    catering: migrateCatering(s.cateringDetails, s.notes),
    documents: Array.isArray(s.documents) ? s.documents : [],
    notesGeneral: s.productionNotes || "",
    notesSafety: s.safetyNotes || "",
    notesParking: s.parkingNotes || "",
    header: isObj(s.header) ? { ...emptyHeader(), ...s.header } : emptyHeader(),
    clientTeam: Array.isArray(s.clientTeam) ? s.clientTeam : [],
    agencyTeam: Array.isArray(s.agencyTeam) ? s.agencyTeam : [],
    productionCompany: isObj(s.productionCompany)
      ? { ...emptyProductionCompany(), ...s.productionCompany }
      : emptyProductionCompany(),
    callTimes: sortCallTimes(Array.isArray(s.callTimes) ? s.callTimes : []),
    productionMobiles: Array.isArray(s.productionMobiles) ? s.productionMobiles : [],
    movementOrder: isObj(s.movementOrder)
      ? { ...emptyMovementOrder(), ...s.movementOrder }
      : emptyMovementOrder(),
    equipment: isObj(s.equipment) ? { ...emptyEquipment(), ...s.equipment } : emptyEquipment(),
  };
}

// The first stop mirrors into the legacy single-location columns so older
// readers (the call-sheet list, the confirmation page) still show a location.
// All four location fields share this fragment: the mirror depends on every one
// of them, so they save and merge as a unit.
function locationFragment(s: SheetState): Record<string, unknown> {
  const first = s.locations[0];
  return {
    locations: s.locations,
    location: first
      ? {
          ...emptyLocation(),
          address: first.address,
          parkingNotes: first.parkingNotes,
          nearestHospital: first.nearestAE,
          whatThreeWords: first.whatThreeWords,
        }
      : s.location,
    locationLat: first ? first.lat : s.locationLat,
    locationLng: first ? first.lng : s.locationLng,
  };
}

// Every field's canonical persisted form, keyed by state field. The union of the
// fragments for the dirty fields is exactly the PATCH body.
const FRAGMENT: Record<FieldKey, (s: SheetState) => Record<string, unknown>> = {
  shootTitle: (s) => ({ shootTitle: s.shootTitle }),
  shootDate: (s) => ({ shootDate: new Date(s.shootDate).toISOString() }),
  // The unit call is mirrored into the legacy `callTime` column on every write.
  unitCallTime: (s) => ({ callTime: s.unitCallTime, unitCallTime: s.unitCallTime }),
  wrapTime: (s) => ({ wrapTime: s.wrapTime }),
  schedule: (s) => ({ schedule: sortSchedule(s.schedule) }),
  location: locationFragment,
  locationLat: locationFragment,
  locationLng: locationFragment,
  locations: locationFragment,
  shotStyle: (s) => ({ shotStyle: s.shotStyle }),
  weatherData: (s) => ({ weatherData: s.weatherData }),
  shotlist: (s) => ({ shotlist: s.shotlist }),
  crew: (s) => ({ crew: sortRoster(s.crew, s.unitCallTime || "") }),
  talent: (s) => ({ talent: sortRoster(s.talent, s.unitCallTime || "") }),
  catering: (s) => ({ cateringDetails: s.catering }),
  documents: (s) => ({ documents: s.documents }),
  notesGeneral: (s) => ({ productionNotes: s.notesGeneral }),
  notesSafety: (s) => ({ safetyNotes: s.notesSafety }),
  notesParking: (s) => ({ parkingNotes: s.notesParking }),
  header: (s) => ({ header: s.header }),
  clientTeam: (s) => ({ clientTeam: s.clientTeam }),
  agencyTeam: (s) => ({ agencyTeam: s.agencyTeam }),
  productionCompany: (s) => ({ productionCompany: s.productionCompany }),
  callTimes: (s) => ({ callTimes: sortCallTimes(s.callTimes) }),
  productionMobiles: (s) => ({ productionMobiles: s.productionMobiles }),
  movementOrder: (s) => ({ movementOrder: s.movementOrder }),
  equipment: (s) => ({ equipment: s.equipment }),
};

export const FIELD_KEYS = Object.keys(FRAGMENT) as FieldKey[];

// Every field at once — what the wholesale PUT ("Finish", "Back to Editor")
// sends. Built from the same fragments as the per-field PATCH, so there's one
// definition of how a field is persisted, not two that can drift apart.
export function fullPayload(s: SheetState): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const k of FIELD_KEYS) Object.assign(body, FRAGMENT[k](s));
  return body;
}

// A field's canonical form as a comparable string. Returns null for a field that
// can't be persisted yet (an in-progress date), which parks it until it's valid.
function canon(key: FieldKey, s: SheetState): string | null {
  try {
    if (key === "shootDate" && (!s.shootDate || Number.isNaN(new Date(s.shootDate).getTime()))) {
      return null;
    }
    return JSON.stringify(FRAGMENT[key](s));
  } catch {
    return null;
  }
}

function canonAll(s: SheetState): Partial<Record<FieldKey, string>> {
  const out: Partial<Record<FieldKey, string>> = {};
  for (const k of FIELD_KEYS) {
    const c = canon(k, s);
    if (c !== null) out[k] = c;
  }
  return out;
}

export type PresenceUser = { userId: string; name: string; email: string; lastSeen: number };
export type SaveStatus = "idle" | "saving" | "saved" | "error";

const SAVE_DEBOUNCE_MS = 300;
const POLL_MS = 4_000;
const HEARTBEAT_MS = 30_000;
const PRESENCE_POLL_MS = 10_000;

export function useCollab(opts: {
  csId: string;
  // Auto-save and merging only run while the sheet is actually being edited —
  // a published sheet in preview is read-only, and "Finish" owns that write.
  enabled: boolean;
  // Live editor state. Read through a ref, so it's never stale in a timer.
  state: SheetState | null;
  // Push a single remote field into local state.
  applyRemote: (key: FieldKey, value: SheetState[FieldKey]) => void;
  // A fresh sheet row landed (status, share tokens, …).
  onSheet: (sheet: CallSheet) => void;
}) {
  const { csId, enabled, state, applyRemote, onSheet } = opts;

  const [status, setStatus] = useState<SaveStatus>("idle");
  const [active, setActive] = useState<PresenceUser[]>([]);
  const [selfId, setSelfId] = useState<string | null>(null);

  // What we believe the server holds, per field, in canonical form.
  const baseline = useRef<Partial<Record<FieldKey, string>>>({});
  const stateRef = useRef<SheetState | null>(state);
  stateRef.current = state;

  const applyRemoteRef = useRef(applyRemote);
  applyRemoteRef.current = applyRemote;
  const onSheetRef = useRef(onSheet);
  onSheetRef.current = onSheet;

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const savedFlash = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The field the user is actively editing — the one thing a remote change is
  // never allowed to yank out from under them. It's the last field they changed,
  // and only while focus is still inside an editor input. Once they tab away or
  // stop, the field is fair game again and last-write-wins applies as normal.
  const activeField = useRef<FieldKey | null>(null);
  const focused = useRef(false);

  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target as HTMLElement | null;
      focused.current = !!el?.matches?.("input, textarea, select, [contenteditable]");
      if (!focused.current) activeField.current = null;
    };
    const onFocusOut = () => {
      focused.current = false;
      activeField.current = null;
    };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  // Seed the baseline from the row as loaded — nothing is dirty at rest.
  const seed = useCallback((sheet: CallSheet) => {
    baseline.current = canonAll(sheetToState(sheet));
  }, []);

  const dirtyKeys = useCallback((): FieldKey[] => {
    const s = stateRef.current;
    if (!s) return [];
    const now = canonAll(s);
    return FIELD_KEYS.filter((k) => now[k] !== undefined && now[k] !== baseline.current[k]);
  }, []);

  // PATCH the dirty fields, and only the dirty fields.
  const flush = useCallback(async (keepalive = false) => {
    const s = stateRef.current;
    if (!s || !enabled || inFlight.current) return;
    const keys = dirtyKeys();
    if (keys.length === 0) return;

    // Fragments are merged, so the four location fields (which share one
    // fragment) collapse to a single copy rather than being sent four times.
    const body: Record<string, unknown> = {};
    for (const k of keys) Object.assign(body, FRAGMENT[k](s));

    // Snapshot what we're sending: the response is the authority on what the
    // server now holds, but if the user typed again mid-flight, those fields
    // must stay dirty and re-save on the next pass.
    inFlight.current = true;
    setStatus("saving");
    try {
      const res = await fetch(`/api/call-sheets/${csId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        keepalive,
      });
      const data = await res.json();
      if (!res.ok || !data.sheet) throw new Error("save failed");

      // Baseline the saved fields against what came back, so server-side
      // normalisation (sorting) reconciles instead of looking like a diff.
      const server = canonAll(sheetToState(data.sheet as CallSheet));
      for (const k of keys) baseline.current[k] = server[k];
      onSheetRef.current(data.sheet as CallSheet);

      setStatus("saved");
      if (savedFlash.current) clearTimeout(savedFlash.current);
      savedFlash.current = setTimeout(() => setStatus("idle"), 1_500);
    } catch {
      setStatus("error");
    } finally {
      inFlight.current = false;
    }
  }, [csId, enabled, dirtyKeys]);

  // Auto-save. Any state change restarts the 300ms debounce; the flush then
  // sends whichever fields are dirty at that moment.
  const signature = state ? JSON.stringify(canonAll(state)) : "";
  useEffect(() => {
    if (!enabled || !state) return;
    if (Object.keys(baseline.current).length === 0) return; // not seeded yet
    if (dirtyKeys().length === 0) return;

    // Remember which field is being typed into, so the merge loop leaves it be.
    if (focused.current) {
      const changed = dirtyKeys();
      if (changed.length > 0) activeField.current = changed[0];
    }

    if (saveTimer.current) clearTimeout(saveTimer.current);
    // Null the handle as it fires. The merge loop treats a non-null timer as
    // "a local write is queued, don't race a read against it" — leaving a spent
    // handle behind would wedge that guard on and suppress every future merge.
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      void flush();
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
    };
    // `signature` is the canonical form of every field — it changes exactly when
    // something worth saving changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, enabled, flush, dirtyKeys]);

  // Don't lose the last <300ms of typing when the tab goes away, or when the user
  // navigates off the editor (which tears the debounce timer down mid-flight).
  const flushRef = useRef(flush);
  flushRef.current = flush;

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void flushRef.current(true);
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
      void flushRef.current(true);
    };
  }, []);

  // Merge loop. Poll, and for every field where the server has moved away from
  // our baseline, take the server's value — unless the user is mid-edit on it.
  useEffect(() => {
    if (!enabled) return;
    const tick = async () => {
      // A save in flight (or queued) means our own write is the newer one; let
      // it land and re-baseline rather than racing a stale read against it.
      if (inFlight.current || saveTimer.current) return;
      if (Object.keys(baseline.current).length === 0) return;
      try {
        const res = await fetch(`/api/call-sheets/${csId}`);
        const data = await res.json();
        if (!data.sheet) return;
        const sheet = data.sheet as CallSheet;
        const remote = sheetToState(sheet);
        const remoteCanon = canonAll(remote);
        const locally = dirtyKeys();

        let merged = false;
        for (const k of FIELD_KEYS) {
          const rc = remoteCanon[k];
          if (rc === undefined || rc === baseline.current[k]) continue; // server hasn't moved
          if (k === activeField.current) continue; // don't touch what they're typing in
          if (locally.includes(k)) continue; // our unsaved edit wins until it saves
          applyRemoteRef.current(k, remote[k]);
          baseline.current[k] = rc;
          merged = true;
        }
        if (merged) onSheetRef.current(sheet);
      } catch {
        /* a dropped poll is not worth surfacing — the next one covers it */
      }
    };
    const iv = setInterval(tick, POLL_MS);
    return () => clearInterval(iv);
  }, [csId, enabled, dirtyKeys]);

  // Presence — heartbeat on mount then every 30s, and read the room every 10s.
  useEffect(() => {
    let alive = true;
    const beat = async () => {
      try {
        const res = await fetch(`/api/call-sheets/${csId}/presence`, { method: "POST" });
        const data = await res.json();
        if (!alive) return;
        // The heartbeat response tells us who we are (from the auth_token), which
        // is how the bar knows which pill to leave out.
        if (data.self) setSelfId(String(data.self));
        if (Array.isArray(data.active)) setActive(data.active);
      } catch {
        /* presence is decoration — never let it break the editor */
      }
    };
    const read = async () => {
      try {
        const res = await fetch(`/api/call-sheets/${csId}/presence`);
        const data = await res.json();
        if (alive && Array.isArray(data.active)) setActive(data.active);
      } catch {
        /* as above */
      }
    };
    void beat();
    const hb = setInterval(() => void beat(), HEARTBEAT_MS);
    const rd = setInterval(() => void read(), PRESENCE_POLL_MS);
    return () => {
      alive = false;
      clearInterval(hb);
      clearInterval(rd);
    };
  }, [csId]);

  // Everyone *else* in the room. Until the first heartbeat answers, selfId is
  // null and nobody is filtered — showing yourself for one beat would be worse
  // than showing nobody, so hold off entirely rather than guess.
  const others = selfId ? active.filter((u) => u.userId !== selfId) : [];

  return { status, others, seed, flush, baseline };
}
