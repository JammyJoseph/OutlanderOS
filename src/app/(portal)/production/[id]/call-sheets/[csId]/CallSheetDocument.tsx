import { format } from "date-fns";
import type {
  AgencyTeamMember, Attachment, CallSheetHeader, CallSheetLocation, CallTimeRow,
  CateringDetails, ClientTeamMember, CrewMember, EquipmentInfo, LocationData,
  MovementOrder, ProductionCompanyInfo, ProductionMobile, ScheduleItem,
  SectionKey, Shot, ShotStyle, TalentMember, WeatherData,
} from "./types";
import { CONDUCT_POLICY, CONFIDENTIALITY_NOTICE, emptyCallSheetLocation } from "./types";
import {
  computeRouteLegs, journeyStats, formatJourneySummary, formatDistance, formatDuration,
} from "@/lib/route-utils";

// ─────────────────────────────────────────────────────────────────────────────
// Printable / shareable call sheet — clean, one-page, industry-standard layout.
//
// This is the OUTPUT format seen on the public share links and in the PDF/print
// download. It is deliberately print-first: pure HTML with inline styles, always
// white background with black text (dark/light mode is irrelevant for print),
// system fonts, and minimal horizontal rules instead of cards, colours, badges,
// maps or icons. The interactive editor is a separate concern and unchanged.
// ─────────────────────────────────────────────────────────────────────────────

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
const INK = "#000";
const HAIR = "#cfcfcf"; // hairline rule between rows
const MUTED = "#555";

// ── Base styles (inline, so they survive print with no dependency on Tailwind) ──
const docStyle: React.CSSProperties = {
  background: "#fff",
  color: INK,
  fontFamily: 'Arial, "Helvetica Neue", Helvetica, sans-serif',
  fontSize: "10px",
  lineHeight: 1.4,
  maxWidth: "820px",
  margin: "0 auto",
  padding: "4px 2px 24px",
  WebkitPrintColorAdjust: "exact",
  printColorAdjust: "exact",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 700,
  letterSpacing: "0.11em",
  textTransform: "uppercase",
  margin: "0 0 5px",
  paddingBottom: "3px",
  borderBottom: `1.5px solid ${INK}`,
  breakAfter: "avoid",
  breakInside: "avoid",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  tableLayout: "fixed",
};

const cellStyle: React.CSSProperties = {
  padding: "3px 10px 3px 0",
  borderBottom: `1px solid ${HAIR}`,
  textAlign: "left",
  verticalAlign: "top",
  wordBreak: "break-word",
};

const thStyle: React.CSSProperties = {
  padding: "2px 10px 3px 0",
  borderBottom: `1px solid ${INK}`,
  textAlign: "left",
  verticalAlign: "bottom",
  fontSize: "7.5px",
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: INK,
  whiteSpace: "nowrap",
};

const labelCellStyle: React.CSSProperties = {
  ...cellStyle,
  width: "150px",
  fontSize: "7.5px",
  fontWeight: 700,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  paddingRight: "12px",
  whiteSpace: "nowrap",
};

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

  const companyName = (
    productionCompany.name || header.productionCompany || "Outlander"
  ).trim();
  const careOf = `C/O ${companyName.toUpperCase()}`;

  const formattedDate = shootDate
    ? format(new Date(shootDate + "T12:00:00"), "EEEE d MMMM yyyy")
    : "";
  const jobNumber = header.jobNumber?.trim();

  // Ordered location stops. Prefer the multi-location array; fall back to the
  // legacy single location so pre-upgrade sheets still render.
  const hasLegacyLocation =
    !!(location.address || location.parkingNotes || location.nearestHospital ||
      location.whatThreeWords || location.nearestStation) || locationLat != null;
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
    locations && locations.length > 0 ? locations : hasLegacyLocation ? [legacyStop] : [];

  const rosterCount = crew.length + talent.length;
  const nearestAE =
    stops.map((s) => s.nearestAE).find((v) => v && v.trim()) ||
    location.nearestHospital ||
    "";

  // ── Derived overview / main-call line ──
  const mainCall: string[] = [];
  if (callTime) mainCall.push(`${callTime} call`);
  if (wrapTime) mainCall.push(`${wrapTime} wrap`);

  const hasCatering =
    !!(catering.provider || catering.providerContact || catering.breakfast ||
      catering.lunch || catering.snacks || catering.notes) ||
    catering.dietary.length > 0;
  const hasMovement =
    !!(movementOrder.siteEntrance || movementOrder.techParking ||
      movementOrder.crewParking || movementOrder.routeNotes);
  const hasEquipment = !!(
    equipment.cameraSupplier || equipment.lightingSupplier || equipment.soundSupplier ||
    equipment.gripSupplier || equipment.dataSupplier || equipment.otherNotes ||
    (equipment.kitList && equipment.kitList.length > 0)
  );
  const hasShotStyle = !!(shotStyle && (shotStyle.tone || shotStyle.visualDevice || shotStyle.notes));

  return (
    <div style={docStyle}>
      {/* ── Header ── */}
      <header
        style={{
          borderBottom: `3px solid ${INK}`,
          paddingBottom: "8px",
          marginBottom: "4px",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.34em",
            textTransform: "uppercase",
          }}
        >
          {companyName}
        </div>
        <h1
          style={{
            fontSize: "20px",
            fontWeight: 700,
            letterSpacing: "0.01em",
            textTransform: "uppercase",
            margin: "6px 0 4px",
            lineHeight: 1.15,
          }}
        >
          {shootTitle || "Call Sheet"}
        </h1>
        <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
          {formattedDate ? `${formattedDate} — ` : ""}Call Sheet{redacted ? " · Client Copy" : ""}
        </div>
      </header>

      {/* ── 1. Production overview ── */}
      <Section title="Production Overview">
        <DefTable
          rows={[
            clientName ? ["Client", clientName] : null,
            (shootTitle || data.productionTitle)
              ? ["Title", shootTitle || data.productionTitle || ""]
              : null,
            jobNumber ? ["Job Number", jobNumber] : null,
            formattedDate ? ["Shoot Date", formattedDate] : null,
            mainCall.length ? ["Main Call", mainCall.join(" · ")] : null,
          ]}
        />
      </Section>

      {/* ── 2. Production company ── */}
      {show("productionCompany") &&
        (productionCompany.name || productionCompany.address ||
          productionCompany.execProducer || productionCompany.producer) && (
          <Section title="Production Company">
            <DefTable
              rows={[
                (productionCompany.name || productionCompany.address)
                  ? [
                      "Company",
                      [productionCompany.name, productionCompany.address]
                        .filter(Boolean)
                        .join(", "),
                    ]
                  : null,
                productionCompany.execProducer
                  ? ["Executive Producer", productionCompany.execProducer]
                  : null,
                productionCompany.producer ? ["Producer", productionCompany.producer] : null,
              ]}
            />
          </Section>
        )}

      {/* ── Client team ── */}
      {show("header") && clientTeam.some((c) => c.role || c.name) && (
        <Section title="Client Team">
          <DefTable
            rows={clientTeam
              .filter((c) => c.role || c.name)
              .map((c) => [c.role || "—", c.name] as [string, string])}
          />
        </Section>
      )}

      {/* ── Agency / creative team ── */}
      {show("agencyTeam") && agencyTeam.some((a) => a.role || a.name) && (
        <Section title="Agency / Creative">
          <GridTable
            columns={[
              { label: "Role", width: "26%" },
              { label: "Name", width: "26%" },
              { label: "Contact", width: "48%" },
            ]}
            rows={agencyTeam
              .filter((a) => a.role || a.name)
              .map((a) => [
                a.role,
                a.name,
                redacted ? REDACTED : contactLine(a.phone, a.email),
              ])}
          />
        </Section>
      )}

      {/* ── Production mobiles ── */}
      {show("productionMobiles") && productionMobiles.some((m) => m.role || m.name) && (
        <Section title="Production Mobiles">
          <GridTable
            columns={[
              { label: "Role", width: "30%" },
              { label: "Name", width: "34%" },
              { label: "Phone", width: "36%" },
            ]}
            rows={productionMobiles
              .filter((m) => m.role || m.name)
              .map((m) => [m.role, m.name, redacted ? REDACTED : m.phone])}
          />
        </Section>
      )}

      {/* ── Talent ── */}
      {show("talent") && talent.some((t) => t.role || t.name) && (
        <Section title="Talent">
          <GridTable
            columns={[
              { label: "Name", width: "34%" },
              { label: "Role", width: "30%" },
              { label: "Call", width: "16%" },
              { label: "Contact", width: "20%" },
            ]}
            rows={talent
              .filter((t) => t.role || t.name)
              .map((t) => [t.name, t.role, t.callTime, contactLine(t.phone, t.email)])}
          />
        </Section>
      )}

      {/* ── 3. Call times ── */}
      {show("callTimes") && callTimes.some((c) => c.time || c.department) && (
        <Section title="Call Times">
          <GridTable
            columns={[
              { label: "Time", width: "18%", nowrap: true },
              { label: "Call", width: "82%" },
            ]}
            rows={callTimes
              .filter((c) => c.time || c.department)
              .map((c) => [c.time, c.department])}
          />
        </Section>
      )}

      {/* ── 4. Schedule ── */}
      {show("schedule") && schedule.some((s) => s.time || s.description) && (
        <Section title="Schedule">
          <GridTable
            columns={[
              { label: "Time", width: "14%", nowrap: true },
              { label: "Move / Location", width: "44%" },
              { label: "Notes", width: "42%" },
            ]}
            rows={schedule
              .filter((s) => s.time || s.description)
              .map((s) => [s.time, s.description, s.notes])}
          />
        </Section>
      )}

      {/* ── 5. Locations / movement order ── */}
      {show("location") && (stops.length > 0 || hasMovement) && (
        <Section title={stops.length > 1 ? "Locations / Movement Order" : "Location"}>
          {stops.length > 0 && (
            <LocationsTable stops={stops} />
          )}
          {(() => {
            const stats = journeyStats(stops);
            if (!(stops.length >= 2 && stats.totalKm > 0)) return null;
            return (
              <p style={{ margin: "5px 0 0", fontSize: "9px", color: MUTED }}>
                {formatJourneySummary(stats)}
              </p>
            );
          })()}
          {location.safetyNotes && (
            <p style={{ margin: "6px 0 0", fontWeight: 700 }}>NB: {location.safetyNotes}</p>
          )}
          {hasMovement && (
            <div style={{ marginTop: "6px" }}>
              <DefTable
                rows={[
                  movementOrder.siteEntrance ? ["Site Entrance", movementOrder.siteEntrance] : null,
                  movementOrder.techParking ? ["Tech Parking", movementOrder.techParking] : null,
                  movementOrder.crewParking ? ["Crew Parking", movementOrder.crewParking] : null,
                  movementOrder.routeNotes ? ["Route Notes", movementOrder.routeNotes] : null,
                ]}
              />
            </div>
          )}
        </Section>
      )}

      {/* ── 6. Weather / welfare ── */}
      {show("weather") && (weatherData?.forecast?.length || nearestAE) && (
        <Section title="Weather / Welfare">
          <DefTable
            rows={[
              weatherData?.forecast?.length
                ? ["Forecast", weatherLine(weatherData, shootDate)]
                : null,
              (() => {
                const w = welfareLine(weatherData, notesSafety);
                return w ? ["Welfare", w] : null;
              })(),
              nearestAE ? ["Nearest A&E", nearestAE] : null,
            ]}
          />
        </Section>
      )}

      {/* ── Shotlist ── */}
      {show("shotlist") && (shotlist.some((s) => s.description || s.scene) || hasShotStyle) && (
        <Section title="Shotlist">
          {hasShotStyle && (
            <p style={{ margin: "0 0 5px", fontSize: "9px", color: MUTED }}>
              {[shotStyle.tone, shotStyle.visualDevice, shotStyle.notes].filter(Boolean).join(" · ")}
            </p>
          )}
          {shotlist.some((s) => s.description || s.scene) && (
            <GridTable
              columns={[
                { label: "#", width: "6%", nowrap: true },
                { label: "Shot / Scene", width: "54%" },
                { label: "Notes", width: "40%" },
              ]}
              rows={shotlist
                .filter((s) => s.description || s.scene)
                .map((s, i) => [
                  s.shotNumber || String(i + 1),
                  s.description || s.scene || "",
                  [s.video, s.stills, s.dialogue, s.setup].filter(Boolean).join(" · "),
                ])}
            />
          )}
        </Section>
      )}

      {/* ── 7. Deliverables ── */}
      {show("deliverables") && (deliverables?.length ?? 0) > 0 && (
        <Section title="Deliverables">
          <GridTable
            columns={[
              { label: "Type", width: "16%", nowrap: true },
              { label: "Deliverable", width: "40%" },
              { label: "Notes", width: "44%" },
            ]}
            rows={deliverables!.map((d) => [
              (d.type || "").toUpperCase(),
              d.title,
              d.notes || "",
            ])}
          />
        </Section>
      )}

      {/* ── Crew (unit list) ── */}
      {show("crew") && crew.some((c) => c.role || c.name) && (
        <Section title="Crew / Unit List">
          <GridTable
            columns={[
              { label: "Role", width: "28%" },
              { label: "Name", width: "26%" },
              { label: "Call", width: "12%", nowrap: true },
              { label: "Contact", width: "34%" },
            ]}
            rows={crew
              .filter((c) => c.role || c.name)
              .map((c) => [
                c.role,
                c.name,
                c.callTime,
                redacted ? careOf : contactLine(c.phone, c.email),
              ])}
          />
        </Section>
      )}

      {/* ── Catering ── */}
      {show("catering") && hasCatering && (
        <Section title="Catering">
          <DefTable
            rows={[
              catering.provider || catering.providerContact
                ? ["Provider", [catering.provider, catering.providerContact].filter(Boolean).join(" · ")]
                : null,
              ["Headcount", catering.headcountOverride || String(rosterCount)],
              catering.breakfast ? ["Breakfast", catering.breakfast] : null,
              catering.lunch ? ["Lunch", catering.lunch] : null,
              catering.snacks ? ["Snacks", catering.snacks] : null,
              catering.dietary.length
                ? [
                    "Dietary",
                    catering.dietary
                      .filter((d) => d.name || d.requirement)
                      .map((d) => [d.name, d.requirement].filter(Boolean).join(": "))
                      .join("; "),
                  ]
                : null,
              catering.notes ? ["Notes", catering.notes] : null,
            ]}
          />
        </Section>
      )}

      {/* ── Equipment ── */}
      {show("equipment") && hasEquipment && (
        <Section title="Equipment">
          <DefTable
            rows={(
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
              return [
                label,
                [eq[sKey], eq[cKey], redacted ? "" : eq[eKey]].filter(Boolean).join(" · "),
              ] as [string, string];
            })}
          />
          {equipment.kitList && equipment.kitList.length > 0 && (
            <p style={{ margin: "5px 0 0" }}>
              <span style={{ fontSize: "7.5px", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                Kit List:{" "}
              </span>
              {equipment.kitList.join(", ")}
            </p>
          )}
          {equipment.otherNotes && (
            <p style={{ margin: "4px 0 0", whiteSpace: "pre-wrap" }}>{equipment.otherNotes}</p>
          )}
        </Section>
      )}

      {/* ── Documents ── */}
      {show("documents") && documents.some((d) => d.title || d.url) && (
        <Section title="Documents">
          <DefTable
            rows={documents
              .filter((d) => d.title || d.url)
              .map((d) => [d.title || "Document", d.url] as [string, string])}
          />
        </Section>
      )}

      {/* ── Notes ── */}
      {show("notes") && (notesGeneral || notesSafety || notesParking) && (
        <Section title="Notes">
          <DefTable
            rows={[
              notesGeneral ? ["Production", notesGeneral] : null,
              notesSafety ? ["Safety", notesSafety] : null,
              notesParking ? ["Parking", notesParking] : null,
            ]}
          />
        </Section>
      )}

      {/* ── Footer: confidentiality / conduct / credit (8pt) ── */}
      <footer
        style={{
          marginTop: "18px",
          paddingTop: "8px",
          borderTop: `1px solid ${INK}`,
          fontSize: "8px",
          lineHeight: 1.45,
          color: MUTED,
        }}
      >
        {show("confidentiality") && (
          <p style={{ margin: "0 0 6px" }}>
            <strong style={{ color: INK }}>Confidentiality. </strong>
            {CONFIDENTIALITY_NOTICE}
          </p>
        )}
        {show("conduct") && (
          <p style={{ margin: "0 0 6px" }}>
            <strong style={{ color: INK }}>Health, Safety &amp; Conduct. </strong>
            {CONDUCT_POLICY}
          </p>
        )}
        <p style={{ margin: 0 }}>
          <strong style={{ color: INK }}>Credit. </strong>
          All imagery and footage produced on this shoot remains the property of{" "}
          {companyName} and its client. Do not use, publish or distribute without prior
          written approval and correct credit.
        </p>
      </footer>
    </div>
  );
}

// ── Reusable primitives ──────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: "14px" }}>
      <h2 style={sectionTitleStyle}>{title}</h2>
      {children}
    </section>
  );
}

// Two-column label/value table. Rows may be null to skip empty entries.
function DefTable({ rows }: { rows: ([string, React.ReactNode] | null)[] }) {
  const visible = rows.filter((r): r is [string, React.ReactNode] => r != null);
  if (visible.length === 0) return null;
  return (
    <table style={tableStyle}>
      <colgroup>
        <col style={{ width: "150px" }} />
        <col />
      </colgroup>
      <tbody>
        {visible.map(([label, value], i) => (
          <tr key={i}>
            <td style={labelCellStyle}>{label}</td>
            <td style={{ ...cellStyle, whiteSpace: "pre-wrap" }}>{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface Column {
  label: string;
  width: string;
  nowrap?: boolean;
}

// Column table with a ruled header row and hairline rows. Empty cells render "—".
function GridTable({
  columns,
  rows,
}: {
  columns: Column[];
  rows: React.ReactNode[][];
}) {
  if (rows.length === 0) return null;
  return (
    <table style={tableStyle}>
      <colgroup>
        {columns.map((c, i) => (
          <col key={i} style={{ width: c.width }} />
        ))}
      </colgroup>
      <thead>
        <tr>
          {columns.map((c, i) => (
            <th key={i} style={thStyle}>
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={ri}>
            {row.map((cell, ci) => (
              <td
                key={ci}
                style={{
                  ...cellStyle,
                  whiteSpace: columns[ci]?.nowrap ? "nowrap" : "normal",
                }}
              >
                {cell === "" || cell == null ? "—" : cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Formatting helpers ───────────────────────────────────────────────────────

function contactLine(phone?: string, email?: string): string {
  return [phone, email].filter(Boolean).join(" · ");
}

// One-line forecast for the shoot day, e.g.
// "Clear sky. Up to 33°C, low 21°C. Wind 8 mph. UV max 9."
function weatherLine(weather: WeatherData, shootDate: string): string {
  const day =
    weather.forecast.find((f) => f.date === shootDate) || weather.forecast[0];
  if (!day) return "";
  const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
  const parts: string[] = [];
  const desc = cap(day.description || day.condition || "");
  if (desc) parts.push(`${desc}.`);
  if (Number.isFinite(day.tempMax)) {
    parts.push(
      `Up to ${Math.round(day.tempMax)}°C${
        Number.isFinite(day.tempMin) ? `, low ${Math.round(day.tempMin)}°C` : ""
      }.`
    );
  }
  if (Number.isFinite(day.wind)) parts.push(`Wind ${Math.round(day.wind)} mph.`);
  if (weather.sun && Number.isFinite(weather.sun.uvIndex) && weather.sun.uvIndex > 0) {
    parts.push(`UV max ${Math.round(weather.sun.uvIndex)}.`);
  }
  const warnings = (weather.warnings || []).map((w) => w.label).filter(Boolean);
  if (warnings.length) parts.push(warnings.join(" "));
  return parts.join(" ");
}

// Welfare guidance derived from weather warnings, plus any manual safety note.
function welfareLine(weather: WeatherData | null, safetyNote: string): string {
  const tips: string[] = [];
  for (const w of weather?.warnings || []) {
    if (w.kind === "heat") tips.push("Bring water, rotate shade breaks, minimise kit weight.");
    else if (w.kind === "rain") tips.push("Bring wet-weather cover for crew and kit.");
    else if (w.kind === "cold") tips.push("Layer up; warm base and hot drinks on standby.");
    else if (w.kind === "wind") tips.push("Secure stands, flags and lightweight kit.");
  }
  const note = (safetyNote || "").trim();
  if (note) tips.push(note);
  // De-duplicate while preserving order.
  return Array.from(new Set(tips)).join(" ");
}

// Locations table: # | Location | Address / Notes, with travel legs interleaved.
function LocationsTable({ stops }: { stops: CallSheetLocation[] }) {
  const legs = computeRouteLegs(stops);
  const multi = stops.length > 1;
  return (
    <table style={tableStyle}>
      <colgroup>
        <col style={{ width: "6%" }} />
        <col style={{ width: "30%" }} />
        <col style={{ width: "64%" }} />
      </colgroup>
      <thead>
        <tr>
          <th style={thStyle}>#</th>
          <th style={thStyle}>Location</th>
          <th style={thStyle}>Address / Notes</th>
        </tr>
      </thead>
      <tbody>
        {stops.map((loc, i) => {
          const detail = [
            loc.address,
            loc.postcode,
            loc.whatThreeWords ? `w3w: ${loc.whatThreeWords}` : "",
            loc.contactPerson ? `Contact: ${loc.contactPerson}` : "",
            loc.parkingNotes ? `Parking: ${loc.parkingNotes}` : "",
            loc.nearestAE ? `A&E: ${loc.nearestAE}` : "",
          ]
            .filter(Boolean)
            .join(" · ");
          const leg = legs[i];
          return (
            <tr key={i}>
              <td style={{ ...cellStyle, whiteSpace: "nowrap" }}>{i + 1}</td>
              <td style={cellStyle}>{loc.name || `Location ${i + 1}`}</td>
              <td style={cellStyle}>
                {detail || "—"}
                {multi && i < stops.length - 1 && leg && (
                  <span style={{ display: "block", marginTop: "2px", color: MUTED }}>
                    → {formatDistance(leg.distanceKm)} · {formatDuration(leg.driveMins)} drive to next stop
                  </span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
