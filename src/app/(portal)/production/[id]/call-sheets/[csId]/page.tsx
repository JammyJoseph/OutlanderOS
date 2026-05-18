"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Eye, Send, Edit2, Loader2, Check } from "lucide-react";
import type {
  Attachment, CallSheet, CallSheetStatus, CateringDetails, CrewMember,
  LocationData, ScheduleItem, Shot, TalentMember, WeatherData,
} from "./types";
import {
  emptyCatering, emptyLocation, migrateCatering, parseNotes, serializeNotes,
} from "./types";
import { CallSheetEditor } from "./CallSheetEditor";
import { CallSheetDocument, type CallSheetViewData } from "./CallSheetDocument";
import { FinalView } from "./FinalView";

export default function CallSheetPage() {
  const { id, csId } = useParams<{ id: string; csId: string }>();

  const [sheet, setSheet] = useState<CallSheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<"editor" | "preview">("editor");
  const [copied, setCopied] = useState(false);

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
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [talent, setTalent] = useState<TalentMember[]>([]);
  const [catering, setCatering] = useState<CateringDetails>(emptyCatering());
  const [documents, setDocuments] = useState<Attachment[]>([]);
  const [notesGeneral, setNotesGeneral] = useState("");
  const [notesSafety, setNotesSafety] = useState("");
  const [notesParking, setNotesParking] = useState("");

  const loadSheet = useCallback(() => {
    fetch(`/api/call-sheets/${csId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.sheet) return;
        const s: CallSheet = d.sheet;
        setSheet(s);
        const notes = parseNotes(s.notes);
        setShootTitle(notes.shootTitle || s.production.title);
        setShootDate(s.shootDate.split("T")[0]);
        setCallTime(s.callTime || "08:00");
        setWrapTime(notes.wrapTime || "");
        setSchedule(Array.isArray(s.schedule) ? s.schedule : []);
        setLocation(
          s.location && typeof s.location === "object" ? s.location : emptyLocation()
        );
        setLocationLat(s.locationLat ?? null);
        setLocationLng(s.locationLng ?? null);
        setWeatherData(s.weatherData ?? null);
        setShotlist(Array.isArray(s.shotlist) ? s.shotlist : []);
        setCrew(Array.isArray(s.crew) ? s.crew : []);
        setTalent(Array.isArray(notes.talent) ? notes.talent : []);
        setDocuments(Array.isArray(s.documents) ? s.documents : []);
        setCatering(migrateCatering(s.cateringDetails, s.notes));
        setNotesGeneral(notes.general || "");
        setNotesSafety(notes.safety || "");
        setNotesParking(notes.parking || "");
      })
      .finally(() => setLoading(false));
  }, [csId]);

  useEffect(() => {
    loadSheet();
  }, [loadSheet]);

  function setCoords(lat: number | null, lng: number | null) {
    setLocationLat(lat);
    setLocationLng(lng);
  }

  async function saveSheet(newStatus?: CallSheetStatus) {
    if (!sheet) return;
    setSaving(true);
    const notesData = {
      shootTitle, wrapTime, talent, general: notesGeneral,
      safety: notesSafety, parking: notesParking,
    };
    try {
      const res = await fetch(`/api/call-sheets/${csId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shootDate: new Date(shootDate).toISOString(),
          callTime,
          location,
          locationLat,
          locationLng,
          schedule,
          shotlist,
          crew,
          cateringDetails: catering,
          documents,
          weatherData,
          notes: serializeNotes(notesData),
          status: newStatus ?? (sheet.status === "DRAFT" ? "SAVED" : sheet.status),
        }),
      });
      const data = await res.json();
      if (data.sheet) {
        setSheet((prev) => (prev ? { ...prev, ...data.sheet } : prev));
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        if (newStatus === "SAVED" && activeTab === "editor") setActiveTab("preview");
      }
    } finally {
      setSaving(false);
    }
  }

  async function publishSheet() {
    await saveSheet("PUBLISHED");
    setSheet((prev) => (prev ? { ...prev, status: "PUBLISHED" } : prev));
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

  function copyShareLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const viewData: CallSheetViewData = {
    shootTitle, shootDate, callTime, wrapTime, location, locationLat, locationLng,
    weatherData, schedule, shotlist, crew, talent, catering, documents,
    notesGeneral, notesSafety, notesParking,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9F9F7] flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!sheet) {
    return (
      <div className="min-h-screen bg-[#F9F9F7] flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Call sheet not found.</p>
          <Link
            href={`/production/${id}`}
            className="text-[#D4A853] text-sm font-medium hover:underline"
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
        viewData={viewData}
        onRevert={revertToEditor}
        saving={saving}
        copied={copied}
        onCopy={copyShareLink}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F9F9F7]">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
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
            <button
              onClick={() => saveSheet("SAVED")}
              disabled={saving}
              className="flex items-center gap-1.5 bg-[#D4A853] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#c49843] transition-colors disabled:opacity-60 shadow-sm"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save
            </button>
          </div>
        </div>

        <div className="mb-6">
          <input
            type="text"
            value={shootTitle}
            onChange={(e) => setShootTitle(e.target.value)}
            placeholder="Shoot Title"
            className="text-2xl font-semibold text-gray-900 bg-transparent border-none outline-none w-full placeholder-gray-300 tracking-tight"
          />
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-600">
              {sheet.status === "DRAFT" ? "Draft" : "Saved"}
            </span>
            {sheet.production.campaign?.client?.name && (
              <span className="text-xs text-gray-400">
                {sheet.production.campaign.client.name}
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
          <TabButton active={activeTab === "editor"} onClick={() => setActiveTab("editor")}>
            <Edit2 size={13} /> Editor
          </TabButton>
          <TabButton active={activeTab === "preview"} onClick={() => setActiveTab("preview")}>
            <Eye size={13} /> Preview
          </TabButton>
        </div>

        {activeTab === "editor" ? (
          <CallSheetEditor
            shootDate={shootDate} setShootDate={setShootDate}
            callTime={callTime} setCallTime={setCallTime}
            wrapTime={wrapTime} setWrapTime={setWrapTime}
            schedule={schedule} setSchedule={setSchedule}
            location={location} setLocation={setLocation}
            locationLat={locationLat} locationLng={locationLng} setCoords={setCoords}
            weatherData={weatherData} setWeatherData={setWeatherData}
            shotlist={shotlist} setShotlist={setShotlist}
            crew={crew} setCrew={setCrew}
            talent={talent} setTalent={setTalent}
            catering={catering} setCatering={setCatering}
            documents={documents} setDocuments={setDocuments}
            notesGeneral={notesGeneral} setNotesGeneral={setNotesGeneral}
            notesSafety={notesSafety} setNotesSafety={setNotesSafety}
            notesParking={notesParking} setNotesParking={setNotesParking}
          />
        ) : (
          <div>
            <CallSheetDocument data={viewData} />
            <div className="flex gap-3 mt-6 pt-6 border-t border-gray-100">
              <button
                onClick={() => setActiveTab("editor")}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <Edit2 size={14} /> Back to Editor
              </button>
              <button
                onClick={publishSheet}
                disabled={saving}
                className="flex items-center gap-2 bg-[#D4A853] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#c49843] transition-colors disabled:opacity-60 shadow-sm"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Publish &amp; Share
              </button>
            </div>
          </div>
        )}
      </div>
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
