"use client";

import {
  MapPin, Clock, Users, Coffee, FileText, Cloud, Camera, Paperclip,
  Building2, Briefcase, Phone, Shield, Lock, Route, Aperture, Hospital,
  Navigation, Package,
} from "lucide-react";
import { format } from "date-fns";
import type {
  AgencyTeamMember, Attachment, CallSheetHeader, CallSheetLocation, CallTimeRow,
  CateringDetails, ClientTeamMember, CrewMember, EquipmentInfo, LocationData,
  MovementOrder, ProductionCompanyInfo, ProductionMobile, ScheduleItem,
  SectionKey, Shot, ShotStyle, TalentMember, WeatherData,
} from "./types";
import { CONDUCT_POLICY, CONFIDENTIALITY_NOTICE, emptyCallSheetLocation } from "./types";
import { DocSection } from "./shared";
import { LocationMap } from "./LocationMap";
import { WeatherDisplay } from "./WeatherWidget";
import { ShotlistDoc } from "./Shotlist";
import { CateringDoc } from "./CateringSection";
import { DocumentsDoc } from "./DocumentsSection";

export interface CallSheetViewData {
  shootTitle: string;
  clientName?: string;
  productionTitle?: string;
  shootDate: string;
  callTime: string;
  wrapTime: string;
  location: LocationData;
  locationLat: number | null;
  locationLng: number | null;
  locations: CallSheetLocation[];
  shotStyle: ShotStyle;
  productionId?: string;
  // Production deliverables snapshot for the printed/public sheet (the editor
  // manages the live, editable copy in its own section).
  deliverables?: { type: string; title: string; notes: string | null }[];
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
  header: CallSheetHeader;
  clientTeam: ClientTeamMember[];
  agencyTeam: AgencyTeamMember[];
  productionCompany: ProductionCompanyInfo;
  callTimes: CallTimeRow[];
  productionMobiles: ProductionMobile[];
  movementOrder: MovementOrder;
  equipment: EquipmentInfo;
}

const REDACTED = "C/O Outlander";

export function CallSheetDocument({
  data,
  redacted = false,
  sections,
}: {
  data: CallSheetViewData;
  redacted?: boolean;
  sections?: Record<SectionKey, boolean>;
}) {
  const {
    shootTitle, clientName, shootDate, callTime, wrapTime, location, locationLat,
    locationLng, locations, shotStyle, deliverables, weatherData, schedule,
    shotlist, crew, talent, catering, documents,
    notesGeneral, notesSafety, notesParking, header, clientTeam, agencyTeam,
    productionCompany, callTimes, productionMobiles, movementOrder, equipment,
  } = data;

  // Default every section visible unless an explicit toggle map says otherwise.
  const show = (k: SectionKey) => (sections ? sections[k] !== false : true);

  const careOf = `C/O ${(productionCompany.name || header.productionCompany || "Outlander").toUpperCase()}`;

  const formattedDate = shootDate
    ? format(new Date(shootDate + "T12:00:00"), "EEEE d MMMM yyyy")
    : "—";

  const hasLocation =
    !!(location.address || location.parkingNotes || location.nearestHospital ||
      location.whatThreeWords || location.nearestStation) || locationLat != null;
  const rosterCount = crew.length + talent.length;
  const hasCatering =
    !!(catering.provider || catering.providerContact || catering.breakfast ||
      catering.lunch || catering.snacks || catering.notes) ||
    catering.dietary.length > 0;
  const hasMovement =
    !!(movementOrder.siteEntrance || movementOrder.techParking ||
      movementOrder.crewParking || movementOrder.routeNotes);
  const hasEquipment = !!(
    equipment.cameraSupplier ||
    equipment.lightingSupplier ||
    equipment.soundSupplier ||
    equipment.gripSupplier ||
    equipment.dataSupplier ||
    equipment.otherNotes ||
    (equipment.kitList && equipment.kitList.length > 0)
  );

  // Ordered location stops. Prefer the multi-location array; fall back to the
  // legacy single location so pre-upgrade sheets still render.
  const legacyStop: CallSheetLocation = {
    ...emptyCallSheetLocation(),
    address: location.address,
    nearestAE: location.nearestHospital,
    parkingNotes: location.parkingNotes,
    whatThreeWords: location.whatThreeWords,
    lat: locationLat,
    lng: locationLng,
  };
  const stops: CallSheetLocation[] =
    locations && locations.length > 0 ? locations : hasLocation ? [legacyStop] : [];
  const hasShotStyle = !!(shotStyle && (shotStyle.tone || shotStyle.visualDevice || shotStyle.notes));

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden print:rounded-none print:border-0 print:shadow-none">
      {/* Header */}
      <div className="bg-gray-900 text-white px-8 py-6 print:bg-white print:text-gray-900 print:border-b-2 print:border-gray-900">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-extrabold tracking-[0.3em] uppercase">
            {header.productionCompany || "Outlander"}
          </span>
          <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-[#ff4444]">
            Call Sheet{redacted ? " · Client" : ""}
          </span>
        </div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold">{shootTitle || "Call Sheet"}</h1>
            <p className="text-gray-400 text-sm mt-0.5 print:text-gray-600">
              {formattedDate}
              {clientName ? ` · ${clientName}` : ""}
            </p>
            {header.jobNumber && (
              <p className="text-gray-500 text-xs mt-0.5 print:text-gray-500">
                Job no. {header.jobNumber}
              </p>
            )}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-[#ff4444]">{callTime || "—"}</div>
            <div className="text-xs text-gray-400 uppercase tracking-wider print:text-gray-600">
              Main Call
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
        {/* Client + Agency teams */}
        {show("header") && clientTeam.some((c) => c.role || c.name) && (
          <DocSection title="Client Team" icon={<Briefcase size={14} />}>
            <TwoColTable rows={clientTeam.filter((c) => c.role || c.name).map((c) => [c.role, c.name])} />
          </DocSection>
        )}

        {show("agencyTeam") && agencyTeam.some((a) => a.role || a.name) && (
          <DocSection title="Agency Team" icon={<Users size={14} />}>
            <ContactTable
              rows={agencyTeam
                .filter((a) => a.role || a.name)
                .map((a) => ({
                  role: a.role,
                  name: a.name,
                  phone: redacted ? REDACTED : a.phone,
                  email: redacted ? "" : a.email,
                }))}
            />
          </DocSection>
        )}

        {/* Production Company */}
        {show("productionCompany") &&
          (productionCompany.name || productionCompany.execProducer || productionCompany.producer) && (
            <DocSection title="Production Company" icon={<Building2 size={14} />}>
              {productionCompany.name && (
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{productionCompany.name}</p>
              )}
              {productionCompany.address && (
                <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{productionCompany.address}</p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                {productionCompany.execProducer && (
                  <DocField label="Executive Producer" value={productionCompany.execProducer} />
                )}
                {productionCompany.producer && (
                  <DocField label="Producer" value={productionCompany.producer} />
                )}
              </div>
            </DocSection>
          )}

        {/* Call Times */}
        {show("callTimes") && callTimes.some((c) => c.time || c.department) && (
          <DocSection title="Call Times" icon={<Clock size={14} />}>
            <div className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
              {callTimes
                .filter((c) => c.time || c.department)
                .map((c, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-4 px-4 py-2.5 ${
                      i % 2 === 0 ? "bg-gray-50/50 dark:bg-gray-800/50" : "bg-white dark:bg-gray-900"
                    }`}
                  >
                    <span className="text-sm font-mono font-bold text-[#ff4444] w-16 shrink-0">
                      {c.time}
                    </span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">{c.department}</span>
                  </div>
                ))}
            </div>
          </DocSection>
        )}

        {/* Production Mobiles */}
        {show("productionMobiles") && productionMobiles.some((m) => m.role || m.name) && (
          <DocSection title="Production Mobiles" icon={<Phone size={14} />}>
            <ContactTable
              rows={productionMobiles
                .filter((m) => m.role || m.name)
                .map((m) => ({
                  role: m.role,
                  name: m.name,
                  phone: redacted ? REDACTED : m.phone,
                  email: "",
                }))}
            />
          </DocSection>
        )}

        {/* Locations (ordered stops = movement order) */}
        {show("location") && (stops.length > 0 || hasMovement) && (
          <DocSection
            title={stops.length > 1 ? "Locations & Movement Order" : "Location"}
            icon={<MapPin size={14} />}
          >
            <div className="space-y-4">
              {stops.map((loc, i) => (
                <div
                  key={i}
                  className={stops.length > 1 ? "border border-gray-100 dark:border-gray-800 rounded-xl p-3" : ""}
                >
                  {stops.length > 1 && (
                    <p className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
                      <span className="flex items-center justify-center w-5 h-5 rounded bg-gray-900 text-white text-[10px] font-bold">
                        {i + 1}
                      </span>
                      {loc.name || `Location ${i + 1}`}
                    </p>
                  )}
                  {loc.address && <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">{loc.address}</p>}
                  {loc.lat != null && loc.lng != null && (
                    <div className="mb-3">
                      <LocationMap lat={loc.lat} lng={loc.lng} height={220} />
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {loc.nearestAE && (
                      <DocField label="Nearest A&E" value={loc.nearestAE} icon={<Hospital size={11} />} />
                    )}
                    {loc.postcode && <DocField label="Postcode" value={loc.postcode} />}
                    {loc.whatThreeWords && <DocField label="what3words" value={loc.whatThreeWords} />}
                    {loc.parkingNotes && <DocField label="Parking" value={loc.parkingNotes} />}
                    {loc.contactPerson && (
                      <DocField label="Contact" value={loc.contactPerson} icon={<Phone size={11} />} />
                    )}
                    {loc.mapLink && <DocField label="Map link" value={loc.mapLink} icon={<Navigation size={11} />} />}
                  </div>
                </div>
              ))}
            </div>
            {location.safetyNotes && (
              <p className="mt-3 text-sm font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800 rounded-lg px-3 py-2">
                NB: {location.safetyNotes}
              </p>
            )}
            {hasMovement && (
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                <p className="flex items-center gap-1.5 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">
                  <Route size={12} /> Movement Order
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {movementOrder.siteEntrance && (
                    <DocField label="Site Entrance" value={movementOrder.siteEntrance} icon={<Navigation size={11} />} />
                  )}
                  {movementOrder.techParking && (
                    <DocField label="Tech Parking" value={movementOrder.techParking} />
                  )}
                  {movementOrder.crewParking && (
                    <DocField label="Crew Parking" value={movementOrder.crewParking} />
                  )}
                </div>
                {movementOrder.routeNotes && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap mt-2">{movementOrder.routeNotes}</p>
                )}
              </div>
            )}
          </DocSection>
        )}

        {/* Weather */}
        {show("weather") && weatherData && weatherData.forecast.length > 0 && (
          <DocSection title="Weather" icon={<Cloud size={14} />}>
            <WeatherDisplay
              weatherData={weatherData}
              shootDate={shootDate}
              callTime={callTime}
              wrapTime={wrapTime}
            />
          </DocSection>
        )}

        {/* Schedule */}
        {show("schedule") && schedule.length > 0 && (
          <DocSection title="Schedule" icon={<Clock size={14} />}>
            <div className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
              {schedule.map((item, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-4 px-4 py-3 ${
                    i % 2 === 0 ? "bg-gray-50/50 dark:bg-gray-800/50" : "bg-white dark:bg-gray-900"
                  }`}
                >
                  <span className="text-xs font-mono font-semibold text-[#ff4444] w-12 flex-shrink-0 pt-0.5">
                    {item.time}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{item.description}</p>
                    {item.notes && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          </DocSection>
        )}

        {/* Shotlist */}
        {show("shotlist") && (shotlist.length > 0 || hasShotStyle) && (
          <DocSection title="Shotlist" icon={<Camera size={14} />}>
            <ShotlistDoc shotlist={shotlist} shotStyle={shotStyle} />
          </DocSection>
        )}

        {/* Deliverables (snapshot from the production Deliverables tab) */}
        {show("deliverables") && (deliverables?.length ?? 0) > 0 && (
          <DocSection title="Deliverables" icon={<Package size={14} />}>
            <div className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
              {deliverables!.map((d, i) => (
                <div
                  key={i}
                  className={`px-4 py-2.5 text-sm ${i % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50/50 dark:bg-gray-800/50"}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                      {d.type}
                    </span>
                    <span className="text-gray-800 dark:text-gray-200 font-medium">{d.title}</span>
                  </div>
                  {d.notes && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 whitespace-pre-wrap mt-0.5">{d.notes}</p>
                  )}
                </div>
              ))}
            </div>
          </DocSection>
        )}

        {/* Unit List (Crew) */}
        {show("crew") && crew.length > 0 && (
          <DocSection title="Unit List" icon={<Users size={14} />}>
            <CrewTable crew={crew} redacted={redacted} careOf={careOf} />
          </DocSection>
        )}

        {/* Talent */}
        {show("talent") && talent.length > 0 && (
          <DocSection title="Talent / Cast" icon={<Users size={14} />}>
            <CrewTable crew={talent} redacted={false} careOf={careOf} />
          </DocSection>
        )}

        {/* Catering */}
        {show("catering") && hasCatering && (
          <DocSection title="Catering" icon={<Coffee size={14} />}>
            <CateringDoc catering={catering} rosterCount={rosterCount} />
          </DocSection>
        )}

        {/* Equipment */}
        {show("equipment") && hasEquipment && (
          <DocSection title="Equipment" icon={<Aperture size={14} />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(
                [
                  ["Camera", "cameraSupplier", "cameraContact", "cameraEmail"],
                  ["Lighting", "lightingSupplier", "lightingContact", "lightingEmail"],
                  ["Sound", "soundSupplier", "soundContact", "soundEmail"],
                  ["Grip", "gripSupplier", "gripContact", "gripEmail"],
                  ["Data", "dataSupplier", "dataContact", "dataEmail"],
                ] as const
              ).map(([label, sKey, cKey, eKey]) => {
                const eq = equipment as unknown as Record<string, string | undefined>;
                if (!eq[sKey]) return null;
                return (
                  <DocField
                    key={label}
                    label={label}
                    value={[eq[sKey], eq[cKey], redacted ? "" : eq[eKey]].filter(Boolean).join(" · ")}
                  />
                );
              })}
            </div>
            {equipment.kitList && equipment.kitList.length > 0 && (
              <div className="mt-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Kit List</p>
                <div className="flex flex-wrap gap-1.5">
                  {equipment.kitList.map((item, i) => (
                    <span
                      key={i}
                      className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full px-2.5 py-0.5"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {equipment.otherNotes && (
              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap mt-2">{equipment.otherNotes}</p>
            )}
          </DocSection>
        )}

        {/* Documents */}
        {show("documents") && documents.some((d) => d.title || d.url) && (
          <DocSection title="Documents" icon={<Paperclip size={14} />}>
            <DocumentsDoc documents={documents} />
          </DocSection>
        )}

        {/* Notes */}
        {show("notes") && (notesGeneral || notesSafety || notesParking) && (
          <DocSection title="Notes" icon={<FileText size={14} />}>
            <div className="space-y-3">
              {notesGeneral && <DocField label="Production Notes" value={notesGeneral} pre />}
              {notesSafety && <DocField label="Safety" value={notesSafety} pre />}
              {notesParking && <DocField label="Parking" value={notesParking} pre />}
            </div>
          </DocSection>
        )}

        {/* Conduct Policy (auto-included) */}
        {show("conduct") && (
          <DocSection title="Conduct Policy" icon={<Shield size={14} />}>
            <p className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap leading-relaxed">{CONDUCT_POLICY}</p>
          </DocSection>
        )}

        {/* Confidentiality (auto-included) */}
        {show("confidentiality") && (
          <DocSection title="Confidentiality Notice" icon={<Lock size={14} />}>
            <p className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap leading-relaxed">{CONFIDENTIALITY_NOTICE}</p>
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
  icon,
}: {
  label: string;
  value: string;
  pre?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <p className="flex items-center gap-1 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">
        {icon}
        {label}
      </p>
      <p className={`text-sm text-gray-700 dark:text-gray-300 ${pre ? "whitespace-pre-wrap" : ""}`}>{value}</p>
    </div>
  );
}

function TwoColTable({ rows }: { rows: [string, string][] }) {
  return (
    <div className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
      {rows.map(([a, b], i) => (
        <div
          key={i}
          className={`grid grid-cols-[1fr_1fr] gap-0 px-4 py-2.5 text-sm ${
            i % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50/50 dark:bg-gray-800/50"
          }`}
        >
          <span className="text-gray-500 dark:text-gray-400 font-medium">{a}</span>
          <span className="text-gray-800 dark:text-gray-200">{b}</span>
        </div>
      ))}
    </div>
  );
}

function ContactTable({
  rows,
}: {
  rows: { role: string; name: string; phone: string; email: string }[];
}) {
  return (
    <div className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
      <div className="grid grid-cols-[1fr_1fr_1fr_1.2fr] gap-0 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide bg-gray-50 dark:bg-gray-800 px-4 py-2">
        <span>Role</span>
        <span>Name</span>
        <span>Phone</span>
        <span>Email</span>
      </div>
      {rows.map((r, i) => (
        <div
          key={i}
          className={`grid grid-cols-[1fr_1fr_1fr_1.2fr] gap-0 px-4 py-2.5 text-sm ${
            i % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50/50 dark:bg-gray-800/50"
          }`}
        >
          <span className="text-gray-600 dark:text-gray-400 font-medium">{r.role}</span>
          <span className="text-gray-800 dark:text-gray-200">{r.name}</span>
          <span className="text-gray-500 dark:text-gray-400 text-xs">{r.phone}</span>
          <span className="text-gray-500 dark:text-gray-400 text-xs truncate">{r.email}</span>
        </div>
      ))}
    </div>
  );
}

// Crew/talent table with columns Role, Name, Phone, Email (+ Call). Phone/email
// redacted to "C/O Outlander" on the client version.
function CrewTable({
  crew,
  redacted,
  careOf,
}: {
  crew: CrewMember[];
  redacted: boolean;
  careOf: string;
}) {
  return (
    <div className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
      <div className="grid grid-cols-[1fr_1fr_70px_1fr_1.2fr] gap-0 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide bg-gray-50 dark:bg-gray-800 px-4 py-2">
        <span>Role</span>
        <span>Name</span>
        <span>Call</span>
        <span>Phone</span>
        <span>Email</span>
      </div>
      {crew.map((p, i) => (
        <div
          key={i}
          className={`grid grid-cols-[1fr_1fr_70px_1fr_1.2fr] gap-0 px-4 py-2.5 text-sm ${
            i % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50/50 dark:bg-gray-800/50"
          }`}
        >
          <span className="text-gray-600 dark:text-gray-400 font-medium">{p.role}</span>
          <span className="text-gray-800 dark:text-gray-200">{p.name}</span>
          <span className="text-[#ff4444] font-mono text-xs">{p.callTime}</span>
          <span className="text-gray-500 dark:text-gray-400 text-xs">{redacted ? careOf : p.phone}</span>
          <span className="text-gray-500 dark:text-gray-400 text-xs truncate">{redacted ? "" : p.email}</span>
        </div>
      ))}
    </div>
  );
}
