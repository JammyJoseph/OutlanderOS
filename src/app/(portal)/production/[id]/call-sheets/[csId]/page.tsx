"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Save, Send, Loader2, Check, Link2,
} from "lucide-react";
import type {
  AgencyTeamMember, Attachment, CallSheet, CallSheetHeader, CallSheetLocation,
  CallSheetStatus, CallTimeRow, CateringDetails, ClientTeamMember, CrewMember,
  DistributionEntry, EquipmentInfo, LocationData, MovementOrder,
  ProductionCompanyInfo, ProductionMobile, ScheduleItem, Shot, ShotStyle,
  TalentMember, WeatherData,
} from "./types";
import {
  deriveLocations, emptyCatering, emptyEquipment, emptyHeader, emptyLocation,
  emptyMovementOrder, emptyProductionCompany, emptyShotStyle, migrateCatering,
} from "./types";
import { CallSheetEditor } from "./CallSheetEditor";
import type { CallSheetViewData } from "./CallSheetDocument";
import { FinalView } from "./FinalView";
import { ExportPanel } from "./ExportPanel";

const STATUS_BADGES: Record<CallSheetStatus, { cls: string; label: string }> = {
  DRAFT: { cls: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400", label: "Draft" },
  SAVED: { cls: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300", label: "Saved" },
  PUBLISHED: { cls: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300", label: "Published" },
};

export default function CallSheetPage() {
  const { id, csId } = useParams<{ id: string; csId: string }>();

  const [sheet, setSheet] = useState<CallSheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [autoSavedAt, setAutoSavedAt] = useState<string | null>(null);
  // Two modes only: the editor, and the distribution portal reached via
  // Save & Export.
  const [mode, setMode] = useState<"editor" | "export">("editor");
  const [copied, setCopied] = useState(false);
  // Snapshot of the production deliverables so they render on the preview /
  // printed / PDF call sheet (the editor keeps the live, editable copy). The
  // public share views fetch these server-side; the in-app views need them here.
  const [deliverables, setDeliverables] = useState<
    { type: string; title: string; notes: string | null }[]
  >([]);

  const [shootTitle, setShootTitle] = useState("");
  const [shootDate, setShootDate] = useState("");
  const [callTime, setCallTime] = useState("08:00");
  const [wrapTime, setWrapTime] = useState("");
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [location, setLocation] = useState<LocationData>(emptyLocation());
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [shotlist, setShotlist] = useState<Shot[]>([]);
  const [locations, setLocations] = useState<CallSheetLocation[]>([]);
  const [shotStyle, setShotStyle] = useState<ShotStyle>(emptyShotStyle());
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [talent, setTalent] = useState<TalentMember[]>([]);
  const [catering, setCatering] = useState<CateringDetails>(emptyCatering());
  const [documents, setDocuments] = useState<Attachment[]>([]);
  const [notesGeneral, setNotesGeneral] = useState("");
  const [notesSafety, setNotesSafety] = useState("");
  const [notesParking, setNotesParking] = useState("");
  const [header, setHeader] = useState<CallSheetHeader>(emptyHeader());
  const [clientTeam, setClientTeam] = useState<ClientTeamMember[]>([]);
  const [agencyTeam, setAgencyTeam] = useState<AgencyTeamMember[]>([]);
  const [productionCompany, setProductionCompany] = useState<ProductionCompanyInfo>(
    emptyProductionCompany()
  );
  const [callTimes, setCallTimes] = useState<CallTimeRow[]>([]);
  const [productionMobiles, setProductionMobiles] = useState<ProductionMobile[]>([]);
  const [movementOrder, setMovementOrder] = useState<MovementOrder>(emptyMovementOrder());
  const [equipment, setEquipment] = useState<EquipmentInfo>(emptyEquipment());

  // Snapshot of the last persisted payload — auto-save only fires on diff.
  const lastSavedRef = useRef<string>("");
  const stateRef = useRef<Record<string, unknown>>({});

  function buildPayload(s: typeof stateRef.current) {
    const locs = (s.locations as CallSheetLocation[]) ?? [];
    const first = locs[0];
    // Mirror the first stop into the legacy single-location columns so older
    // readers (e.g. the call-sheet list) still show a location.
    const legacyLocation = first
      ? {
          ...emptyLocation(),
          address: first.address,
          parkingNotes: first.parkingNotes,
          nearestHospital: first.nearestAE,
          whatThreeWords: first.whatThreeWords,
        }
      : (s.location as LocationData);
    return {
      shootTitle: s.shootTitle,
      shootDate: new Date(s.shootDate as string).toISOString(),
      callTime: s.callTime,
      wrapTime: s.wrapTime,
      location: legacyLocation,
      locationLat: first ? first.lat : s.locationLat,
      locationLng: first ? first.lng : s.locationLng,
      locations: s.locations,
      shotStyle: s.shotStyle,
      schedule: s.schedule,
      shotlist: s.shotlist,
      crew: s.crew,
      talent: s.talent,
      cateringDetails: s.catering,
      documents: s.documents,
      weatherData: s.weatherData,
      productionNotes: s.notesGeneral,
      safetyNotes: s.notesSafety,
      parkingNotes: s.notesParking,
      header: s.header,
      clientTeam: s.clientTeam,
      agencyTeam: s.agencyTeam,
      productionCompany: s.productionCompany,
      callTimes: s.callTimes,
      productionMobiles: s.productionMobiles,
      movementOrder: s.movementOrder,
      equipment: s.equipment,
    };
  }

  stateRef.current = {
    shootTitle, shootDate, callTime, wrapTime, schedule, location, locationLat,
    locationLng, locations, shotStyle, weatherData, shotlist, crew, talent,
    catering, documents, notesGeneral, notesSafety, notesParking, header,
    clientTeam, agencyTeam, productionCompany, callTimes, productionMobiles,
    movementOrder, equipment,
  };

  const loadSheet = useCallback(() => {
    fetch(`/api/call-sheets/${csId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.sheet) return;
        const s: CallSheet = d.sheet;
        setSheet(s);
        setShootTitle(s.shootTitle || s.production.title);
        setShootDate(s.shootDate.split("T")[0]);
        setCallTime(s.callTime || "08:00");
        setWrapTime(s.wrapTime || "");
        setSchedule(Array.isArray(s.schedule) ? s.schedule : []);
        setLocation(
          s.location && typeof s.location === "object" && !Array.isArray(s.location)
            ? { ...emptyLocation(), ...s.location }
            : emptyLocation()
        );
        setLocationLat(s.locationLat ?? null);
        setLocationLng(s.locationLng ?? null);
        setLocations(
          deriveLocations(s.locations, s.location, s.locationLat ?? null, s.locationLng ?? null)
        );
        setShotStyle(
          s.shotStyle && typeof s.shotStyle === "object" && !Array.isArray(s.shotStyle)
            ? { ...emptyShotStyle(), ...s.shotStyle }
            : emptyShotStyle()
        );
        setWeatherData(s.weatherData ?? null);
        setShotlist(Array.isArray(s.shotlist) ? s.shotlist : []);
        setCrew(Array.isArray(s.crew) ? s.crew : []);
        setTalent(Array.isArray(s.talent) ? s.talent : []);
        setDocuments(Array.isArray(s.documents) ? s.documents : []);
        setCatering(migrateCatering(s.cateringDetails, s.notes));
        setNotesGeneral(s.productionNotes || "");
        setNotesSafety(s.safetyNotes || "");
        setNotesParking(s.parkingNotes || "");
        const isObj = (v: unknown) => v && typeof v === "object" && !Array.isArray(v);
        setHeader(isObj(s.header) ? { ...emptyHeader(), ...s.header } : emptyHeader());
        setClientTeam(Array.isArray(s.clientTeam) ? s.clientTeam : []);
        setAgencyTeam(Array.isArray(s.agencyTeam) ? s.agencyTeam : []);
        setProductionCompany(
          isObj(s.productionCompany)
            ? { ...emptyProductionCompany(), ...s.productionCompany }
            : emptyProductionCompany()
        );
        setCallTimes(Array.isArray(s.callTimes) ? s.callTimes : []);
        setProductionMobiles(Array.isArray(s.productionMobiles) ? s.productionMobiles : []);
        setMovementOrder(
          isObj(s.movementOrder)
            ? { ...emptyMovementOrder(), ...s.movementOrder }
            : emptyMovementOrder()
        );
        setEquipment(isObj(s.equipment) ? { ...emptyEquipment(), ...s.equipment } : emptyEquipment());
      })
      .finally(() => setLoading(false));
  }, [csId]);

  useEffect(() => {
    loadSheet();
  }, [loadSheet]);

  // Pull the production deliverables for the read-only document views. Kept in
  // its own fetch (not part of the call sheet row) so it always reflects the
  // latest edits from either the Deliverables tab or the call sheet editor.
  useEffect(() => {
    fetch(`/api/productions/${id}/deliverables`)
      .then((r) => r.json())
      .then((d) =>
        setDeliverables(
          Array.isArray(d.deliverables)
            ? d.deliverables.map((x: { type: string; title: string; notes: string | null }) => ({
                type: x.type,
                title: x.title,
                notes: x.notes,
              }))
            : []
        )
      )
      .catch(() => {});
  }, [id, mode]);

  // Capture the loaded state as the saved baseline once everything settles.
  useEffect(() => {
    if (sheet && !lastSavedRef.current && shootDate) {
      lastSavedRef.current = JSON.stringify(buildPayload(stateRef.current));
    }
  }, [sheet, shootDate]);

  function setCoords(lat: number | null, lng: number | null) {
    setLocationLat(lat);
    setLocationLng(lng);
  }

  const saveSheet = useCallback(
    async (newStatus?: CallSheetStatus, opts?: { auto?: boolean }) => {
      const current = stateRef.current;
      if (!current.shootDate) return;
      setSaving(true);
      const payload = buildPayload(current);
      try {
        const res = await fetch(`/api/call-sheets/${csId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            // Auto-save keeps the current lifecycle stage; manual save promotes
            // a fresh draft to SAVED.
            ...(newStatus
              ? { status: newStatus }
              : opts?.auto
              ? {}
              : { status: undefined }),
          }),
        });
        const data = await res.json();
        if (data.sheet) {
          setSheet((prev) => (prev ? { ...prev, ...data.sheet } : data.sheet));
          lastSavedRef.current = JSON.stringify(payload);
          if (opts?.auto) {
            setAutoSavedAt(
              new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
            );
          } else {
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
          }
          return data.sheet as CallSheet;
        }
      } finally {
        setSaving(false);
      }
      return null;
    },
    [csId]
  );

  async function manualSave() {
    const next = sheet?.status === "DRAFT" ? "SAVED" : sheet?.status;
    await saveSheet(next as CallSheetStatus | undefined);
  }

  // Step 3 of the flow. Persist the sheet and publish it so the public share
  // links resolve (publishing mints the crew + client tokens if missing), then
  // drop into the export panel.
  async function saveAndExport() {
    const updated = await saveSheet("PUBLISHED");
    if (updated) setMode("export");
  }

  // Auto-save: every 30s, persist quietly if the payload changed.
  useEffect(() => {
    const interval = setInterval(() => {
      if (!sheet || sheet.status === "PUBLISHED" || saving) return;
      const currentPayload = JSON.stringify(buildPayload(stateRef.current));
      if (lastSavedRef.current && currentPayload !== lastSavedRef.current) {
        saveSheet(undefined, { auto: true });
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [sheet, saving, saveSheet]);

  // On entering the export panel, make sure both share tokens exist. Save &
  // Export mints them via publish, but a sheet published before the client
  // token existed can arrive here missing one — top it up on demand.
  useEffect(() => {
    if (mode !== "export" || !sheet) return;
    if (sheet.shareToken && sheet.clientShareToken) return;
    fetch(`/api/call-sheets/${csId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mintTokens: true }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.sheet)
          setSheet((prev) =>
            prev
              ? { ...prev, shareToken: d.sheet.shareToken, clientShareToken: d.sheet.clientShareToken }
              : prev
          );
      })
      .catch(() => {});
  }, [mode, sheet, csId]);

  async function revertToEditor() {
    if (!sheet) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/call-sheets/${csId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "SAVED" }),
      });
      const data = await res.json();
      if (data.sheet) {
        setSheet((prev) => (prev ? { ...prev, status: "SAVED" } : prev));
        setMode("editor");
      }
    } finally {
      setSaving(false);
    }
  }

  // Persist crew into the Directory with this production tagged as a credit.
  async function syncDirectory() {
    await fetch(`/api/call-sheets/${csId}/sync-directory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ crew: stateRef.current.crew }),
    });
  }

  async function saveDistributions(distributions: DistributionEntry[]) {
    const res = await fetch(`/api/call-sheets/${csId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ distributions }),
    });
    const data = await res.json();
    if (data.sheet) {
      setSheet((prev) => (prev ? { ...prev, distributions: data.sheet.distributions } : prev));
    }
  }

  function shareUrl(): string | null {
    if (!sheet?.shareToken) return null;
    return `${window.location.origin}/call-sheet/${sheet.shareToken}`;
  }

  function copyShareLink() {
    const url = shareUrl();
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const viewData: CallSheetViewData = {
    shootTitle, shootDate, callTime, wrapTime, location, locationLat, locationLng,
    locations, shotStyle, deliverables, weatherData, schedule, shotlist, crew, talent, catering, documents,
    notesGeneral, notesSafety, notesParking,
    header, clientTeam, agencyTeam, productionCompany, callTimes, productionMobiles,
    movementOrder, equipment,
    clientName: sheet?.production.campaign?.client?.name || sheet?.production.clientName || "",
    productionTitle: sheet?.production.title || "",
    productionId: sheet?.production.id || "",
    figmaUrl: sheet?.production.figmaUrl || null,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-card flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-gray-400 dark:text-gray-500" />
      </div>
    );
  }

  if (!sheet) {
    return (
      <div className="min-h-screen bg-card flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">Call sheet not found.</p>
          <Link
            href={`/production/${id}`}
            className="text-[#A93B2E] text-sm font-medium hover:underline"
          >
            Back to Project
          </Link>
        </div>
      </div>
    );
  }

  // A published sheet lands on the FinalView home (distribution tracking, share
  // modal, PDF). Stepping into the export panel or re-previewing keeps us in the
  // mode-driven flow below.
  if (sheet.status === "PUBLISHED" && mode === "editor") {
    return (
      <FinalView
        productionTitle={sheet.production.title}
        productionId={id}
        sheet={sheet}
        viewData={viewData}
        onRevert={revertToEditor}
        onExport={() => setMode("export")}
        saving={saving}
        onSaveDistributions={saveDistributions}
      />
    );
  }

  const badge = STATUS_BADGES[sheet.status];

  return (
    <div className="min-h-screen bg-card" data-callsheet-print>
      <div className="max-w-4xl mx-auto px-6 py-10 print:px-0 print:py-0 print:max-w-none">
        {/* Top bar — actions vary by step in the flow */}
        <div className="flex items-center justify-between mb-6 print:hidden">
          <Link
            href={`/production/${id}`}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            <ArrowLeft size={15} />
            {sheet.production.title}
          </Link>
          <div className="flex items-center gap-2">
            {mode === "editor" && (
              <>
                {saved && (
                  <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    <Check size={13} /> Saved
                  </span>
                )}
                {!saved && autoSavedAt && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">Auto-saved {autoSavedAt}</span>
                )}
                {sheet.shareToken && (
                  <button
                    onClick={copyShareLink}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    {copied ? <Check size={13} className="text-emerald-600 dark:text-emerald-400" /> : <Link2 size={13} />}
                    {copied ? "Copied!" : "Copy share link"}
                  </button>
                )}
                <button
                  onClick={manualSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-60"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Save
                </button>
                <button
                  onClick={saveAndExport}
                  disabled={saving}
                  className="flex items-center gap-1.5 bg-[#A93B2E] text-white px-5 py-2 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60 shadow-sm"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Save &amp; Export
                </button>
              </>
            )}
          </div>
        </div>

        {/* Title / status — editor only (the portal renders its own heading) */}
        {mode === "editor" && (
          <div className="mb-6 print:hidden">
            <input
              type="text"
              value={shootTitle}
              onChange={(e) => setShootTitle(e.target.value)}
              placeholder="Shoot Title"
              className="text-2xl font-semibold text-gray-900 dark:text-gray-100 bg-transparent border-none outline-none w-full placeholder-gray-300 dark:placeholder-gray-600 tracking-tight"
            />
            <div className="flex items-center gap-3 mt-1">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.cls}`}>
                {badge.label}
              </span>
              {sheet.production.campaign?.client?.name && (
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {sheet.production.campaign.client.name}
                </span>
              )}
            </div>
          </div>
        )}

        {mode === "editor" && (
          <div className="print:hidden">
            <CallSheetEditor
              shootDate={shootDate} setShootDate={setShootDate}
              callTime={callTime} setCallTime={setCallTime}
              wrapTime={wrapTime} setWrapTime={setWrapTime}
              schedule={schedule} setSchedule={setSchedule}
              locations={locations} setLocations={setLocations}
              locationLat={locationLat} locationLng={locationLng} setCoords={setCoords}
              weatherData={weatherData} setWeatherData={setWeatherData}
              shotlist={shotlist} setShotlist={setShotlist}
              shotStyle={shotStyle} setShotStyle={setShotStyle}
              crew={crew} setCrew={setCrew}
              talent={talent} setTalent={setTalent}
              catering={catering} setCatering={setCatering}
              documents={documents} setDocuments={setDocuments}
              notesGeneral={notesGeneral} setNotesGeneral={setNotesGeneral}
              notesSafety={notesSafety} setNotesSafety={setNotesSafety}
              notesParking={notesParking} setNotesParking={setNotesParking}
              header={header} setHeader={setHeader}
              clientTeam={clientTeam} setClientTeam={setClientTeam}
              agencyTeam={agencyTeam} setAgencyTeam={setAgencyTeam}
              productionCompany={productionCompany} setProductionCompany={setProductionCompany}
              callTimes={callTimes} setCallTimes={setCallTimes}
              productionMobiles={productionMobiles} setProductionMobiles={setProductionMobiles}
              movementOrder={movementOrder} setMovementOrder={setMovementOrder}
              equipment={equipment} setEquipment={setEquipment}
              production={sheet.production}
              onSyncDirectory={syncDirectory}
            />
          </div>
        )}

        {mode === "export" && (
          <ExportPanel
            data={viewData}
            shareToken={sheet.shareToken}
            clientShareToken={sheet.clientShareToken}
            onBackToEditor={() => setMode("editor")}
          />
        )}
      </div>
    </div>
  );
}
