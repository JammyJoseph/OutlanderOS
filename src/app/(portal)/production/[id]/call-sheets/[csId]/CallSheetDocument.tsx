"use client";

import {
  MapPin,
  Clock,
  Users,
  Coffee,
  FileText,
  Cloud,
  Camera,
  Paperclip,
} from "lucide-react";
import { format } from "date-fns";
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
import { DocSection, PeopleTable } from "./shared";
import { LocationMap } from "./LocationMap";
import { WeatherDisplay } from "./WeatherWidget";
import { ShotlistDoc } from "./Shotlist";
import { CateringDoc } from "./CateringSection";
import { DocumentsDoc } from "./DocumentsSection";

export interface CallSheetViewData {
  shootTitle: string;
  shootDate: string;
  callTime: string;
  wrapTime: string;
  location: LocationData;
  locationLat: number | null;
  locationLng: number | null;
  weatherData: WeatherData | null;
  schedule: ScheduleItem[];
  shotlist: Shot[];
  crew: CrewMember[];
  talent: TalentMember[];
  catering: CateringDetails;
  documents: Attachment[];
  notesGeneral: string;
  notesSafety: string;
  notesParking: string;
}

export function CallSheetDocument({ data }: { data: CallSheetViewData }) {
  const {
    shootTitle, shootDate, callTime, wrapTime, location, locationLat, locationLng,
    weatherData, schedule, shotlist, crew, talent, catering, documents,
    notesGeneral, notesSafety, notesParking,
  } = data;

  const formattedDate = shootDate
    ? format(new Date(shootDate + "T12:00:00"), "EEEE d MMMM yyyy")
    : "—";

  const hasLocation =
    !!(location.address || location.parkingNotes || location.nearestHospital || location.whatThreeWords) ||
    locationLat != null;
  const rosterCount = crew.length + talent.length;
  const hasCatering =
    !!(catering.provider || catering.providerContact || catering.breakfast ||
      catering.lunch || catering.snacks || catering.notes) ||
    catering.dietary.length > 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden print:rounded-none print:border-0 print:shadow-none">
      {/* Header */}
      <div className="bg-gray-900 text-white px-8 py-6 print:bg-white print:text-gray-900 print:border-b-2 print:border-gray-900">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold">{shootTitle || "Call Sheet"}</h1>
            <p className="text-gray-400 text-sm mt-0.5 print:text-gray-600">{formattedDate}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-[#D4A853]">{callTime || "—"}</div>
            <div className="text-xs text-gray-400 uppercase tracking-wider print:text-gray-600">
              Call Time
            </div>
            {wrapTime && (
              <div className="text-xs text-gray-400 mt-0.5 print:text-gray-600">
                Wrap: {wrapTime}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Location */}
        {hasLocation && (
          <DocSection title="Location" icon={<MapPin size={14} />}>
            {location.address && (
              <p className="text-sm text-gray-700 mb-3">{location.address}</p>
            )}
            {locationLat != null && locationLng != null && (
              <div className="mb-3">
                <LocationMap lat={locationLat} lng={locationLng} height={260} />
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {location.parkingNotes && (
                <DocField label="Parking" value={location.parkingNotes} />
              )}
              {location.nearestHospital && (
                <DocField label="Hospital" value={location.nearestHospital} />
              )}
              {location.whatThreeWords && (
                <DocField label="what3words" value={location.whatThreeWords} />
              )}
            </div>
          </DocSection>
        )}

        {/* Weather */}
        {weatherData && weatherData.forecast.length > 0 && (
          <DocSection title="Weather" icon={<Cloud size={14} />}>
            <WeatherDisplay weatherData={weatherData} shootDate={shootDate} />
          </DocSection>
        )}

        {/* Schedule */}
        {schedule.length > 0 && (
          <DocSection title="Schedule" icon={<Clock size={14} />}>
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              {schedule.map((item, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-4 px-4 py-3 ${
                    i % 2 === 0 ? "bg-gray-50/50" : "bg-white"
                  }`}
                >
                  <span className="text-xs font-mono font-semibold text-[#D4A853] w-12 flex-shrink-0 pt-0.5">
                    {item.time}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">{item.description}</p>
                    {item.notes && (
                      <p className="text-xs text-gray-500 mt-0.5">{item.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </DocSection>
        )}

        {/* Shotlist */}
        {shotlist.length > 0 && (
          <DocSection title="Shotlist" icon={<Camera size={14} />}>
            <ShotlistDoc shotlist={shotlist} />
          </DocSection>
        )}

        {/* Crew */}
        {crew.length > 0 && (
          <DocSection title="Crew" icon={<Users size={14} />}>
            <PeopleTable people={crew} setPeople={() => {}} readOnly />
          </DocSection>
        )}

        {/* Talent */}
        {talent.length > 0 && (
          <DocSection title="Talent / Cast" icon={<Users size={14} />}>
            <PeopleTable people={talent} setPeople={() => {}} readOnly />
          </DocSection>
        )}

        {/* Catering */}
        {hasCatering && (
          <DocSection title="Catering" icon={<Coffee size={14} />}>
            <CateringDoc catering={catering} rosterCount={rosterCount} />
          </DocSection>
        )}

        {/* Documents */}
        {documents.some((d) => d.title || d.url) && (
          <DocSection title="Documents" icon={<Paperclip size={14} />}>
            <DocumentsDoc documents={documents} />
          </DocSection>
        )}

        {/* Notes */}
        {(notesGeneral || notesSafety || notesParking) && (
          <DocSection title="Notes" icon={<FileText size={14} />}>
            <div className="space-y-3">
              {notesGeneral && <DocField label="Production Notes" value={notesGeneral} pre />}
              {notesSafety && <DocField label="Safety" value={notesSafety} pre />}
              {notesParking && <DocField label="Parking" value={notesParking} pre />}
            </div>
          </DocSection>
        )}
      </div>
    </div>
  );
}

function DocField({
  label,
  value,
  pre = false,
}: {
  label: string;
  value: string;
  pre?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
        {label}
      </p>
      <p className={`text-sm text-gray-700 ${pre ? "whitespace-pre-wrap" : ""}`}>{value}</p>
    </div>
  );
}
