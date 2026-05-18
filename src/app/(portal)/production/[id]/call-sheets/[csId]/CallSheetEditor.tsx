"use client";

import { Clock, MapPin, Cloud, Camera, Users, Coffee, Paperclip, FileText } from "lucide-react";
import type {
  Attachment,
  CateringDetails,
  CrewMember,
  LocationData,
  ScheduleItem,
  Shot,
  TalentMember,
  WeatherData,
} from "./types";
import { Section, AddButton, DeleteButton, inputCls, smallInputCls, labelCls, PeopleTable } from "./shared";
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
}

const iconCls = "text-gray-400";

export function CallSheetEditor(p: EditorProps) {
  const rosterCount = p.crew.length + p.talent.length;

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

      {/* 4. Schedule */}
      <Section title="Schedule" icon={<Clock size={15} className={iconCls} />}>
        <div className="space-y-2">
          {p.schedule.map((item, i) => (
            <div key={i} className="grid grid-cols-[100px_1fr_1fr_32px] gap-2 items-center">
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
      <Section title="Crew" icon={<Users size={15} className={iconCls} />}>
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
