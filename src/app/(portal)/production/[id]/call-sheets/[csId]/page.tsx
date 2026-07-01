"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Save, Eye, Send, Edit2, Loader2, Check, Link2, FileDown,
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
import { CallSheetDocument, type CallSheetViewData } from "./CallSheetDocument";
import { FinalView } from "./FinalView";
import { PdfExportModal } from "./PdfExportModal";
import type { SectionKey } from "./types";
import { allSectionsVisible } from "./types";

const STATUS_BADGES: Record<CallSheetStatus, { cls: string; label: string }> = {
  DRAFT: { cls: "bg-gray-100 text-gray-500", label: "Draft" },
  SAVED: { cls: "bg-blue-100 text-blue-700", label: "Saved" },
  PUBLISHED: { cls: "bg-emerald-100 text-emerald-700", label: "Published" },
};

export default function CallSheetPage() {
  const { id, csId } = useParams<{ id: string; csId: string }>();

  const [sheet, setSheet] = useState<CallSheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [autoSavedAt, setAutoSavedAt] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"editor" | "preview">("editor");
  const [copied, setCopied] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [docSections, setDocSections] = useState<Record<SectionKey, boolean>>(allSectionsVisible());
  const [docRedacted, setDocRedacted] = useState(false);

  function handleExport(sections: Record<SectionKey, boolean>, includeContacts: boolean) {
    setDocSections(sections);
    setDocRedacted(!includeContacts);
    setPdfOpen(false);
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        setDocSections(allSectionsVisible());
        setDocRedacted(false);
      }, 500);
    }, 100);
  }

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
    const updated = await saveSheet(next as CallSheetStatus | undefined);
    if (updated && activeTab !== "editor") setActiveTab("preview");
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

  async function publishSheet() {
    await saveSheet("PUBLISHED");
  }

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
        setActiveTab("editor");
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
    locations, shotStyle, weatherData, schedule, shotlist, crew, talent, catering, documents,
    notesGeneral, notesSafety, notesParking,
    header, clientTeam, agencyTeam, productionCompany, callTimes, productionMobiles,
    movementOrder, equipment,
    clientName: sheet?.production.campaign?.client?.name || sheet?.production.clientName || "",
    productionTitle: sheet?.production.title || "",
    productionId: sheet?.production.id || "",
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-card flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!sheet) {
    return (
      <div className="min-h-screen bg-card flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Call sheet not found.</p>
          <Link
            href={`/production/${id}`}
            className="text-[#ff4444] text-sm font-medium hover:underline"
          >
            Back to Project
          </Link>
        </div>
      </div>
    );
  }

  if (sheet.status === "PUBLISHED") {
    return (
      <FinalView
        productionTitle={sheet.production.title}
        productionId={id}
        sheet={sheet}
        viewData={viewData}
        onRevert={revertToEditor}
        saving={saving}
        onSaveDistributions={saveDistributions}
      />
    );
  }

  const badge = STATUS_BADGES[sheet.status];

  return (
    <div className="min-h-screen bg-card" data-callsheet-print>
      <div className="max-w-4xl mx-auto px-6 py-10 print:px-0 print:py-0 print:max-w-none">
        <div className="flex items-center justify-between mb-6 print:hidden">
          <Link
            href={`/production/${id}`}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft size={15} />
            {sheet.production.title}
          </Link>
          <div className="flex items-center gap-2">
            {saved && (
              <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                <Check size={13} /> Saved
              </span>
            )}
            {!saved && autoSavedAt && (
              <span className="text-xs text-gray-400">Auto-saved {autoSavedAt}</span>
            )}
            {sheet.shareToken && (
              <button
                onClick={copyShareLink}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                {copied ? <Check size={13} className="text-emerald-600" /> : <Link2 size={13} />}
                {copied ? "Copied!" : "Copy share link"}
              </button>
            )}
            <button
              onClick={manualSave}
              disabled={saving}
              className="flex items-center gap-1.5 bg-[#ff4444] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#ff4444] transition-colors disabled:opacity-60 shadow-sm"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save
            </button>
          </div>
        </div>

        <div className="mb-6 print:hidden">
          <input
            type="text"
            value={shootTitle}
            onChange={(e) => setShootTitle(e.target.value)}
            placeholder="Shoot Title"
            className="text-2xl font-semibold text-gray-900 bg-transparent border-none outline-none w-full placeholder-gray-300 tracking-tight"
          />
          <div className="flex items-center gap-3 mt-1">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.cls}`}>
              {badge.label}
            </span>
            {sheet.production.campaign?.client?.name && (
              <span className="text-xs text-gray-400">
                {sheet.production.campaign.client.name}
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit print:hidden">
          <TabButton active={activeTab === "editor"} onClick={() => setActiveTab("editor")}>
            <Edit2 size={13} /> Editor
          </TabButton>
          <TabButton active={activeTab === "preview"} onClick={() => setActiveTab("preview")}>
            <Eye size={13} /> Preview
          </TabButton>
        </div>

        {activeTab === "editor" ? (
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
        ) : (
          <div>
            <CallSheetDocument data={viewData} sections={docSections} redacted={docRedacted} />
            <div className="flex gap-3 mt-6 pt-6 border-t border-gray-100 print:hidden">
              <button
                onClick={() => setActiveTab("editor")}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <Edit2 size={14} /> Back to Editor
              </button>
              <button
                onClick={() => setPdfOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <FileDown size={14} /> Download PDF
              </button>
              <button
                onClick={publishSheet}
                disabled={saving}
                className="flex items-center gap-2 bg-[#ff4444] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#ff4444] transition-colors disabled:opacity-60 shadow-sm"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Publish &amp; Share
              </button>
            </div>
          </div>
        )}
      </div>
      {pdfOpen && <PdfExportModal onClose={() => setPdfOpen(false)} onExport={handleExport} />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        active ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
      }`}
    >
      <span className="flex items-center gap-1.5">{children}</span>
    </button>
  );
}
