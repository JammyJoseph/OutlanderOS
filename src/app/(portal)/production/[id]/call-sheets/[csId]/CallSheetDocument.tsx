"use client";

import { useEffect, useRef } from "react";
import { format } from "date-fns";
import type {
  AgencyTeamMember, Attachment, CallSheetHeader, CallSheetLocation, CallTimeRow,
  CateringDetails, ClientTeamMember, CrewMember, EquipmentInfo, LocationData,
  MovementOrder, ProductionCompanyInfo, ProductionMobile, ScheduleItem,
  SectionKey, Shot, ShotStyle, TalentMember, WeatherData,
} from "./types";
import {
  CONDUCT_POLICY, CONFIDENTIALITY_NOTICE, effectiveCallTime,
  emptyCallSheetLocation, resolveUnitCall, sortByTime,
  sortByRolePriority, sortRoster, sortSchedule,
} from "./types";
import {
  journeyStats, formatJourneySummary,
  parseTime, googleMapsSearchUrl, wazeUrl, buildGoogleMapsRouteUrl, buildGpx,
  downloadTextFile,
} from "@/lib/route-utils";
import { RouteMap } from "./RouteMap";

// ─────────────────────────────────────────────────────────────────────────────
// Printable / shareable call sheet — clean, light, editorial one-page layout.
//
// This is the OUTPUT format seen on the public share links and in the PDF/print
// download. It renders on a WHITE background with black text: a serif display
// hero, letter-spaced grey section labels, and hairline rules. Function over
// form — every element earns its place. Type is deliberately lean: a ~26px
// serif hero, 11px tracked grey section labels, 13px body, 14px bold times —
// no giant call-time boxes, so the whole sheet reads as one document. Every
// information section is a consistent grid of hairline-ruled rows. Colours are
// baked into inline styles with print-color-adjust so the sheet prints clean.
// The PDF is a faithful copy of this preview: everything on screen — including
// the Maps / Waze / route links and tap-to-call / email links — also prints, so
// what you see is what gets shared (the links appear as text/clickable anchors,
// useful even in a PDF). The one map on the sheet is a single static route image
// in the movement order — there are no per-location maps. The interactive editor
// is a separate concern and unchanged.
// ─────────────────────────────────────────────────────────────────────────────

export interface CallSheetViewData {
  shootTitle: string;
  clientName?: string;
  productionTitle?: string;
  shootDate: string;
  callTime: string;
  // Master call time for the unit. Falls back to `callTime` on older sheets.
  unitCallTime?: string;
  wrapTime: string;
  location: LocationData;
  locationLat: number | null;
  locationLng: number | null;
  locations: CallSheetLocation[];
  shotStyle: ShotStyle;
  productionId?: string;
  // Creative deck / treatment link on the Production (screen: clickable link;
  // print: shows the URL as text). Omitted from the sheet when empty.
  figmaUrl?: string | null;
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

const REDACTED = "c/o Outlander";

// ── Light palette ──
const BG = "#ffffff";
const TEXT = "#141414"; // primary black text
const MUTED = "#6b6b6b"; // grey labels / secondary
const FAINT = "#9a9a9a"; // footer / tertiary
const HAIR = "#e7e7e7"; // hairline between rows
const RULE = "#111111"; // section-header underline (crisp black)
const SOFTRULE = "#d7d7d7"; // softer rule under table headers

const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const SERIF = 'Georgia, "Times New Roman", "Iowan Old Style", serif';

// ── Base styles (inline, so they survive print with no dependency on Tailwind) ──
const docStyle: React.CSSProperties = {
  position: "relative",
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

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  tableLayout: "fixed",
};

// Every table body cell shares this: same padding, same row height, hairline
// rule beneath, 13px body text. Keeps every section on one consistent grid.
const cellStyle: React.CSSProperties = {
  padding: "9px 14px 9px 0",
  borderBottom: `1px solid ${HAIR}`,
  textAlign: "left",
  verticalAlign: "top",
  wordBreak: "break-word",
  fontSize: "13px",
  color: TEXT,
};

const thStyle: React.CSSProperties = {
  padding: "0 14px 7px 0",
  borderBottom: `1px solid ${SOFTRULE}`,
  textAlign: "left",
  verticalAlign: "bottom",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: MUTED,
  whiteSpace: "nowrap",
};

const labelCellStyle: React.CSSProperties = {
  ...cellStyle,
  width: "150px",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: MUTED,
  paddingRight: "14px",
  whiteSpace: "nowrap",
};

const padX: React.CSSProperties = { paddingLeft: "40px", paddingRight: "40px" };

// Screen-only text link (Maps / Waze / Open full route / Download GPX). Small
// uppercase, black, with a subtle underline — not a pill.
const ctaLinkStyle: React.CSSProperties = {
  display: "inline-block",
  fontFamily: SANS,
  fontSize: "10px",
  fontWeight: 600,
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  color: TEXT,
  textDecoration: "none",
  borderBottom: `1px solid ${TEXT}`,
  paddingBottom: "1px",
  cursor: "pointer",
  background: "transparent",
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
    shootTitle, clientName, shootDate, callTime, unitCallTime, wrapTime, location, locationLat,
    locationLng, locations, shotStyle, deliverables, figmaUrl, weatherData, schedule,
    shotlist, crew, talent, catering, documents,
    notesGeneral, notesSafety, notesParking, header, clientTeam, agencyTeam,
    productionCompany, callTimes, productionMobiles, movementOrder, equipment,
  } = data;

  // Default every section visible unless an explicit toggle map says otherwise.
  const show = (k: SectionKey) => (sections ? sections[k] !== false : true);

  // Pageless PDF export: keep a persistent <style> whose @page height always
  // matches the current rendered height of the sheet. A ResizeObserver updates
  // it on every layout change so the correct size is in the DOM *before* the
  // user ever opens the print dialog (the beforeprint event fired too late for
  // Chrome to pick up). Result: one continuous page fitted to the content.
  const docRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const style = document.createElement("style");
    style.id = "cs-page-size";
    document.head.appendChild(style);

    const updatePageSize = () => {
      const el = docRef.current;
      if (!el) return;
      // px → mm (96dpi), plus a buffer to clear the @page margins.
      const heightMm = Math.ceil(el.scrollHeight * 0.264583) + 20;
      style.textContent = `@media print { @page { size: 210mm ${heightMm}mm; margin: 8mm; } }`;
    };

    const observer = new ResizeObserver(updatePageSize);
    if (docRef.current) observer.observe(docRef.current);
    updatePageSize();

    return () => {
      observer.disconnect();
      style.remove();
    };
  }, []);

  const companyName = (
    productionCompany.name || header.productionCompany || "Outlander"
  ).trim();

  const formattedDate = shootDate
    ? format(new Date(shootDate + "T12:00:00"), "EEEE d MMMM yyyy")
    : "";
  const shortDate = shootDate
    ? format(new Date(shootDate + "T12:00:00"), "EEE d MMMM yyyy")
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

  // ── Call times ──
  // The shape of the day, top to bottom: unit call, any department calls, wrap.
  // Individual people are NOT listed here — each person's call time appears
  // exactly once, against them, in the crew / talent lists further down.
  const unitCall = resolveUnitCall(unitCallTime, callTime) || earliestTime(crew);
  const t0 = talent.find((t) => (t.name || "").trim() || t.callTime);

  const callTimeRows: { time: string; label: string }[] = [
    { time: unitCall || "TBC", label: "Unit Call" },
  ];

  // Department rows from the explicit call-times table, when it's populated and
  // toggled on. The sheet's own Unit Call / Wrap rows supersede any table row
  // saying the same thing, so those are dropped to avoid a duplicate line.
  const isUnitRow = (d: string) => /^\s*(main\s+)?unit\s+call\s*$/i.test(d || "");
  const isWrapRow = (d: string) => /\bwrap\b/i.test(d || "");
  const departmentRows =
    show("callTimes")
      ? callTimes
          .filter((c) => (c.time || c.department) && !isUnitRow(c.department) && !isWrapRow(c.department))
          .map((c) => ({ time: c.time || "TBC", label: c.department }))
      : [];

  // Department calls sit chronologically between the unit call and the wrap, so
  // the section reads down the day. Untimed rows sink to the bottom of the block.
  callTimeRows.push(...sortByTime(departmentRows, (r) => r.time));

  callTimeRows.push({ time: wrapTime || "TBC", label: "Wrap" });

  // Hero subtitle: date · job number only (location deliberately omitted).
  const heroBits = [formattedDate, jobNumber ? `Job ${jobNumber}` : ""]
    .filter(Boolean)
    .join(" · ");

  // ── Shoot details: left facts, right key people + weather ──
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
  if (t0?.name) {
    const t0Call = effectiveCallTime(t0, unitCall);
    people.push({
      label: "Talent",
      name: t0Call ? `${t0.name} · call ${t0Call}` : t0.name,
      phone: t0.phone,
      email: t0.email,
    });
  }

  // People already surfaced in Shoot Details (Exec Producer / Producer /
  // Creative / Talent) must not repeat in the Contacts — Crew / Talent table.
  // Match on name or email; Shoot Details takes priority.
  const norm = (s?: string) => (s || "").trim().toLowerCase();
  const shownNames = new Set(
    [productionCompany.execProducer, productionCompany.producer, creative?.name, t0?.name]
      .map(norm)
      .filter(Boolean)
  );
  const shownEmails = new Set(
    [creative?.email, t0?.email].map(norm).filter(Boolean)
  );
  // In production-hierarchy order — Producer / Director / DOP / … at the top,
  // department by department, rather than the order rows were added.
  const contactCrew = sortByRolePriority(
    crew.filter(
      (c) =>
        (c.role || c.name) &&
        !shownNames.has(norm(c.name)) &&
        !(c.email && shownEmails.has(norm(c.email)))
    )
  );
  const talentRows = sortRoster(talent, unitCall).filter((t) => t.role || t.name);

  const facts: [string, string][] = [];
  if (clientName) facts.push(["Client", clientName]);
  if (jobNumber) facts.push(["Job Number", jobNumber]);
  if (formattedDate) facts.push(["Shoot Date", formattedDate]);
  facts.push(["Production Co.", productionCompany.name || companyName]);

  const weatherSummary = weatherLine(weatherData, shootDate);
  const welfareSummary = welfareLine(weatherData, notesSafety);

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
  const stats = journeyStats(stops);
  const showJourney = stops.length >= 2 && stats.totalKm > 0;
  // The single route map: rendered only when at least two stops are geocoded,
  // so it always depicts a genuine journey (never a lone per-location pin).
  const locatedStopCount = stops.filter((s) => s.lat != null && s.lng != null).length;
  const showRouteMap = locatedStopCount >= 2;

  return (
    <div ref={docRef} className="cs-doc" style={docStyle}>
      {/* Scoped print + reset rules. Keeps the light theme in print. The PDF is
          a faithful copy of the on-screen preview — nothing is hidden in print,
          so the Maps / Waze / route and call / email links print as text too. */}
      <style>{`
        @media print {
          body:has(.cs-doc) { background: ${BG} !important; }
          /* @page size is set dynamically from the measured content height by a
             ResizeObserver (see the effect above) so the sheet prints as one
             continuous page fitted to its content. */
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
        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
          <span
            style={{
              fontSize: "9px",
              fontWeight: 700,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: TEXT,
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
      <div style={{ ...padX, paddingTop: "34px", paddingBottom: "26px", position: "relative" }}>
        <h1
          style={{
            fontFamily: SERIF,
            fontSize: "26px",
            fontWeight: 600,
            lineHeight: 1.12,
            letterSpacing: "-0.01em",
            color: TEXT,
            margin: "0 0 10px",
          }}
        >
          {shootTitle || data.productionTitle || "Call Sheet"}
        </h1>
        {(heroBits || redacted) && (
          <p style={{ fontSize: "12px", color: MUTED, margin: 0 }}>
            {heroBits}
            {redacted ? `${heroBits ? " · " : ""}Client copy` : ""}
          </p>
        )}
      </div>

      {/* ── Body ── */}
      <div style={{ ...padX }}>
        {/* ── Shoot details (facts + key people / weather) ── */}
        <Section title="Shoot Details">
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
              {figmaUrl && figmaUrl.trim() && (
                <OverviewRow
                  label="Creative Deck"
                  value={
                    <a
                      href={figmaUrl.trim().startsWith("http") ? figmaUrl.trim() : `https://${figmaUrl.trim()}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: TEXT, textDecoration: "underline", wordBreak: "break-all" }}
                    >
                      {figmaUrl.trim()}
                    </a>
                  }
                />
              )}
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
              {weatherSummary && (
                <OverviewRow
                  label="Weather"
                  value={
                    [weatherSummary, welfareSummary].filter(Boolean).join(" · ")
                  }
                />
              )}
            </div>
          </div>
        </Section>

        {/* ── Call times (crew / talent / wrap, or department table) ──
            Integrated into the grid like every other section — no oversized
            call-time boxes; the time is just 14px bold. */}
        <Section title="Call Times">
          <table style={tableStyle}>
            <colgroup>
              <col style={{ width: "16%" }} />
              <col />
            </colgroup>
            <tbody>
              {callTimeRows.map((r, i) => (
                <tr key={i}>
                  <td
                    style={{
                      ...cellStyle,
                      whiteSpace: "nowrap",
                      fontWeight: 700,
                      // The unit call is the headline time on the sheet.
                      fontSize: i === 0 ? "16px" : "14px",
                    }}
                  >
                    {r.time}
                  </td>
                  <td style={{ ...cellStyle, fontWeight: 600 }}>{r.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        {/* ── Run of the day (schedule) ── */}
        {show("schedule") && schedule.some((s) => s.time || s.description) && (
          <Section title="Run of the Day">
            <GridTable
              columns={[
                { label: "Time", width: "14%", nowrap: true },
                { label: "Activity — Location", width: "48%" },
                { label: "Notes", width: "38%" },
              ]}
              rows={sortSchedule(schedule)
                .filter((s) => s.time || s.description)
                .map((s) => [<Bold key="t">{s.time}</Bold>, <Bold key="a">{s.description}</Bold>, s.notes])}
            />
          </Section>
        )}

        {/* ── Locations / movement order ── */}
        {show("location") && (stops.length > 0 || hasMovement) && (
          <Section
            title={stops.length > 1 ? "Locations / Movement Order" : "Location"}
            summary={showJourney ? formatJourneySummary(stats) : undefined}
          >
            {stops.length > 0 && <LocationsGrid stops={stops} />}

            {/* The ONE map on the sheet: a single route map for the whole
                journey (composited from OSM tiles into an inline SVG so it
                prints), with screen-only route CTAs below it. */}
            {showRouteMap && (
              <div style={{ marginTop: "16px" }}>
                <RouteMap stops={stops} />
                <div style={{ display: "flex", gap: "18px", marginTop: "8px" }}>
                  {routeUrl && (
                    <a href={routeUrl} target="_blank" rel="noopener noreferrer" style={ctaLinkStyle}>
                      Open full route
                    </a>
                  )}
                  <button
                    type="button"
                    style={ctaLinkStyle}
                    onClick={() =>
                      downloadTextFile(
                        "shoot-route.gpx",
                        buildGpx(stops, shootTitle || "Shoot route"),
                        "application/gpx+xml"
                      )
                    }
                  >
                    Download GPX
                  </button>
                </div>
              </div>
            )}
            {nearestAE && (
              <p style={{ margin: "14px 0 0", fontSize: "13px" }}>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: MUTED,
                  }}
                >
                  Nearest A&amp;E (all locations):{" "}
                </span>
                <span style={{ color: TEXT }}>{nearestAE}</span>
              </p>
            )}
            {location.safetyNotes && (
              <p style={{ margin: "10px 0 0", fontWeight: 700, color: TEXT }}>
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

        {/* ── Contacts — crew / talent ── */}
        {show("crew") && contactCrew.length > 0 && (
          <Section title="Contacts — Crew / Talent">
            <GridTable
              columns={[
                { label: "Role", width: "24%" },
                { label: "Name", width: "21%" },
                { label: "Call", width: "13%", nowrap: true },
                { label: "Phone", width: "21%" },
                { label: "Email", width: "21%" },
              ]}
              rows={contactCrew
                .map((c) => [
                  c.role,
                  <Bold key="n">{c.name}</Bold>,
                  <CallCell key="c" person={c} unitCall={unitCall} />,
                  redacted ? REDACTED : <PhoneLink phone={c.phone} />,
                  redacted ? "" : <EmailLink email={c.email} />,
                ])}
            />
            <p style={{ margin: "10px 0 0", fontSize: "9px", color: MUTED, lineHeight: 1.5 }}>
              On-set contact for all queries: {productionCompany.producer || "the Producer"}
              {productionCompany.producer ? " (Producer)" : ""}. Roles marked &ldquo;c/o
              Outlander&rdquo; are reached via the Producer.
            </p>
          </Section>
        )}

        {/* ── Talent (dedicated list, if present) ── */}
        {show("talent") && talentRows.length > 0 && (
          <Section title="Talent">
            <GridTable
              columns={[
                { label: "Name", width: "30%" },
                { label: "Role", width: "26%" },
                { label: "Call", width: "14%", nowrap: true },
                { label: "Contact", width: "30%" },
              ]}
              rows={talentRows
                .map((t) => [
                  <Bold key="n">{t.name}</Bold>,
                  t.role,
                  <CallCell key="c" person={t} unitCall={unitCall} />,
                  redacted ? REDACTED : <ContactCell phone={t.phone} email={t.email} />,
                ])}
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
                  <Bold key="n">{a.name}</Bold>,
                  redacted ? REDACTED : <ContactCell phone={a.phone} email={a.email} />,
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
                  <Bold key="n">{m.name}</Bold>,
                  redacted ? REDACTED : <PhoneLink phone={m.phone} />,
                ])}
            />
          </Section>
        )}

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

        {/* ── Shotlist / styling ── */}
        {show("shotlist") &&
          (shotlist.some((s) => s.description || s.scene || s.referenceImageUrl) || hasShotStyle) && (
            <Section title="Shotlist / Styling">
              {hasShotStyle && (
                <p style={{ margin: "0 0 10px", fontSize: "10px", color: MUTED }}>
                  {[shotStyle.tone, shotStyle.visualDevice, shotStyle.notes].filter(Boolean).join(" · ")}
                </p>
              )}
              {shotlist.some((s) => s.description || s.scene || s.referenceImageUrl) && (
                <GridTable
                  columns={[
                    { label: "#", width: "6%", nowrap: true },
                    { label: "Shot / Scene", width: "54%" },
                    { label: "Notes", width: "40%" },
                  ]}
                  rows={shotlist
                    .filter((s) => s.description || s.scene || s.referenceImageUrl)
                    .map((s, i) => {
                      const text = s.description || s.scene || "";
                      const shotCell = s.referenceImageUrl ? (
                        <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={s.referenceImageUrl}
                            alt=""
                            style={{
                              width: "54px",
                              height: "54px",
                              objectFit: "cover",
                              borderRadius: "4px",
                              border: `1px solid ${HAIR}`,
                              flexShrink: 0,
                            }}
                          />
                          <span>{text}</span>
                        </div>
                      ) : (
                        text
                      );
                      return [
                        s.shotNumber || String(i + 1),
                        shotCell,
                        [s.video, s.stills, s.dialogue, s.setup].filter(Boolean).join(" · "),
                      ];
                    })}
                />
              )}
            </Section>
          )}

        {/* ── Bottom row — catering + deliverables / weather ── */}
        {(() => {
          const showCatering = show("catering") && hasCatering;
          const showDeliverables = show("deliverables") && (deliverables?.length ?? 0) > 0;
          const showWeather =
            show("weather") && !!(weatherData?.forecast?.length || welfareSummary);
          if (!showCatering && !showDeliverables && !showWeather) return null;
          return (
            <div
              style={{
                marginTop: "34px",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0 40px",
              }}
            >
              <div>
                {showCatering && (
                  <SubSection title="Catering">
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
                  </SubSection>
                )}
              </div>
              <div>
                {showDeliverables && (
                  <SubSection title="Deliverables">
                    <DefTable
                      rows={deliverables!.map((d) => [
                        (d.type || "").toUpperCase(),
                        [d.title, d.notes].filter(Boolean).join(" — "),
                      ] as [string, React.ReactNode])}
                    />
                  </SubSection>
                )}
                {showWeather && (
                  <SubSection title="Weather / Welfare">
                    <DefTable
                      rows={[
                        weatherData?.forecast?.length
                          ? ["Forecast", weatherLine(weatherData, shootDate)]
                          : null,
                        welfareSummary ? ["Welfare", welfareSummary] : null,
                      ]}
                    />
                  </SubSection>
                )}
              </div>
            </div>
          );
        })()}

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
              <p style={{ margin: "10px 0 0", fontSize: "13px", color: TEXT }}>
                <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: MUTED }}>
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
                    <a href={d.url} target="_blank" rel="noopener noreferrer" style={{ color: TEXT, textDecoration: "underline" }}>
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
        {show("notes") && (notesGeneral || notesParking) && (
          <Section title="Notes">
            <DefTable
              rows={[
                notesGeneral ? ["Production", notesGeneral] : null,
                notesParking ? ["Parking", notesParking] : null,
              ]}
            />
          </Section>
        )}

        {/* ── Conduct / confidentiality / safety (fine print) ── */}
        {(show("confidentiality") || show("conduct")) && (
          <div
            style={{
              marginTop: "32px",
              paddingTop: "16px",
              borderTop: `1px solid ${HAIR}`,
              fontSize: "8.5px",
              lineHeight: 1.6,
              color: MUTED,
            }}
          >
            {show("conduct") && (
              <p style={{ margin: "0 0 8px" }}>
                <strong style={{ color: TEXT }}>Conduct &amp; Safety. </strong>
                {CONDUCT_POLICY}
              </p>
            )}
            {show("confidentiality") && (
              <p style={{ margin: "0 0 8px" }}>
                <strong style={{ color: TEXT }}>Confidentiality. </strong>
                {CONFIDENTIALITY_NOTICE}
              </p>
            )}
            <p style={{ margin: 0 }}>
              <strong style={{ color: TEXT }}>Credit. </strong>
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
          marginTop: "26px",
          paddingTop: "14px",
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
  summary,
  action,
  children,
}: {
  title: string;
  summary?: string;
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
          margin: "0 0 12px",
          paddingBottom: "7px",
          borderBottom: `1px solid ${RULE}`,
          breakAfter: "avoid",
          breakInside: "avoid",
        }}
      >
        <h2
          style={{
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: TEXT,
            margin: 0,
          }}
        >
          {title}
        </h2>
        <div style={{ display: "flex", alignItems: "flex-end", gap: "14px", flexShrink: 0 }}>
          {summary && (
            <span
              style={{
                fontSize: "9px",
                letterSpacing: "0.04em",
                color: MUTED,
                whiteSpace: "nowrap",
              }}
            >
              {summary}
            </span>
          )}
          {action}
        </div>
      </div>
      {children}
    </section>
  );
}

// Compact section header for the side-by-side bottom row (Catering / Deliverables).
function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "18px" }}>
      <h3
        style={{
          fontSize: "9px",
          fontWeight: 700,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: TEXT,
          margin: "0 0 8px",
          paddingBottom: "6px",
          borderBottom: `1px solid ${SOFTRULE}`,
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

function Bold({ children }: { children: React.ReactNode }) {
  return <span style={{ fontWeight: 700, color: TEXT }}>{children}</span>;
}

// A person's call time in the crew / talent grids — the single place it appears.
// One time, no flags: a person called earlier than the unit simply has an
// earlier time, and the list being in call order already makes that read.
function CallCell({
  person,
  unitCall,
}: {
  person: { callTime?: string };
  unitCall: string;
}) {
  const time = effectiveCallTime(person, unitCall);
  if (!time) return <>{"—"}</>;
  return <span style={{ color: TEXT, whiteSpace: "nowrap" }}>{time}</span>;
}

// A single label/value line in the two-column Shoot Details grid.
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
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: MUTED,
          marginBottom: "3px",
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: "13px", color: TEXT, display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
        <span>{value || "—"}</span>
        {contact}
      </div>
    </div>
  );
}

// Screen-only Call / Email quick links (tel: / mailto:).
function QuickLinks({ phone, email }: { phone?: string; email?: string }) {
  if (!phone && !email) return null;
  return (
    <span style={{ display: "inline-flex", gap: "10px" }}>
      {phone && (
        <a href={`tel:${phone.replace(/\s+/g, "")}`} style={{ ...ctaLinkStyle, fontSize: "8px" }}>
          Call
        </a>
      )}
      {email && (
        <a href={`mailto:${email}`} style={{ ...ctaLinkStyle, fontSize: "8px" }}>
          Email
        </a>
      )}
    </span>
  );
}

// tel: link that prints as plain text.
function PhoneLink({ phone }: { phone?: string }) {
  if (!phone) return <>{"—"}</>;
  return (
    <a href={`tel:${phone.replace(/\s+/g, "")}`} style={{ color: TEXT, textDecoration: "none" }}>
      {phone}
    </a>
  );
}

// mailto: link that prints as plain text.
function EmailLink({ email }: { email?: string }) {
  if (!email) return <>{"—"}</>;
  return (
    <a href={`mailto:${email}`} style={{ color: TEXT, textDecoration: "none", wordBreak: "break-all" }}>
      {email}
    </a>
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

// Compact one-line forecast for the shoot day, e.g.
// "Clear · 33°/19°C · UV 9".
function weatherLine(weather: WeatherData | null, shootDate: string): string {
  if (!weather) return "";
  const day =
    weather.forecast.find((f) => f.date === shootDate) || weather.forecast[0];
  if (!day) return "";
  const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
  const parts: string[] = [];
  const desc = cap(day.description || day.condition || "");
  if (desc) parts.push(desc);
  if (Number.isFinite(day.tempMax)) {
    parts.push(
      `${Math.round(day.tempMax)}°${
        Number.isFinite(day.tempMin) ? `/${Math.round(day.tempMin)}°C` : "C"
      }`
    );
  }
  if (Number.isFinite(day.wind)) parts.push(`Wind ${Math.round(day.wind)} mph`);
  if (weather.sun && Number.isFinite(weather.sun.uvIndex) && weather.sun.uvIndex > 0) {
    parts.push(`UV ${Math.round(weather.sun.uvIndex)}`);
  }
  const warnings = (weather.warnings || []).map((w) => w.label).filter(Boolean);
  if (warnings.length) parts.push(warnings.join(" "));
  return parts.join(" · ");
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

// Address cell for the locations grid: the address line, with subtle screen-only
// Maps / Waze deep links sitting right next to it (hidden in print).
function AddressCell({ loc }: { loc: CallSheetLocation }) {
  const addressLine = [loc.address, loc.postcode].filter(Boolean).join(", ");
  const gmaps = googleMapsSearchUrl(loc);
  const waze = wazeUrl(loc);
  return (
    <div>
      <span>{addressLine || "—"}</span>
      {(gmaps || waze) && (
        <span
          style={{ display: "inline-flex", gap: "10px", marginLeft: "10px", whiteSpace: "nowrap" }}
        >
          {gmaps && (
            <a href={gmaps} target="_blank" rel="noopener noreferrer" style={{ ...ctaLinkStyle, fontSize: "9px" }}>
              Maps
            </a>
          )}
          {waze && (
            <a href={waze} target="_blank" rel="noopener noreferrer" style={{ ...ctaLinkStyle, fontSize: "9px" }}>
              Waze
            </a>
          )}
        </span>
      )}
    </div>
  );
}

// Movement order as a clean grid — one consistent row per stop: number, name,
// address (with Maps / Waze links), and notes (w3w / contact / parking). The
// journey summary sits in the section header and the route map below the grid,
// so the rows themselves stay tabular like every other section.
function LocationsGrid({ stops }: { stops: CallSheetLocation[] }) {
  return (
    <GridTable
      columns={[
        { label: "#", width: "6%", nowrap: true },
        { label: "Location", width: "26%" },
        { label: "Address", width: "42%" },
        { label: "Notes", width: "26%" },
      ]}
      rows={stops.map((loc, i) => [
        String(i + 1),
        <Bold key="n">{loc.name || `Location ${i + 1}`}</Bold>,
        <AddressCell key="a" loc={loc} />,
        [
          loc.whatThreeWords ? `w3w: ${loc.whatThreeWords}` : "",
          loc.contactPerson ? `Contact: ${loc.contactPerson}` : "",
          loc.parkingNotes ? `Parking: ${loc.parkingNotes}` : "",
        ]
          .filter(Boolean)
          .join(" · "),
      ])}
    />
  );
}
