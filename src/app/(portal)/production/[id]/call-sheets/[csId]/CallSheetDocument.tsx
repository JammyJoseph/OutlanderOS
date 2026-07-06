"use client";

import { useState } from "react";
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
  parseTime, googleMapsSearchUrl, wazeUrl, buildGoogleMapsRouteUrl, buildGpx,
  downloadTextFile,
} from "@/lib/route-utils";

// ─────────────────────────────────────────────────────────────────────────────
// Printable / shareable call sheet — dark, editorial, one-page layout.
//
// This is the OUTPUT format seen on the public share links and in the PDF/print
// download. It renders on a near-black background with white text, a serif
// display hero, prominent call-time boxes, and letter-spaced section headers.
// Colours are baked into inline styles with print-color-adjust so the dark
// theme survives print/PDF. Interactive CTAs (Confirm receipt, Maps / Waze,
// Download route, Call / Email) are screen-only and hidden in print via the
// `cs-noprint` class + the scoped <style> block below. The interactive editor
// is a separate concern and unchanged.
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

// ── Dark palette ──
const BG = "#0a0a0a";
const TEXT = "#f4f4f4";
const MUTED = "#8b8b8b"; // labels / secondary
const FAINT = "#6a6a6a"; // footer / tertiary
const HAIR = "rgba(255,255,255,0.11)"; // hairline between rows
const RULE = "rgba(255,255,255,0.22)"; // section-header underline
const BOXBORDER = "rgba(255,255,255,0.16)";
const GOLD = "#e6b84c"; // Outlander accent

const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const SERIF = 'Georgia, "Times New Roman", "Iowan Old Style", serif';

// ── Base styles (inline, so they survive print with no dependency on Tailwind) ──
const docStyle: React.CSSProperties = {
  background: BG,
  color: TEXT,
  fontFamily: SANS,
  fontSize: "11px",
  lineHeight: 1.5,
  maxWidth: "860px",
  margin: "0 auto",
  padding: "0 0 40px",
  WebkitPrintColorAdjust: "exact",
  printColorAdjust: "exact",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 700,
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: TEXT,
  margin: "0 0 12px",
  paddingBottom: "8px",
  borderBottom: `1px solid ${RULE}`,
  breakAfter: "avoid",
  breakInside: "avoid",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  tableLayout: "fixed",
};

const cellStyle: React.CSSProperties = {
  padding: "7px 12px 7px 0",
  borderBottom: `1px solid ${HAIR}`,
  textAlign: "left",
  verticalAlign: "top",
  wordBreak: "break-word",
  color: TEXT,
};

const thStyle: React.CSSProperties = {
  padding: "0 12px 7px 0",
  borderBottom: `1px solid ${RULE}`,
  textAlign: "left",
  verticalAlign: "bottom",
  fontSize: "8px",
  fontWeight: 700,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: MUTED,
  whiteSpace: "nowrap",
};

const labelCellStyle: React.CSSProperties = {
  ...cellStyle,
  width: "150px",
  fontSize: "8px",
  fontWeight: 700,
  letterSpacing: "0.13em",
  textTransform: "uppercase",
  color: MUTED,
  paddingRight: "14px",
  whiteSpace: "nowrap",
};

const padX: React.CSSProperties = { paddingLeft: "40px", paddingRight: "40px" };

// Subtle screen-only pill button (Maps / Waze / Call / Email / Download).
const pillStyle: React.CSSProperties = {
  display: "inline-block",
  fontFamily: SANS,
  fontSize: "9px",
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: MUTED,
  textDecoration: "none",
  border: `1px solid ${BOXBORDER}`,
  borderRadius: "999px",
  padding: "3px 11px",
  background: "transparent",
  cursor: "pointer",
  lineHeight: 1.4,
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

  const [receiptConfirmed, setReceiptConfirmed] = useState(false);

  // Default every section visible unless an explicit toggle map says otherwise.
  const show = (k: SectionKey) => (sections ? sections[k] !== false : true);

  const companyName = (
    productionCompany.name || header.productionCompany || "Outlander"
  ).trim();
  const careOf = `C/O ${companyName.toUpperCase()}`;

  const formattedDate = shootDate
    ? format(new Date(shootDate + "T12:00:00"), "EEEE d MMMM yyyy")
    : "";
  const shortDate = shootDate
    ? format(new Date(shootDate + "T12:00:00"), "EEE d MMM yyyy")
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

  // ── Derived call-time boxes (Crew Call / Talent Call / Wrap) ──
  const crewCall = callTime || earliestTime(crew);
  const t0 = talent.find((t) => (t.name || "").trim() || t.callTime);
  const talentCall = earliestTime(talent);
  const boxes: { value: string; label: string; sub?: string }[] = [];
  boxes.push({ value: crewCall || "TBC", label: "Crew Call" });
  if (talentCall || t0)
    boxes.push({
      value: talentCall || "TBC",
      label: "Talent Call",
      sub: t0?.name ? t0.name : undefined,
    });
  boxes.push({ value: wrapTime || "TBC", label: "Wrap" });

  // Hero subtitle location: first named stop, else its city-ish address tail.
  const heroPlace =
    (stops[0]?.name || "").trim() ||
    (stops[0]?.address || location.address || "").split(",").pop()?.trim() ||
    "";

  // ── Production overview: right-hand key people (with quick-contact links) ──
  const creative = agencyTeam.find((a) => (a.name || "").trim());
  const people: { label: string; name: string; phone?: string; email?: string }[] = [];
  if (productionCompany.execProducer)
    people.push({ label: "Exec Producer", name: productionCompany.execProducer });
  if (productionCompany.producer)
    people.push({ label: "Producer", name: productionCompany.producer });
  if (creative)
    people.push({
      label: creative.role || "Creative",
      name: creative.name,
      phone: creative.phone,
      email: creative.email,
    });
  if (t0?.name)
    people.push({ label: "Talent", name: t0.name, phone: t0.phone, email: t0.email });

  const facts: [string, string][] = [];
  if (clientName) facts.push(["Client", clientName]);
  if (jobNumber) facts.push(["Job Number", jobNumber]);
  if (formattedDate) facts.push(["Shoot Date", formattedDate]);
  facts.push(["Production Co.", companyName]);

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

  const clientLabel = clientName ? clientName.toUpperCase() : "";
  const routeUrl = buildGoogleMapsRouteUrl(stops);

  return (
    <div className="cs-doc" style={docStyle}>
      {/* Scoped print + reset rules. Keeps the dark theme in print and hides the
          screen-only CTAs. */}
      <style>{`
        @media print {
          .cs-noprint { display: none !important; }
          body:has(.cs-doc) { background: ${BG} !important; }
          @page { margin: 8mm; }
        }
        .cs-doc a { color: inherit; }
      `}</style>

      {/* ── Top bar ── */}
      <div
        className="cs-topbar"
        style={{
          ...padX,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          padding: "16px 40px",
          borderBottom: `1px solid ${HAIR}`,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
          <span
            style={{
              fontFamily: SERIF,
              fontSize: "18px",
              fontWeight: 700,
              color: TEXT,
              letterSpacing: "-0.01em",
            }}
          >
            O<span style={{ color: GOLD }}>.</span>
          </span>
          <span
            style={{
              fontSize: "9px",
              fontWeight: 700,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: MUTED,
            }}
          >
            Outlander Studios{clientLabel ? ` × ${clientLabel}` : ""}
          </span>
        </div>
        <span
          style={{
            fontSize: "9px",
            fontWeight: 700,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: MUTED,
            whiteSpace: "nowrap",
          }}
        >
          Call Sheet{shortDate ? ` · ${shortDate}` : ""}
        </span>
      </div>

      {/* ── Hero ── */}
      <div style={{ ...padX, paddingTop: "40px", paddingBottom: "34px" }}>
        <div
          style={{
            fontSize: "9px",
            fontWeight: 700,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: GOLD,
            marginBottom: "16px",
          }}
        >
          Call Sheet{redacted ? " — Client Copy" : ""}
        </div>
        <h1
          style={{
            fontFamily: SERIF,
            fontSize: "44px",
            fontWeight: 600,
            lineHeight: 1.08,
            letterSpacing: "-0.015em",
            color: TEXT,
            margin: "0 0 14px",
          }}
        >
          {shootTitle || data.productionTitle || "Call Sheet"}
        </h1>
        {(formattedDate || heroPlace) && (
          <p
            style={{
              fontFamily: SERIF,
              fontStyle: "italic",
              fontSize: "16px",
              color: MUTED,
              margin: 0,
            }}
          >
            {[formattedDate, heroPlace].filter(Boolean).join(" — ")}.
          </p>
        )}
        {!redacted && (
          <div className="cs-noprint" style={{ marginTop: "22px" }}>
            <button
              type="button"
              onClick={() => setReceiptConfirmed(true)}
              disabled={receiptConfirmed}
              style={{
                ...pillStyle,
                fontSize: "10px",
                padding: "8px 18px",
                color: receiptConfirmed ? "#0a0a0a" : TEXT,
                borderColor: receiptConfirmed ? GOLD : RULE,
                background: receiptConfirmed ? GOLD : "transparent",
                cursor: receiptConfirmed ? "default" : "pointer",
              }}
            >
              {receiptConfirmed ? "✓ Receipt confirmed" : "Confirm receipt"}
            </button>
          </div>
        )}
      </div>

      {/* ── Call-time boxes ── */}
      <div style={{ ...padX, marginBottom: "10px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${boxes.length}, 1fr)`,
            border: `1px solid ${BOXBORDER}`,
          }}
        >
          {boxes.map((b, i) => (
            <div
              key={i}
              style={{
                padding: "18px 20px",
                borderLeft: i === 0 ? "none" : `1px solid ${BOXBORDER}`,
              }}
            >
              <div
                style={{
                  fontFamily: SERIF,
                  fontSize: "32px",
                  fontWeight: 600,
                  lineHeight: 1,
                  color: TEXT,
                  letterSpacing: "-0.01em",
                }}
              >
                {b.value}
              </div>
              <div
                style={{
                  fontSize: "8px",
                  fontWeight: 700,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: MUTED,
                  marginTop: "9px",
                }}
              >
                {b.label}
                {b.sub ? ` — ${b.sub}` : ""}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ ...padX, paddingTop: "12px" }}>
        {/* ── Production overview (facts + key people) ── */}
        <Section title="Production Overview">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "0 40px",
            }}
          >
            <div>
              {facts.map(([label, value], i) => (
                <OverviewRow key={i} label={label} value={value} />
              ))}
            </div>
            <div>
              {people.length === 0 ? (
                <OverviewRow label="Production" value={companyName} />
              ) : (
                people.map((p, i) => (
                  <OverviewRow
                    key={i}
                    label={p.label}
                    value={p.name}
                    contact={
                      !redacted ? <QuickLinks phone={p.phone} email={p.email} /> : undefined
                    }
                  />
                ))
              )}
            </div>
          </div>
        </Section>

        {/* ── Production company ── */}
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
                .map((c) => [c.role || "—", c.name] as [string, React.ReactNode])}
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
                  redacted ? REDACTED : (
                    <ContactCell phone={a.phone} email={a.email} />
                  ),
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
                .map((m) => [
                  m.role,
                  m.name,
                  redacted ? REDACTED : <ContactCell phone={m.phone} />,
                ])}
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
                { label: "Call", width: "16%", nowrap: true },
                { label: "Contact", width: "20%" },
              ]}
              rows={talent
                .filter((t) => t.role || t.name)
                .map((t) => [
                  t.name,
                  t.role,
                  t.callTime,
                  redacted ? REDACTED : <ContactCell phone={t.phone} email={t.email} />,
                ])}
            />
          </Section>
        )}

        {/* ── Call times ── */}
        {show("callTimes") && callTimes.some((c) => c.time || c.department) && (
          <Section title="Call Times">
            <GridTable
              columns={[
                { label: "Time", width: "18%", nowrap: true },
                { label: "Call", width: "82%" },
              ]}
              rows={callTimes
                .filter((c) => c.time || c.department)
                .map((c) => [<Bold key="t">{c.time}</Bold>, c.department])}
            />
          </Section>
        )}

        {/* ── Schedule ── */}
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
                .map((s) => [<Bold key="t">{s.time}</Bold>, s.description, s.notes])}
            />
          </Section>
        )}

        {/* ── Locations / movement order ── */}
        {show("location") && (stops.length > 0 || hasMovement) && (
          <Section
            title={stops.length > 1 ? "Locations / Movement Order" : "Location"}
            action={
              routeUrl ? (
                <span className="cs-noprint" style={{ display: "inline-flex", gap: "6px" }}>
                  <a href={routeUrl} target="_blank" rel="noopener noreferrer" style={pillStyle}>
                    Open route
                  </a>
                  <button
                    type="button"
                    style={pillStyle}
                    onClick={() =>
                      downloadTextFile(
                        "shoot-route.gpx",
                        buildGpx(stops, shootTitle || "Shoot route"),
                        "application/gpx+xml"
                      )
                    }
                  >
                    Download route
                  </button>
                </span>
              ) : undefined
            }
          >
            {stops.length > 0 && <LocationsTable stops={stops} />}
            {(() => {
              const stats = journeyStats(stops);
              if (!(stops.length >= 2 && stats.totalKm > 0)) return null;
              return (
                <p style={{ margin: "10px 0 0", fontSize: "10px", color: MUTED }}>
                  {formatJourneySummary(stats)}
                </p>
              );
            })()}
            {location.safetyNotes && (
              <p style={{ margin: "12px 0 0", fontWeight: 700, color: TEXT }}>
                NB: {location.safetyNotes}
              </p>
            )}
            {hasMovement && (
              <div style={{ marginTop: "12px" }}>
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

        {/* ── Weather / welfare ── */}
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
              <p style={{ margin: "0 0 10px", fontSize: "10px", color: MUTED }}>
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

        {/* ── Deliverables ── */}
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
                  redacted ? careOf : <ContactCell phone={c.phone} email={c.email} />,
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
                ] as [string, React.ReactNode];
              })}
            />
            {equipment.kitList && equipment.kitList.length > 0 && (
              <p style={{ margin: "10px 0 0", color: TEXT }}>
                <span style={{ fontSize: "8px", fontWeight: 700, letterSpacing: "0.13em", textTransform: "uppercase", color: MUTED }}>
                  Kit List:{" "}
                </span>
                {equipment.kitList.join(", ")}
              </p>
            )}
            {equipment.otherNotes && (
              <p style={{ margin: "8px 0 0", whiteSpace: "pre-wrap", color: TEXT }}>{equipment.otherNotes}</p>
            )}
          </Section>
        )}

        {/* ── Documents ── */}
        {show("documents") && documents.some((d) => d.title || d.url) && (
          <Section title="Documents">
            <DefTable
              rows={documents
                .filter((d) => d.title || d.url)
                .map((d) => [
                  d.title || "Document",
                  d.url ? (
                    <a href={d.url} target="_blank" rel="noopener noreferrer" style={{ color: GOLD, textDecoration: "none" }}>
                      {d.url}
                    </a>
                  ) : (
                    "—"
                  ),
                ] as [string, React.ReactNode])}
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

        {/* ── Confidentiality / conduct (fine print) ── */}
        {(show("confidentiality") || show("conduct")) && (
          <div
            style={{
              marginTop: "30px",
              paddingTop: "16px",
              borderTop: `1px solid ${HAIR}`,
              fontSize: "8.5px",
              lineHeight: 1.55,
              color: FAINT,
            }}
          >
            {show("confidentiality") && (
              <p style={{ margin: "0 0 8px" }}>
                <strong style={{ color: MUTED }}>Confidentiality. </strong>
                {CONFIDENTIALITY_NOTICE}
              </p>
            )}
            {show("conduct") && (
              <p style={{ margin: "0 0 8px" }}>
                <strong style={{ color: MUTED }}>Health, Safety &amp; Conduct. </strong>
                {CONDUCT_POLICY}
              </p>
            )}
            <p style={{ margin: 0 }}>
              <strong style={{ color: MUTED }}>Credit. </strong>
              All imagery and footage produced on this shoot remains the property of{" "}
              {companyName} and its client. Do not use, publish or distribute without prior
              written approval and correct credit.
            </p>
          </div>
        )}
      </div>

      {/* ── Footer bar ── */}
      <div
        style={{
          ...padX,
          marginTop: "28px",
          paddingTop: "16px",
          borderTop: `1px solid ${RULE}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          fontSize: "8px",
          fontWeight: 700,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: FAINT,
          flexWrap: "wrap",
        }}
      >
        <span>Private &amp; Confidential · © Outlander Magazine Ltd</span>
        <span>{jobNumber ? `Job ${jobNumber}` : companyName}</span>
      </div>
    </div>
  );
}

// ── Reusable primitives ──────────────────────────────────────────────────────

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginTop: "34px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: "12px",
        }}
      >
        <h2 style={{ ...sectionTitleStyle, flex: 1 }}>{title}</h2>
        {action && (
          <div style={{ paddingBottom: "8px", flexShrink: 0 }}>{action}</div>
        )}
      </div>
      {children}
    </section>
  );
}

function Bold({ children }: { children: React.ReactNode }) {
  return <span style={{ fontWeight: 700, color: TEXT }}>{children}</span>;
}

// A single label/value line in the two-column Production Overview.
function OverviewRow({
  label,
  value,
  contact,
}: {
  label: string;
  value: React.ReactNode;
  contact?: React.ReactNode;
}) {
  return (
    <div style={{ padding: "9px 0", borderBottom: `1px solid ${HAIR}` }}>
      <div
        style={{
          fontSize: "8px",
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: MUTED,
          marginBottom: "3px",
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: "12px", color: TEXT, display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
        <span>{value || "—"}</span>
        {contact}
      </div>
    </div>
  );
}

// Screen-only Call / Email quick-action pills (tel: / mailto:).
function QuickLinks({ phone, email }: { phone?: string; email?: string }) {
  if (!phone && !email) return null;
  return (
    <span className="cs-noprint" style={{ display: "inline-flex", gap: "5px" }}>
      {phone && (
        <a href={`tel:${phone.replace(/\s+/g, "")}`} style={{ ...pillStyle, fontSize: "8px", padding: "1px 8px" }}>
          Call
        </a>
      )}
      {email && (
        <a href={`mailto:${email}`} style={{ ...pillStyle, fontSize: "8px", padding: "1px 8px" }}>
          Email
        </a>
      )}
    </span>
  );
}

// Contact cell for grid tables: prints as plain text, but on screen the phone /
// email become tap-to-call / tap-to-email links.
function ContactCell({ phone, email }: { phone?: string; email?: string }) {
  const parts: React.ReactNode[] = [];
  if (phone)
    parts.push(
      <a key="p" href={`tel:${phone.replace(/\s+/g, "")}`} style={{ color: TEXT, textDecoration: "none" }}>
        {phone}
      </a>
    );
  if (email)
    parts.push(
      <a key="e" href={`mailto:${email}`} style={{ color: TEXT, textDecoration: "none" }}>
        {email}
      </a>
    );
  if (parts.length === 0) return <>{"—"}</>;
  return (
    <>
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && <span style={{ color: FAINT }}> · </span>}
          {p}
        </span>
      ))}
    </>
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

// Earliest non-empty "HH:mm" call time across a roster, or "".
function earliestTime(rows: { callTime?: string }[]): string {
  let best: number | null = null;
  let bestStr = "";
  for (const r of rows) {
    const t = parseTime(r.callTime);
    if (t != null && (best == null || t < best)) {
      best = t;
      bestStr = (r.callTime || "").trim();
    }
  }
  return bestStr;
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

// Locations table: # | Location | Address / Notes, with travel legs interleaved
// and screen-only Maps / Waze deep-link pills per stop.
function LocationsTable({ stops }: { stops: CallSheetLocation[] }) {
  const legs = computeRouteLegs(stops);
  const multi = stops.length > 1;
  return (
    <table style={tableStyle}>
      <colgroup>
        <col style={{ width: "6%" }} />
        <col style={{ width: "28%" }} />
        <col style={{ width: "66%" }} />
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
          const gmaps = googleMapsSearchUrl(loc);
          const waze = wazeUrl(loc);
          return (
            <tr key={i}>
              <td style={{ ...cellStyle, whiteSpace: "nowrap", color: GOLD, fontWeight: 700 }}>{i + 1}</td>
              <td style={{ ...cellStyle, fontWeight: 600 }}>{loc.name || `Location ${i + 1}`}</td>
              <td style={cellStyle}>
                {detail || "—"}
                {(gmaps || waze) && (
                  <span className="cs-noprint" style={{ display: "flex", gap: "6px", marginTop: "7px" }}>
                    {gmaps && (
                      <a href={gmaps} target="_blank" rel="noopener noreferrer" style={{ ...pillStyle, fontSize: "8px", padding: "2px 9px" }}>
                        Open in Maps
                      </a>
                    )}
                    {waze && (
                      <a href={waze} target="_blank" rel="noopener noreferrer" style={{ ...pillStyle, fontSize: "8px", padding: "2px 9px" }}>
                        Open in Waze
                      </a>
                    )}
                  </span>
                )}
                {multi && i < stops.length - 1 && leg && (
                  <span style={{ display: "block", marginTop: "7px", color: MUTED }}>
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
