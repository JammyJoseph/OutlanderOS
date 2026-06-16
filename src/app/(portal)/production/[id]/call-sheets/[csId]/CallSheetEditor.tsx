"use client";

import { useState } from "react";
import {
  Clock, MapPin, Cloud, Camera, Users, Coffee, Paperclip, FileText,
  GripVertical, UserPlus, Wallet, Contact as ContactIcon,
} from "lucide-react";
import type {
  Attachment,
  CallSheet,
  CateringDetails,
  CrewMember,
  LocationData,
  ScheduleItem,
  Shot,
  TalentMember,
  WeatherData,
} from "./types";
import { Section, AddButton, DeleteButton, inputCls, smallInputCls, labelCls } from "./shared";
import { PeopleTable } from "./shared";
import { LocationEditor } from "./LocationMap";
import { WeatherEditor } from "./WeatherWidget";
import { ShotlistEditor } from "./Shotlist";
import { CateringEditor } from "./CateringSection";
import { DocumentsEditor } from "./DocumentsSection";

export interface EditorProps {
  shootDate: string; setShootDate: (v: string) => void;
  callTime: string; setCallTime: (v: string) => void;
  wrapTime: string; setWrapTime: (v: string) => void;
  schedule: ScheduleItem[]; setSchedule: (v: ScheduleItem[]) => void;
  location: LocationData; setLocation: (v: LocationData) => void;
  locationLat: number | null; locationLng: number | null;
  setCoords: (lat: number | null, lng: number | null) => void;
  weatherData: WeatherData | null; setWeatherData: (v: WeatherData | null) => void;
  shotlist: Shot[]; setShotlist: (v: Shot[]) => void;
  crew: CrewMember[]; setCrew: (v: CrewMember[]) => void;
  talent: TalentMember[]; setTalent: (v: TalentMember[]) => void;
  catering: CateringDetails; setCatering: (v: CateringDetails) => void;
  documents: Attachment[]; setDocuments: (v: Attachment[]) => void;
  notesGeneral: string; setNotesGeneral: (v: string) => void;
  notesSafety: string; setNotesSafety: (v: string) => void;
  notesParking: string; setNotesParking: (v: string) => void;
  production: CallSheet["production"];
}

const iconCls = "text-gray-400";

function gbp(n: number): string {
  return n.toLocaleString("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  });
}

export function CallSheetEditor(p: EditorProps) {
  const rosterCount = p.crew.length + p.talent.length;
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  function handleDrop(target: number) {
    if (dragIndex === null || dragIndex === target) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const next = [...p.schedule];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(target, 0, moved);
    p.setSchedule(next);
    setDragIndex(null);
    setDragOverIndex(null);
  }

  // Merge the production team into crew, skipping people already listed.
  function importTeam() {
    const team = p.production.teamMembers ?? [];
    if (!team.length) return;
    const existing = new Set(
      p.crew.map((c) => `${(c.name || "").trim().toLowerCase()}|${(c.email || "").trim().toLowerCase()}`)
    );
    const incoming = team
      .filter(
        (m) =>
          !existing.has(`${(m.name || "").trim().toLowerCase()}|${(m.email || "").trim().toLowerCase()}`)
      )
      .map((m) => ({
        role: m.role || "",
        name: m.name,
        callTime: p.callTime || "",
        email: m.email || "",
        phone: m.phone || "",
      }));
    if (incoming.length) p.setCrew([...p.crew, ...incoming]);
  }

  const billingContact = p.production.campaign?.billingContact ?? null;
  const hasReference = p.production.budgetTotal != null || billingContact != null;

  return (
    <div className="space-y-4">
      {/* 1. General Info */}
      <Section title="General Info" icon={<Clock size={15} className={iconCls} />}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Shoot Date</label>
            <input
              type="date"
              value={p.shootDate}
              onChange={(e) => p.setShootDate(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Call Time</label>
            <input
              type="time"
              value={p.callTime}
              onChange={(e) => p.setCallTime(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Wrap Time</label>
            <input
              type="time"
              value={p.wrapTime}
              onChange={(e) => p.setWrapTime(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>

        {/* Read-only references pulled from the production / Commercial deal */}
        {hasReference && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-50">
            {p.production.budgetTotal != null && (
              <div className="rounded-xl bg-gray-50 border border-gray-100 px-3.5 py-2.5">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                  <Wallet size={11} /> Budget reference
                </p>
                <p className="text-sm font-semibold text-gray-800">
                  {gbp(p.production.budgetTotal)}
                </p>
                <p className="text-[11px] text-gray-400">Set on the production — read only</p>
              </div>
            )}
            {billingContact && (
              <div className="rounded-xl bg-gray-50 border border-gray-100 px-3.5 py-2.5">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                  <ContactIcon size={11} /> Client contact
                </p>
                <p className="text-sm font-semibold text-gray-800">
                  {billingContact.name}
                  {billingContact.role ? (
                    <span className="text-gray-400 font-normal"> · {billingContact.role}</span>
                  ) : null}
                </p>
                <p className="text-[11px] text-gray-500">
                  {[billingContact.email, billingContact.phone].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
            )}
          </div>
        )}
      </Section>

      {/* 2. Location */}
      <Section title="Location" icon={<MapPin size={15} className={iconCls} />}>
        <LocationEditor
          location={p.location}
          setLocation={p.setLocation}
          lat={p.locationLat}
          lng={p.locationLng}
          onCoordsChange={p.setCoords}
        />
      </Section>

      {/* 3. Weather */}
      <Section title="Weather" icon={<Cloud size={15} className={iconCls} />}>
        <WeatherEditor
          lat={p.locationLat}
          lng={p.locationLng}
          shootDate={p.shootDate}
          weatherData={p.weatherData}
          setWeatherData={p.setWeatherData}
        />
      </Section>

      {/* 4. Schedule — drag the grip to reorder rows */}
      <Section title="Schedule" icon={<Clock size={15} className={iconCls} />}>
        <div className="space-y-2">
          {p.schedule.map((item, i) => (
            <div
              key={i}
              draggable
              onDragStart={(e) => {
                setDragIndex(i);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dragOverIndex !== i) setDragOverIndex(i);
              }}
              onDragLeave={() => setDragOverIndex((d) => (d === i ? null : d))}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(i);
              }}
              onDragEnd={() => {
                setDragIndex(null);
                setDragOverIndex(null);
              }}
              className={`grid grid-cols-[20px_100px_1fr_1fr_32px] gap-2 items-center rounded-lg transition-colors ${
                dragOverIndex === i && dragIndex !== null && dragIndex !== i
                  ? "bg-red-50/70 ring-1 ring-[#ff4444]/30"
                  : dragIndex === i
                  ? "opacity-50"
                  : ""
              }`}
            >
              <span className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 flex justify-center">
                <GripVertical size={14} />
              </span>
              <input
                type="time"
                value={item.time}
                onChange={(e) =>
                  p.setSchedule(p.schedule.map((s, j) => (j === i ? { ...s, time: e.target.value } : s)))
                }
                className={smallInputCls}
              />
              <input
                type="text"
                value={item.description}
                onChange={(e) =>
                  p.setSchedule(
                    p.schedule.map((s, j) => (j === i ? { ...s, description: e.target.value } : s))
                  )
                }
                placeholder="Activity"
                className={smallInputCls}
              />
              <input
                type="text"
                value={item.notes}
                onChange={(e) =>
                  p.setSchedule(p.schedule.map((s, j) => (j === i ? { ...s, notes: e.target.value } : s)))
                }
                placeholder="Notes"
                className={smallInputCls}
              />
              <DeleteButton onClick={() => p.setSchedule(p.schedule.filter((_, j) => j !== i))} />
            </div>
          ))}
          <AddButton
            label="Add Row"
            onClick={() => p.setSchedule([...p.schedule, { time: "", description: "", notes: "" }])}
          />
        </div>
      </Section>

      {/* 5. Shotlist */}
      <Section title="Shotlist" icon={<Camera size={15} className={iconCls} />}>
        <ShotlistEditor shotlist={p.shotlist} setShotlist={p.setShotlist} />
      </Section>

      {/* 6. Crew */}
      <Section
        title="Crew"
        icon={<Users size={15} className={iconCls} />}
        action={
          (p.production.teamMembers ?? []).length > 0 ? (
            <button
              onClick={importTeam}
              className="flex items-center gap-1.5 text-xs font-medium text-[#ff4444] hover:text-[#ff4444] transition-colors"
            >
              <UserPlus size={13} /> Import from team
            </button>
          ) : undefined
        }
      >
        <PeopleTable people={p.crew} setPeople={(v) => p.setCrew(v as CrewMember[])} addLabel="Add Crew" />
      </Section>

      {/* 7. Talent / Cast */}
      <Section title="Talent / Cast" icon={<Users size={15} className={iconCls} />}>
        <PeopleTable
          people={p.talent}
          setPeople={(v) => p.setTalent(v as TalentMember[])}
          addLabel="Add Talent"
        />
      </Section>

      {/* 8. Catering */}
      <Section title="Catering" icon={<Coffee size={15} className={iconCls} />}>
        <CateringEditor catering={p.catering} setCatering={p.setCatering} rosterCount={rosterCount} />
      </Section>

      {/* 9. Documents */}
      <Section title="Documents" icon={<Paperclip size={15} className={iconCls} />}>
        <DocumentsEditor documents={p.documents} setDocuments={p.setDocuments} />
      </Section>

      {/* 10. Notes */}
      <Section title="Notes" icon={<FileText size={15} className={iconCls} />}>
        <div className="space-y-3">
          {[
            { label: "Production Notes", value: p.notesGeneral, set: p.setNotesGeneral, ph: "General production notes..." },
            { label: "Safety Notes", value: p.notesSafety, set: p.setNotesSafety, ph: "Safety briefing, hazards..." },
            { label: "Parking Instructions", value: p.notesParking, set: p.setNotesParking, ph: "Parking details..." },
          ].map(({ label, value, set, ph }) => (
            <div key={label}>
              <label className={labelCls}>{label}</label>
              <textarea
                value={value}
                onChange={(e) => set(e.target.value)}
                placeholder={ph}
                rows={2}
                className={`${inputCls} resize-none`}
              />
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
