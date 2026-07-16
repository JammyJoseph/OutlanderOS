"use client";

import {
  IO_COMPANY,
  IO_SIGNATORY,
  IO_TERMS_TITLE,
  IO_TERMS_PREAMBLE,
  IO_TERMS_SECTIONS,
  IO_TERMS_WITNESS,
  type IOLineItem,
} from "@/lib/io-template";

// ─────────────────────────────────────────────────────────────────────────────
// Printable Insertion Order — same design language as the call sheet document:
// white background, black text, serif hero, letter-spaced grey section labels,
// hairline-ruled tables. Page 1 is the order itself; pages 2+ are the fixed
// Outlander advertising T&Cs. window.print() captures exactly this node — the
// preview IS the PDF. Colours are inline with print-color-adjust so nothing
// depends on Tailwind at print time.
// ─────────────────────────────────────────────────────────────────────────────

export interface IOViewData {
  ioNumber: string;
  advertiserName: string;
  campaignName: string;
  clientOrAgency: string;
  poNumber: string;
  contactName: string;
  contactEmail: string;
  lineItems: IOLineItem[];
  totalNet: number;
  notes: string;
  signedName: string;
  signedTitle: string;
}

// ── Light palette (mirrors CallSheetDocument) ──
const TEXT = "#141414";
const MUTED = "#6b6b6b";
const FAINT = "#9a9a9a";
const HAIR = "#e7e7e7";
const RULE = "#111111";
const SOFTRULE = "#d7d7d7";

const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const SERIF = 'Georgia, "Times New Roman", "Iowan Old Style", serif';

const docStyle: React.CSSProperties = {
  position: "relative",
  background: "#ffffff",
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

const labelStyle: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 700,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: MUTED,
};

const sectionHeadStyle: React.CSSProperties = {
  ...labelStyle,
  color: TEXT,
  borderBottom: `1.5px solid ${RULE}`,
  paddingBottom: "5px",
  marginBottom: "0",
};

const cellStyle: React.CSSProperties = {
  padding: "7px 10px 7px 0",
  borderBottom: `1px solid ${HAIR}`,
  fontSize: "12px",
  verticalAlign: "top",
};

const thStyle: React.CSSProperties = {
  ...labelStyle,
  fontSize: "9px",
  textAlign: "left",
  padding: "6px 10px 5px 0",
  borderBottom: `1px solid ${SOFTRULE}`,
};

function money(n: number): string {
  return `£${(Number(n) || 0).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function Section({ title, children, style }: { title: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <section style={{ marginTop: "26px", ...style }}>
      <h2 style={sectionHeadStyle}>{title}</h2>
      {children}
    </section>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td style={{ ...cellStyle, width: "180px", color: MUTED, fontWeight: 600 }}>{label}</td>
      <td style={cellStyle}>{value || "—"}</td>
    </tr>
  );
}

function SignatureBlock({ party, name, title }: { party: string; name: string; title: string }) {
  const line = (label: string, value?: string) => (
    <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "14px" }}>
      <span style={{ fontSize: "11px", fontWeight: 600, color: MUTED, width: "58px", flexShrink: 0 }}>{label}:</span>
      <span
        style={{
          flex: 1,
          borderBottom: `1px solid ${SOFTRULE}`,
          fontSize: "12px",
          minHeight: "17px",
          paddingBottom: "2px",
        }}
      >
        {value || " "}
      </span>
    </div>
  );
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <p style={{ fontSize: "11px", fontWeight: 700, margin: 0 }}>{party}</p>
      {line("Name", name)}
      {line("Job Title", title)}
      {line("Date")}
      {line("Signed")}
    </div>
  );
}

export function IODocument({ data }: { data: IOViewData }) {
  const items = data.lineItems.filter(
    (li) => li.description || li.startDate || li.endDate || li.subtotal
  );

  return (
    <div style={docStyle}>
      {/* ══ PAGE 1 — the order ══ */}
      {/* Masthead */}
      <header
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          borderBottom: `2px solid ${RULE}`,
          paddingBottom: "14px",
        }}
      >
        <div>
          <p style={{ ...labelStyle, marginBottom: "6px" }}>Outlander Magazine</p>
          <h1
            style={{
              fontFamily: SERIF,
              fontSize: "44px",
              lineHeight: 1,
              fontWeight: 700,
              letterSpacing: "0.02em",
              margin: 0,
            }}
          >
            IO
          </h1>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontFamily: SERIF, fontSize: "20px", margin: 0 }}>{data.advertiserName || "—"}</p>
          <p style={{ fontSize: "10px", color: MUTED, margin: "4px 0 0" }}>{data.ioNumber}</p>
        </div>
      </header>

      {/* Order meta */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "18px" }}>
        <tbody>
          <MetaRow label="IO Number" value={data.ioNumber} />
          <MetaRow label="Advertiser" value={data.advertiserName} />
          <MetaRow label="Campaign Name" value={data.campaignName} />
          <MetaRow label="Client or Agency" value={data.clientOrAgency === "AGENCY" ? "Agency" : "Client"} />
          <MetaRow label="PO Number" value={data.poNumber} />
        </tbody>
      </table>

      {/* Contacts */}
      <Section title="Contacts">
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: "34%" }}></th>
              <th style={thStyle}>Full Name</th>
              <th style={thStyle}>E-mail Address</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ ...cellStyle, color: MUTED, fontWeight: 600 }}>Client Contact</td>
              <td style={cellStyle}>{data.contactName || "—"}</td>
              <td style={cellStyle}>{data.contactEmail || "—"}</td>
            </tr>
            <tr>
              <td style={{ ...cellStyle, color: MUTED, fontWeight: 600 }}>Outlander Magazine Contact</td>
              <td style={cellStyle}>{IO_SIGNATORY.name}</td>
              <td style={cellStyle}>{IO_SIGNATORY.email}</td>
            </tr>
          </tbody>
        </table>
      </Section>

      {/* Media line items */}
      <Section title="Media">
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: "13%" }}>Start Date</th>
              <th style={{ ...thStyle, width: "13%" }}>End Date</th>
              <th style={thStyle}>Description</th>
              <th style={{ ...thStyle, width: "9%" }}>Quantity</th>
              <th style={{ ...thStyle, width: "13%", textAlign: "right" }}>Rate</th>
              <th style={{ ...thStyle, width: "15%", textAlign: "right", paddingRight: 0 }}>Net Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ ...cellStyle, color: FAINT }}>
                  No media line items.
                </td>
              </tr>
            ) : (
              items.map((li, i) => (
                <tr key={i}>
                  <td style={cellStyle}>{li.startDate || "—"}</td>
                  <td style={cellStyle}>{li.endDate || "—"}</td>
                  <td style={{ ...cellStyle, fontWeight: 600 }}>{li.description}</td>
                  <td style={cellStyle}>{li.quantity}</td>
                  <td style={{ ...cellStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {money(li.rate)}
                  </td>
                  <td style={{ ...cellStyle, textAlign: "right", paddingRight: 0, fontVariantNumeric: "tabular-nums" }}>
                    {money(li.subtotal)}
                  </td>
                </tr>
              ))
            )}
            <tr>
              <td colSpan={4} style={{ ...cellStyle, borderBottom: "none" }}></td>
              <td
                style={{
                  ...cellStyle,
                  borderBottom: "none",
                  borderTop: `1.5px solid ${RULE}`,
                  textAlign: "right",
                  fontWeight: 700,
                }}
              >
                Total Net Cost
              </td>
              <td
                style={{
                  ...cellStyle,
                  borderBottom: "none",
                  borderTop: `1.5px solid ${RULE}`,
                  textAlign: "right",
                  paddingRight: 0,
                  fontWeight: 700,
                  fontSize: "13px",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {money(data.totalNet)} GBP
              </td>
            </tr>
          </tbody>
        </table>
      </Section>

      {/* Notes */}
      <Section title="Additional Notes">
        <p style={{ fontSize: "12px", whiteSpace: "pre-wrap", margin: "10px 0 0", minHeight: "20px" }}>
          {data.notes || "—"}
        </p>
      </Section>

      {/* Signatures */}
      <Section title="Signatures" style={{ breakInside: "avoid" }}>
        <div style={{ display: "flex", gap: "48px", marginTop: "14px" }}>
          <SignatureBlock
            party="Signed for and on behalf of buyer:"
            name={data.signedName}
            title={data.signedTitle}
          />
          <SignatureBlock
            party="Signed for and on behalf of Outlander Magazine:"
            name={IO_SIGNATORY.name}
            title={IO_SIGNATORY.title}
          />
        </div>
      </Section>

      <p style={{ fontSize: "10px", color: FAINT, marginTop: "28px" }}>
        VAT NUMBER: {IO_COMPANY.vatNumber} ({IO_COMPANY.name}) · Company No. {IO_COMPANY.companyNumber} ·{" "}
        {IO_COMPANY.address}
      </p>

      {/* ══ PAGES 2+ — fixed T&Cs ══ */}
      <section style={{ breakBefore: "page", paddingTop: "8px", marginTop: "40px", borderTop: `2px solid ${RULE}` }}>
        <h2
          style={{
            fontFamily: SERIF,
            fontSize: "16px",
            fontWeight: 700,
            letterSpacing: "0.04em",
            margin: "18px 0 12px",
          }}
        >
          {IO_TERMS_TITLE}
        </h2>
        {IO_TERMS_PREAMBLE.map((p, i) => (
          <p key={i} style={{ fontSize: "10.5px", color: TEXT, margin: "0 0 8px" }}>
            {p.replace("{advertiser}", data.advertiserName || "The Advertiser")}
          </p>
        ))}

        {IO_TERMS_SECTIONS.map((s) => (
          <div key={s.heading} style={{ marginTop: "16px" }}>
            <h3 style={{ ...labelStyle, color: TEXT, fontSize: "10.5px", marginBottom: "6px", breakAfter: "avoid" }}>
              {s.heading}
            </h3>
            {s.paragraphs.map((p, i) => (
              <p key={i} style={{ fontSize: "10px", color: "#333333", margin: "0 0 6px" }}>
                {p}
              </p>
            ))}
          </div>
        ))}

        <p style={{ fontSize: "10.5px", fontWeight: 600, marginTop: "20px" }}>{IO_TERMS_WITNESS}</p>

        {/* Deed signature blocks close the terms */}
        <div style={{ display: "flex", gap: "48px", marginTop: "24px", breakInside: "avoid" }}>
          <SignatureBlock party={IO_COMPANY.legalName} name={IO_SIGNATORY.name} title={IO_SIGNATORY.title} />
          <SignatureBlock party={data.advertiserName || "The Advertiser"} name={data.signedName} title={data.signedTitle} />
        </div>
      </section>

      <footer
        style={{
          marginTop: "36px",
          paddingTop: "10px",
          borderTop: `1px solid ${HAIR}`,
          display: "flex",
          justifyContent: "space-between",
          fontSize: "9px",
          color: FAINT,
        }}
      >
        <span>Private &amp; Confidential · © {IO_COMPANY.name}</span>
        <span>{data.ioNumber}</span>
      </footer>
    </div>
  );
}
