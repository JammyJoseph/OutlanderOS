"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Loader2, Check, Edit2, Share2, X,
  FileDown, MessageSquareText, Users, Briefcase, Mail,
} from "lucide-react";
import type {
  AgencyTeamMember, Attachment, CallSheet, CallSheetHeader, CallSheetLocation,
  CallSheetStatus, CallTimeRow, CateringDetails, ClientContactRef, ClientTeamMember, CrewMember,
  EquipmentInfo, LocationData, MovementOrder,
  ProductionCompanyInfo, ProductionMobile, ScheduleItem, Shot, ShotStyle,
  TalentMember, WeatherData,
} from "./types";
import {
  emptyCatering, emptyEquipment, emptyHeader, emptyLocation,
  emptyMovementOrder, emptyProductionCompany, emptyShotStyle,
} from "./types";
import { CallSheetEditor } from "./CallSheetEditor";
import { CallSheetDocument, type CallSheetViewData } from "./CallSheetDocument";
import { generateSMSSummary } from "./smsSummary";
import { PresenceBar } from "./PresenceBar";
import {
  fullPayload, sheetToState, useCollab,
  type FieldKey, type SheetState,
} from "./collab";
import { EmailSharePanel } from "./EmailSharePanel";
import { clientRecipients, crewRecipients, type EmailAudience } from "./emailShare";

const STATUS_BADGES: Record<CallSheetStatus, { cls: string; label: string }> = {
  DRAFT: { cls: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400", label: "Draft" },
  SAVED: { cls: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300", label: "Saved" },
  PUBLISHED: { cls: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300", label: "Published" },
};

// Two modes, full stop:
//   editor  — fill in the call sheet. One button, "Finish", which saves +
//             publishes and drops you into the preview.
//   preview — the live CallSheetDocument exactly as it will be shared. Two
//             buttons: "Back to Editor" and "Share" (opens the share popup).
// The share popup is a plain overlay on top of the preview — no separate page.
type Mode = "editor" | "preview";

export default function CallSheetPage() {
  const { id, csId } = useParams<{ id: string; csId: string }>();

  const [sheet, setSheet] = useState<CallSheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [mode, setMode] = useState<Mode>("editor");
  const [showShare, setShowShare] = useState(false);
  // Snapshot of the production deliverables so they render on the preview /
  // printed / PDF call sheet (the editor keeps the live, editable copy). The
  // public share views fetch these server-side; the in-app views need them here.
  const [deliverables, setDeliverables] = useState<
    { type: string; title: string; notes: string | null }[]
  >([]);

  const [shootTitle, setShootTitle] = useState("");
  const [shootDate, setShootDate] = useState("");
  // The unit call — the master time everyone inherits. Mirrored into the legacy
  // `callTime` column on save so older readers (call-sheet list, confirmations)
  // keep working.
  const [unitCallTime, setUnitCallTime] = useState("08:00");
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

  // Live editor state, as one object. The collab layer reads it through a ref so
  // a timer never sees a stale copy, and diffs it field by field against what the
  // server holds — see ./collab.
  const state: SheetState = {
    shootTitle, shootDate, unitCallTime, wrapTime, schedule, location, locationLat,
    locationLng, locations, shotStyle, weatherData, shotlist, crew, talent,
    catering, documents, notesGeneral, notesSafety, notesParking, header,
    clientTeam, agencyTeam, productionCompany, callTimes, productionMobiles,
    movementOrder, equipment,
  };
  const stateRef = useRef<SheetState>(state);
  stateRef.current = state;

  // Push one field of a remote (someone else's) change into local state. Which
  // fields get here is the collab layer's call — it never routes a field the
  // user is currently editing.
  const applyRemote = useCallback((key: FieldKey, value: SheetState[FieldKey]) => {
    switch (key) {
      case "shootTitle": setShootTitle(value as string); break;
      case "shootDate": setShootDate(value as string); break;
      case "unitCallTime": setUnitCallTime(value as string); break;
      case "wrapTime": setWrapTime(value as string); break;
      case "schedule": setSchedule(value as ScheduleItem[]); break;
      case "location": setLocation(value as LocationData); break;
      case "locationLat": setLocationLat(value as number | null); break;
      case "locationLng": setLocationLng(value as number | null); break;
      case "locations": setLocations(value as CallSheetLocation[]); break;
      case "shotStyle": setShotStyle(value as ShotStyle); break;
      case "weatherData": setWeatherData(value as WeatherData | null); break;
      case "shotlist": setShotlist(value as Shot[]); break;
      case "crew": setCrew(value as CrewMember[]); break;
      case "talent": setTalent(value as TalentMember[]); break;
      case "catering": setCatering(value as CateringDetails); break;
      case "documents": setDocuments(value as Attachment[]); break;
      case "notesGeneral": setNotesGeneral(value as string); break;
      case "notesSafety": setNotesSafety(value as string); break;
      case "notesParking": setNotesParking(value as string); break;
      case "header": setHeader(value as CallSheetHeader); break;
      case "clientTeam": setClientTeam(value as ClientTeamMember[]); break;
      case "agencyTeam": setAgencyTeam(value as AgencyTeamMember[]); break;
      case "productionCompany": setProductionCompany(value as ProductionCompanyInfo); break;
      case "callTimes": setCallTimes(value as CallTimeRow[]); break;
      case "productionMobiles": setProductionMobiles(value as ProductionMobile[]); break;
      case "movementOrder": setMovementOrder(value as MovementOrder); break;
      case "equipment": setEquipment(value as EquipmentInfo); break;
    }
  }, []);

  const handleSheet = useCallback((s: CallSheet) => {
    setSheet((prev) => (prev ? { ...prev, ...s } : s));
  }, []);

  // Auto-save (300ms debounce, per field), the 4s merge poll, and presence. Only
  // runs in the editor: a published sheet sitting in preview is read-only, and
  // "Finish" owns that write.
  const collab = useCollab({
    csId,
    enabled: mode === "editor" && !!sheet && sheet.status !== "PUBLISHED",
    state: sheet ? state : null,
    applyRemote,
    onSheet: handleSheet,
  });
  // The wholesale save (Finish / Back to Editor) needs to re-baseline the collab
  // layer afterwards, without taking `collab` as a dependency and re-creating
  // itself every render.
  const collabRef = useRef(collab);
  collabRef.current = collab;

  const loadSheet = useCallback(() => {
    fetch(`/api/call-sheets/${csId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.sheet) return;
        const s: CallSheet = d.sheet;
        setSheet(s);
        // A sheet that's already published loads straight into the preview;
        // everything else opens in the editor.
        setMode(s.status === "PUBLISHED" ? "preview" : "editor");
        // One normalisation path for the initial load and for every poll (see
        // sheetToState in ./collab), so local and remote state are always
        // compared after exactly the same massaging.
        const next = sheetToState(s);
        applyRemote("shootTitle", next.shootTitle);
        applyRemote("shootDate", next.shootDate);
        applyRemote("unitCallTime", next.unitCallTime);
        applyRemote("wrapTime", next.wrapTime);
        applyRemote("schedule", next.schedule);
        applyRemote("location", next.location);
        applyRemote("locationLat", next.locationLat);
        applyRemote("locationLng", next.locationLng);
        applyRemote("locations", next.locations);
        applyRemote("shotStyle", next.shotStyle);
        applyRemote("weatherData", next.weatherData);
        applyRemote("shotlist", next.shotlist);
        applyRemote("crew", next.crew);
        applyRemote("talent", next.talent);
        applyRemote("catering", next.catering);
        applyRemote("documents", next.documents);
        applyRemote("notesGeneral", next.notesGeneral);
        applyRemote("notesSafety", next.notesSafety);
        applyRemote("notesParking", next.notesParking);
        applyRemote("header", next.header);
        applyRemote("clientTeam", next.clientTeam);
        applyRemote("agencyTeam", next.agencyTeam);
        applyRemote("productionCompany", next.productionCompany);
        applyRemote("callTimes", next.callTimes);
        applyRemote("productionMobiles", next.productionMobiles);
        applyRemote("movementOrder", next.movementOrder);
        applyRemote("equipment", next.equipment);
        // Nothing is dirty at rest — this row is the baseline auto-save diffs against.
        collab.seed(s);
      })
      .finally(() => setLoading(false));
    // `collab.seed` and `applyRemote` are both stable (useCallback with no deps),
    // so this only ever re-runs for a different sheet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [csId, applyRemote, collab.seed]);

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

  function setCoords(lat: number | null, lng: number | null) {
    setLocationLat(lat);
    setLocationLng(lng);
  }

  // Wholesale save. Auto-save no longer needs this — it PATCHes single fields —
  // but a status transition does: "Finish" publishes, "Back to Editor" demotes,
  // and both want the whole sheet written in one shot alongside the new status.
  const saveSheet = useCallback(
    async (newStatus?: CallSheetStatus) => {
      const current = stateRef.current;
      if (!current.shootDate) return null;
      setSaving(true);
      try {
        const res = await fetch(`/api/call-sheets/${csId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...fullPayload(current),
            ...(newStatus ? { status: newStatus } : {}),
          }),
        });
        const data = await res.json();
        if (data.sheet) {
          setSheet((prev) => (prev ? { ...prev, ...data.sheet } : data.sheet));
          // Re-baseline: this write is now what the server holds, so auto-save
          // doesn't immediately consider every field dirty again.
          collabRef.current.seed(data.sheet as CallSheet);
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
          return data.sheet as CallSheet;
        }
      } finally {
        setSaving(false);
      }
      return null;
    },
    [csId]
  );

  // "Finish" — persist the sheet and publish it (publishing mints the crew +
  // client share tokens so the links resolve), then show the preview.
  async function finish() {
    const updated = await saveSheet("PUBLISHED");
    if (updated) setMode("preview");
  }

  // "Back to Editor" — drop the sheet back to SAVED (so it's no longer live and
  // auto-save resumes) and return to the editing interface.
  async function backToEditor() {
    if (sheet && sheet.status === "PUBLISHED") {
      await saveSheet("SAVED");
    }
    setMode("editor");
  }

  // Entering the preview, make sure both share tokens exist. Finish mints them
  // via publish, but a sheet published before the client token existed can
  // arrive here missing one — top it up on demand.
  useEffect(() => {
    if (mode !== "preview" || !sheet) return;
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

  // Persist crew into the Directory with this production tagged as a credit.
  async function syncDirectory() {
    await fetch(`/api/call-sheets/${csId}/sync-directory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ crew: stateRef.current.crew }),
    });
  }

  const viewData: CallSheetViewData = {
    shootTitle, shootDate, callTime: unitCallTime, unitCallTime, wrapTime, location, locationLat, locationLng,
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

  const badge = STATUS_BADGES[sheet.status];

  return (
    <div className="min-h-screen bg-card print:bg-white" data-callsheet-print>
      <div className="max-w-4xl mx-auto px-6 py-10 print:px-0 print:py-0 print:max-w-none">
        {/* Top bar — actions vary by mode */}
        <div className="flex items-center justify-between mb-6 print:hidden">
          <Link
            href={`/production/${id}`}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            <ArrowLeft size={15} />
            {sheet.production.title}
          </Link>
          <div className="flex items-center gap-2">
            {mode === "editor" ? (
              <>
                {saved && (
                  <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    <Check size={13} /> Saved
                  </span>
                )}
                <button
                  onClick={finish}
                  disabled={saving}
                  className="flex items-center gap-1.5 bg-[#A93B2E] text-white px-5 py-2 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60 shadow-sm"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Finish
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={backToEditor}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-60"
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Edit2 size={13} />}
                  Back to Editor
                </button>
                <button
                  onClick={() => setShowShare(true)}
                  className="flex items-center gap-1.5 bg-[#A93B2E] text-white px-5 py-2 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity shadow-sm"
                >
                  <Share2 size={14} /> Share
                </button>
              </>
            )}
          </div>
        </div>

        {mode === "editor" && (
          <>
            {/* Who else is in here, and whether the last change landed. */}
            <PresenceBar others={collab.others} status={collab.status} />

            {/* Title / status */}
            <div className="mb-6 print:hidden">
              <input
                type="text"
                value={shootTitle}
                onChange={(e) => setShootTitle(e.target.value)}
                placeholder={sheet.production.title || "Shoot Title"}
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

            <div className="print:hidden">
              <CallSheetEditor
                shootDate={shootDate} setShootDate={setShootDate}
                unitCallTime={unitCallTime} setUnitCallTime={setUnitCallTime}
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
          </>
        )}

        {/* Preview — the live document, exactly as it will be shared / printed.
            What you see here IS the PDF (window.print captures this node). */}
        {mode === "preview" && <CallSheetDocument data={viewData} />}
      </div>

      {showShare && (
        <ShareModal
          data={viewData}
          shareToken={sheet.shareToken}
          clientShareToken={sheet.clientShareToken}
          clientContact={sheet.production.campaign?.billingContact ?? null}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
}

// ── Share popup ───────────────────────────────────────────────────────────────
// Plain overlay on top of the preview. Download PDF, copy the SMS summary, and
// copy the two share links. Click outside or the X to dismiss.
type CopyKey = "sms" | "team" | "client";

// Copy text to the clipboard across environments. Prefers the async Clipboard
// API (HTTPS / secure context), falls back to a hidden textarea + execCommand
// so it still works when navigator.clipboard is unavailable. Never throws.
function copyToClipboard(text: string): void {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
      return;
    }
  } catch {
    /* fall through to the textarea path */
  }
  fallbackCopy(text);
}

function fallbackCopy(text: string): void {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-9999px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  } catch {
    /* nothing more we can do — feedback still shows optimistically */
  }
}

function ShareModal({
  data,
  shareToken,
  clientShareToken,
  clientContact,
  onClose,
}: {
  data: CallSheetViewData;
  shareToken: string | null;
  clientShareToken: string | null;
  clientContact: ClientContactRef | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState<CopyKey | null>(null);
  // Non-null once an "Email …" row is picked — the popup swaps the options list
  // for the compose panel (recipients + the mailto hand-off) in place.
  const [emailAudience, setEmailAudience] = useState<EmailAudience | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const teamUrl = shareToken ? `${origin}/call-sheet/${shareToken}` : "";
  const clientUrl = clientShareToken ? `${origin}/call-sheet/client/${clientShareToken}` : "";
  const crewCount = crewRecipients(data).length;
  const clientCount = clientRecipients(data, clientContact).length;

  function copyText(text: string, key: CopyKey) {
    if (!text) return;
    // copyToClipboard is resilient: it uses the async Clipboard API when it's
    // available in a secure context, and falls back to execCommand otherwise
    // (some proxied / non-HTTPS setups leave navigator.clipboard undefined,
    // which used to throw here and silently kill the whole handler).
    copyToClipboard(text);
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000);
  }

  // Close the popup first so it never lands in the printout, then print the
  // preview (the CallSheetDocument) underneath.
  function downloadPdf() {
    onClose();
    setTimeout(() => window.print(), 60);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 print:hidden"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200">
            {emailAudience ? "Share by email" : "Share call sheet"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 dark:text-gray-500"
          >
            <X size={16} />
          </button>
        </div>

        {emailAudience ? (
          <EmailSharePanel
            data={data}
            audience={emailAudience}
            setAudience={setEmailAudience}
            teamUrl={teamUrl}
            clientUrl={clientUrl}
            clientContact={clientContact}
            onBack={() => setEmailAudience(null)}
          />
        ) : (
          <>
            <div className="p-5 space-y-2.5">
              <ShareRow
                icon={<FileDown size={16} />}
                title="Download PDF"
                subtitle="Print the call sheet exactly as previewed"
                onClick={downloadPdf}
              />
              <ShareRow
                icon={<MessageSquareText size={16} />}
                title="Copy SMS summary"
                subtitle={copied === "sms" ? "Copied to clipboard" : "Short text roundup with the team link"}
                active={copied === "sms"}
                onClick={() => copyText(generateSMSSummary(data, teamUrl || null), "sms")}
              />
              <ShareRow
                icon={<Mail size={16} />}
                title="Email Crew"
                subtitle={
                  crewCount
                    ? `Draft an email to ${crewCount} crew / talent ${
                        crewCount === 1 ? "address" : "addresses"
                      } (BCC)`
                    : "No crew emails on the sheet yet — add them by hand"
                }
                onClick={() => setEmailAudience("crew")}
              />
              <ShareRow
                icon={<Mail size={16} />}
                title="Email Client"
                subtitle={
                  clientCount
                    ? `Draft an email to ${clientCount} client / agency ${
                        clientCount === 1 ? "address" : "addresses"
                      } (BCC)`
                    : "No client emails on the deal yet — add them by hand"
                }
                onClick={() => setEmailAudience("client")}
              />
              <ShareRow
                icon={<Users size={16} />}
                title="Team link"
                subtitle={
                  copied === "team"
                    ? "Copied to clipboard"
                    : teamUrl
                    ? "Full details — crew contacts, talent, deliverables"
                    : "Publish the sheet to generate this link"
                }
                active={copied === "team"}
                disabled={!teamUrl}
                onClick={() => copyText(teamUrl, "team")}
              />
              <ShareRow
                icon={<Briefcase size={16} />}
                title="Client link"
                subtitle={
                  copied === "client"
                    ? "Copied to clipboard"
                    : clientUrl
                    ? "Contact numbers hidden (agency contacts stay visible)"
                    : "Publish the sheet to generate this link"
                }
                active={copied === "client"}
                disabled={!clientUrl}
                onClick={() => copyText(clientUrl, "client")}
              />
            </div>

            <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ShareRow({
  icon,
  title,
  subtitle,
  onClick,
  active,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-3 w-full text-left p-3 rounded-xl border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        active
          ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20"
          : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
      }`}
    >
      <span className={`shrink-0 ${active ? "text-emerald-600 dark:text-emerald-400" : "text-[#A93B2E]"}`}>
        {active ? <Check size={16} /> : icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</span>
        <span
          className={`block text-xs mt-0.5 ${
            active ? "text-emerald-600 dark:text-emerald-400" : "text-gray-500 dark:text-gray-400"
          }`}
        >
          {subtitle}
        </span>
      </span>
    </button>
  );
}
