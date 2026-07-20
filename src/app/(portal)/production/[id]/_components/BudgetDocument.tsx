"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import {
  BudgetLineItem,
  ProductionBudgetStatus,
  lineTotal,
  lineVatPercent,
  lineVatAmount,
  lineTotalIncVat,
  invoiceStatusMeta,
} from "./types";
import { money as round2 } from "@/lib/money";

// ─────────────────────────────────────────────────────────────────────────────
// Printable production budget — same design language as the call sheet and IO
// documents: white background, black text, serif hero, letter-spaced grey
// section labels, hairline-ruled tables. window.print() captures exactly this
// node, so the on-screen preview IS the PDF. Colours are inline with
// print-color-adjust so nothing depends on Tailwind at print time.
//
// The overlay is portalled to <body> so the print rules below can collapse
// every other top-level node to nothing — the budget tab lives deep inside the
// portal shell, which we can't reach with `print:hidden` from here.
// ─────────────────────────────────────────────────────────────────────────────

export interface BudgetDocumentData {
  productionTitle: string;
  clientName: string | null;
  shootDates: string[];
  budgetStatus: ProductionBudgetStatus | null;
  campaignBudget: number | null;
  /** Sum of every line exc. VAT — the figure the budget is judged on. */
  subtotalExcVat: number;
  totalVat: number;
  totalIncVat: number;
  /** campaignBudget − subtotalExcVat. Null when no budget is set. */
  budgetRemaining: number | null;
  actualCosts: number;
  paidCost: number;
  outstanding: number;
  /** True when the tab is in Cost Tracking — swaps in actual/variance columns. */
  showActuals: boolean;
  sections: { key: string; label: string }[];
  grouped: Record<string, BudgetLineItem[]>;
}

// ── Light palette (mirrors CallSheetDocument / IODocument) ──
const TEXT = "#141414";
const MUTED = "#6b6b6b";
const FAINT = "#9a9a9a";
const HAIR = "#e7e7e7";
const RULE = "#111111";
const SOFTRULE = "#d7d7d7";
// Colour only where it carries meaning: under budget vs over budget.
const GOOD = "#1a7f4b";
const BAD = "#b42318";

const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const SERIF = 'Georgia, "Times New Roman", "Iowan Old Style", serif';

const docStyle: React.CSSProperties = {
  position: "relative",
  background: "#ffffff",
  color: TEXT,
  fontFamily: SANS,
  fontSize: "11px",
  lineHeight: 1.5,
  maxWidth: "900px",
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
};

const cellStyle: React.CSSProperties = {
  padding: "6px 10px 6px 0",
  borderBottom: `1px solid ${HAIR}`,
  fontSize: "11.5px",
  verticalAlign: "top",
};

const numCellStyle: React.CSSProperties = {
  ...cellStyle,
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
};

const thStyle: React.CSSProperties = {
  ...labelStyle,
  fontSize: "9px",
  textAlign: "left",
  padding: "6px 10px 5px 0",
  borderBottom: `1px solid ${SOFTRULE}`,
};

const numThStyle: React.CSSProperties = { ...thStyle, textAlign: "right" };

function money(n: number | null | undefined): string {
  return `£${(Number(n) || 0).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Variance/headroom figures read better with an explicit sign. */
function signedMoney(n: number): string {
  const v = round2(n);
  return `${v < 0 ? "−" : ""}${money(Math.abs(v))}`;
}

const STATUS_LABELS: Record<ProductionBudgetStatus, string> = {
  BUDGETING: "Budgeting",
  LOCKED: "Locked",
  IN_PROGRESS: "In Progress",
  FINAL: "Final",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function SummaryFigure({
  label,
  value,
  tone,
  strong,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
  strong?: boolean;
}) {
  return (
    <div style={{ minWidth: "150px" }}>
      <p style={{ ...labelStyle, fontSize: "9px", margin: "0 0 3px" }}>{label}</p>
      <p
        style={{
          margin: 0,
          fontSize: strong ? "18px" : "15px",
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
          color: tone === "good" ? GOOD : tone === "bad" ? BAD : TEXT,
        }}
      >
        {value}
      </p>
    </div>
  );
}

export function BudgetDocument({ data }: { data: BudgetDocumentData }) {
  const {
    productionTitle,
    clientName,
    shootDates,
    budgetStatus,
    campaignBudget,
    subtotalExcVat,
    totalVat,
    totalIncVat,
    budgetRemaining,
    actualCosts,
    paidCost,
    outstanding,
    showActuals,
    sections,
    grouped,
  } = data;

  // Only sections that actually carry lines — an empty Post-Production heading
  // in a printed budget is just noise.
  const populated = sections.filter((s) => (grouped[s.key] ?? []).length > 0);
  const exportedAt = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div style={docStyle}>
      {/* Masthead */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: "20px",
          borderBottom: `1.5px solid ${RULE}`,
          paddingBottom: "10px",
        }}
      >
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/OutlanderOS_Logo_Light.svg"
            alt="Outlander"
            style={{ height: "18px", width: "auto", display: "block", marginBottom: "8px" }}
          />
          <p style={{ ...labelStyle, margin: 0 }}>Production Budget</p>
        </div>
        <div style={{ textAlign: "right" }}>
          {budgetStatus && (
            <p style={{ ...labelStyle, color: TEXT, margin: "0 0 3px" }}>
              {STATUS_LABELS[budgetStatus]}
            </p>
          )}
          <p style={{ margin: 0, fontSize: "10px", color: FAINT }}>{exportedAt}</p>
        </div>
      </div>

      {/* Hero */}
      <header style={{ marginTop: "22px" }}>
        <h1
          style={{
            fontFamily: SERIF,
            fontSize: "30px",
            fontWeight: 400,
            lineHeight: 1.15,
            margin: 0,
            color: TEXT,
          }}
        >
          {productionTitle}
        </h1>
        <p style={{ margin: "8px 0 0", fontSize: "12px", color: MUTED }}>
          {clientName || "Outlander"}
          {shootDates.length > 0 && ` · ${shootDates.map(formatDate).join(", ")}`}
        </p>
      </header>

      {/* Summary — every headline figure excludes VAT */}
      <section style={{ marginTop: "24px", breakInside: "avoid" }}>
        <h2 style={sectionHeadStyle}>Summary</h2>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "28px 40px",
            paddingTop: "14px",
          }}
        >
          <SummaryFigure
            label="Campaign Budget"
            value={campaignBudget != null ? money(campaignBudget) : "—"}
            strong
          />
          <SummaryFigure label="Budgeted (exc. VAT)" value={money(subtotalExcVat)} strong />
          {budgetRemaining != null && (
            <SummaryFigure
              label={budgetRemaining >= 0 ? "Headroom" : "Over Budget"}
              value={signedMoney(budgetRemaining)}
              tone={budgetRemaining >= 0 ? "good" : "bad"}
              strong
            />
          )}
          {showActuals && <SummaryFigure label="Actual Costs" value={money(actualCosts)} strong />}
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "20px 40px",
            marginTop: "18px",
            borderTop: `1px solid ${HAIR}`,
            paddingTop: "12px",
          }}
        >
          <SummaryFigure label="VAT" value={money(totalVat)} />
          <SummaryFigure label="Total inc. VAT" value={money(totalIncVat)} />
          {showActuals && <SummaryFigure label="Paid" value={money(paidCost)} />}
          {showActuals && <SummaryFigure label="Outstanding" value={money(outstanding)} />}
        </div>
      </section>

      {/* Line items, one table per section */}
      {populated.length === 0 ? (
        <p style={{ marginTop: "26px", fontSize: "12px", color: MUTED }}>
          No budget line items have been added yet.
        </p>
      ) : (
        populated.map((sec) => {
          const lines = grouped[sec.key] ?? [];
          const secBudgeted = round2(lines.reduce((s, l) => s + lineTotal(l), 0));
          const secVat = round2(lines.reduce((s, l) => s + lineVatAmount(l), 0));
          const secIncVat = round2(lines.reduce((s, l) => s + lineTotalIncVat(l), 0));
          const secActual = round2(lines.reduce((s, l) => s + (l.actual || 0), 0));

          return (
            <section key={sec.key} style={{ marginTop: "26px", breakInside: "avoid" }}>
              <h2 style={sectionHeadStyle}>{sec.label}</h2>
              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "2px" }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, width: "34%" }}>Role / Description</th>
                    <th style={{ ...numThStyle, width: "7%" }}>Qty</th>
                    <th style={{ ...numThStyle, width: "12%" }}>Unit Cost</th>
                    <th style={{ ...numThStyle, width: "14%" }}>
                      {showActuals ? "Budgeted" : "Total (exc. VAT)"}
                    </th>
                    {showActuals ? (
                      <>
                        <th style={{ ...numThStyle, width: "13%" }}>Actual</th>
                        <th style={{ ...numThStyle, width: "13%" }}>Variance</th>
                        <th style={{ ...thStyle, width: "13%", textAlign: "right" }}>Invoice</th>
                      </>
                    ) : (
                      <>
                        <th style={{ ...numThStyle, width: "8%" }}>VAT %</th>
                        <th style={{ ...numThStyle, width: "12%" }}>VAT £</th>
                        <th style={{ ...numThStyle, width: "13%" }}>Total inc. VAT</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => {
                    const total = lineTotal(l);
                    const variance = round2(total - (l.actual || 0));
                    return (
                      <tr key={l.id}>
                        <td style={cellStyle}>
                          {l.role && (
                            <span style={{ fontWeight: 600 }}>
                              {l.role}
                              {l.description ? " — " : ""}
                            </span>
                          )}
                          {l.description || (l.role ? "" : "—")}
                        </td>
                        <td style={numCellStyle}>{l.quantity ?? "—"}</td>
                        <td style={numCellStyle}>{l.rate != null ? money(l.rate) : "—"}</td>
                        <td style={{ ...numCellStyle, fontWeight: 600 }}>{money(total)}</td>
                        {showActuals ? (
                          <>
                            <td style={numCellStyle}>{money(l.actual || 0)}</td>
                            <td
                              style={{
                                ...numCellStyle,
                                color: variance < 0 ? BAD : variance > 0 ? GOOD : TEXT,
                              }}
                            >
                              {signedMoney(variance)}
                            </td>
                            <td style={{ ...cellStyle, textAlign: "right", color: MUTED }}>
                              {invoiceStatusMeta(l.invoiceStatus).label}
                            </td>
                          </>
                        ) : (
                          <>
                            <td style={{ ...numCellStyle, color: MUTED }}>
                              {lineVatPercent(l)}%
                            </td>
                            <td style={{ ...numCellStyle, color: MUTED }}>
                              {money(lineVatAmount(l))}
                            </td>
                            <td style={{ ...numCellStyle, color: MUTED }}>
                              {money(lineTotalIncVat(l))}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                  {/* Section subtotal */}
                  <tr>
                    <td
                      style={{
                        ...cellStyle,
                        borderBottom: "none",
                        borderTop: `1px solid ${SOFTRULE}`,
                        ...labelStyle,
                        fontSize: "9px",
                        color: TEXT,
                        paddingTop: "7px",
                      }}
                      colSpan={3}
                    >
                      {sec.label} subtotal
                    </td>
                    <td
                      style={{
                        ...numCellStyle,
                        borderBottom: "none",
                        borderTop: `1px solid ${SOFTRULE}`,
                        fontWeight: 700,
                        paddingTop: "7px",
                      }}
                    >
                      {money(secBudgeted)}
                    </td>
                    {showActuals ? (
                      <>
                        <td
                          style={{
                            ...numCellStyle,
                            borderBottom: "none",
                            borderTop: `1px solid ${SOFTRULE}`,
                            fontWeight: 700,
                            paddingTop: "7px",
                          }}
                        >
                          {money(secActual)}
                        </td>
                        <td
                          style={{
                            ...numCellStyle,
                            borderBottom: "none",
                            borderTop: `1px solid ${SOFTRULE}`,
                            fontWeight: 700,
                            paddingTop: "7px",
                            color:
                              secBudgeted - secActual < 0
                                ? BAD
                                : secBudgeted - secActual > 0
                                  ? GOOD
                                  : TEXT,
                          }}
                        >
                          {signedMoney(secBudgeted - secActual)}
                        </td>
                        <td
                          style={{
                            ...cellStyle,
                            borderBottom: "none",
                            borderTop: `1px solid ${SOFTRULE}`,
                          }}
                        />
                      </>
                    ) : (
                      <>
                        <td
                          style={{
                            ...cellStyle,
                            borderBottom: "none",
                            borderTop: `1px solid ${SOFTRULE}`,
                          }}
                        />
                        <td
                          style={{
                            ...numCellStyle,
                            borderBottom: "none",
                            borderTop: `1px solid ${SOFTRULE}`,
                            color: MUTED,
                            paddingTop: "7px",
                          }}
                        >
                          {money(secVat)}
                        </td>
                        <td
                          style={{
                            ...numCellStyle,
                            borderBottom: "none",
                            borderTop: `1px solid ${SOFTRULE}`,
                            color: MUTED,
                            paddingTop: "7px",
                          }}
                        >
                          {money(secIncVat)}
                        </td>
                      </>
                    )}
                  </tr>
                </tbody>
              </table>
            </section>
          );
        })
      )}

      {/* Grand total */}
      {populated.length > 0 && (
        <section style={{ marginTop: "26px", breakInside: "avoid" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              <tr>
                <td
                  style={{
                    ...labelStyle,
                    color: TEXT,
                    fontSize: "11px",
                    borderTop: `1.5px solid ${RULE}`,
                    borderBottom: `1.5px solid ${RULE}`,
                    padding: "10px 10px 10px 0",
                    width: "53%",
                  }}
                >
                  Total {showActuals ? "" : "(exc. VAT)"}
                </td>
                <td
                  style={{
                    ...numCellStyle,
                    borderTop: `1.5px solid ${RULE}`,
                    borderBottom: `1.5px solid ${RULE}`,
                    padding: "10px 10px 10px 0",
                    fontSize: "14px",
                    fontWeight: 700,
                    width: "14%",
                  }}
                >
                  {money(subtotalExcVat)}
                </td>
                {showActuals ? (
                  <>
                    <td
                      style={{
                        ...numCellStyle,
                        borderTop: `1.5px solid ${RULE}`,
                        borderBottom: `1.5px solid ${RULE}`,
                        padding: "10px 10px 10px 0",
                        fontSize: "14px",
                        fontWeight: 700,
                        width: "13%",
                      }}
                    >
                      {money(actualCosts)}
                    </td>
                    <td
                      style={{
                        ...numCellStyle,
                        borderTop: `1.5px solid ${RULE}`,
                        borderBottom: `1.5px solid ${RULE}`,
                        padding: "10px 10px 10px 0",
                        fontSize: "14px",
                        fontWeight: 700,
                        width: "13%",
                        color:
                          subtotalExcVat - actualCosts < 0
                            ? BAD
                            : subtotalExcVat - actualCosts > 0
                              ? GOOD
                              : TEXT,
                      }}
                    >
                      {signedMoney(subtotalExcVat - actualCosts)}
                    </td>
                    <td
                      style={{
                        borderTop: `1.5px solid ${RULE}`,
                        borderBottom: `1.5px solid ${RULE}`,
                        width: "13%",
                      }}
                    />
                  </>
                ) : (
                  <>
                    <td
                      style={{
                        borderTop: `1.5px solid ${RULE}`,
                        borderBottom: `1.5px solid ${RULE}`,
                        width: "8%",
                      }}
                    />
                    <td
                      style={{
                        ...numCellStyle,
                        borderTop: `1.5px solid ${RULE}`,
                        borderBottom: `1.5px solid ${RULE}`,
                        padding: "10px 10px 10px 0",
                        color: MUTED,
                        width: "12%",
                      }}
                    >
                      {money(totalVat)}
                    </td>
                    <td
                      style={{
                        ...numCellStyle,
                        borderTop: `1.5px solid ${RULE}`,
                        borderBottom: `1.5px solid ${RULE}`,
                        padding: "10px 10px 10px 0",
                        color: MUTED,
                        width: "13%",
                      }}
                    >
                      {money(totalIncVat)}
                    </td>
                  </>
                )}
              </tr>
            </tbody>
          </table>
          {budgetRemaining != null && (
            <p
              style={{
                margin: "12px 0 0",
                textAlign: "right",
                fontSize: "12px",
                fontWeight: 600,
                fontVariantNumeric: "tabular-nums",
                color: budgetRemaining >= 0 ? GOOD : BAD,
              }}
            >
              {budgetRemaining >= 0
                ? `${money(budgetRemaining)} headroom against a ${money(campaignBudget)} budget`
                : `${money(Math.abs(budgetRemaining))} over a ${money(campaignBudget)} budget`}
            </p>
          )}
        </section>
      )}

      {/* Footer */}
      <footer
        style={{
          marginTop: "34px",
          borderTop: `1px solid ${HAIR}`,
          paddingTop: "10px",
          display: "flex",
          justifyContent: "space-between",
          gap: "16px",
          fontSize: "9.5px",
          color: FAINT,
          breakInside: "avoid",
        }}
      >
        <span>
          Budget totals exclude VAT. Per-line VAT is shown for information only and is never added
          to the budget total.
        </span>
        <span style={{ whiteSpace: "nowrap" }}>Generated by OutlanderOS · {exportedAt}</span>
      </footer>
    </div>
  );
}

/**
 * Full-screen preview of the budget document with a Print action. Portalled to
 * <body> so the print rules can hide every sibling — the budget tab itself sits
 * too deep in the portal shell to be excluded with `print:hidden`.
 */
export function BudgetDocumentPreview({
  data,
  onClose,
}: {
  data: BudgetDocumentData;
  onClose: () => void;
}) {
  // Escape closes, matching the other portal overlays.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Only ever opened by a click, so this is client-side — but the guard keeps
  // the component safe if it's ever rendered during SSR.
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="bdoc-overlay"
      data-callsheet-print
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "#ffffff",
        overflowY: "auto",
        padding: "0 24px 48px",
      }}
    >
      <style>{`
        @media print {
          body:has(.bdoc-overlay) > *:not(.bdoc-overlay) { display: none !important; }
          .bdoc-overlay {
            position: static !important;
            overflow: visible !important;
            padding: 0 !important;
            background: #fff !important;
          }
          .bdoc-no-print { display: none !important; }
        }
      `}</style>

      <div
        className="bdoc-no-print"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 1,
          background: "#ffffff",
          borderBottom: `1px solid ${HAIR}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          padding: "14px 0",
          marginBottom: "24px",
          fontFamily: SANS,
        }}
      >
        <p style={{ ...labelStyle, margin: 0 }}>Budget PDF preview</p>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            onClick={onClose}
            style={{
              fontSize: "12px",
              fontWeight: 500,
              color: MUTED,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "8px 12px",
            }}
          >
            Close
          </button>
          <button
            onClick={() => window.print()}
            style={{
              fontSize: "12px",
              fontWeight: 500,
              color: "#ffffff",
              background: RULE,
              border: "none",
              borderRadius: "10px",
              cursor: "pointer",
              padding: "9px 18px",
            }}
          >
            Print / Save as PDF
          </button>
        </div>
      </div>

      <BudgetDocument data={data} />
    </div>,
    document.body
  );
}

export default BudgetDocument;
