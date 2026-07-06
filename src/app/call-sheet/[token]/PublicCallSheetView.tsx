"use client";

import { useEffect, useState } from "react";
import { FileDown, CloudSun } from "lucide-react";
import {
  CallSheetDocument,
  type CallSheetViewData,
} from "@/app/(portal)/production/[id]/call-sheets/[csId]/CallSheetDocument";

// Read-only public view — clean white page, Outlander branding, no portal chrome.
// `redacted` renders the client version (production contact details masked).
// Weather is refetched live from the shoot location on every load.
export function PublicCallSheetView({
  viewData,
  token,
  redacted = false,
}: {
  viewData: CallSheetViewData;
  token: string;
  redacted?: boolean;
}) {
  const [data, setData] = useState(viewData);
  const [liveAt, setLiveAt] = useState<string | null>(null);

  // Live weather tracker — pull fresh forecast for the shoot location each load.
  useEffect(() => {
    if (viewData.locationLat == null || viewData.locationLng == null) return;
    let active = true;
    fetch(`/api/call-sheet-weather?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!active || !d?.forecast?.length) return;
        setData((prev) => ({
          ...prev,
          weatherData: {
            forecast: d.forecast,
            hourly: d.hourly ?? [],
            hourlyDate: d.hourlyDate,
            fetchedAt: d.fetchedAt,
            lat: viewData.locationLat as number,
            lng: viewData.locationLng as number,
          },
        }));
        setLiveAt(
          d.fetchedAt
            ? new Date(d.fetchedAt).toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : null
        );
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [token, viewData.locationLat, viewData.locationLng]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] print:bg-[#0a0a0a]" data-callsheet-print>
      <div className="max-w-4xl mx-auto px-6 py-8 print:px-0 print:py-0 print:max-w-none">
        <div className="flex items-center justify-between mb-6 print:hidden">
          <div>
            <p className="text-sm font-extrabold tracking-[0.3em] uppercase text-white">
              Outlander
            </p>
            <p className="text-[11px] text-white/40 mt-0.5">
              {redacted
                ? "Client call sheet · live weather for the shoot location"
                : "Production call sheet · please confirm receipt with your contact"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {liveAt && (
              <span className="hidden sm:flex items-center gap-1 text-[11px] text-emerald-400">
                <CloudSun size={12} /> Live weather {liveAt}
              </span>
            )}
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/15 text-sm font-medium text-white/70 hover:bg-white/5 transition-colors"
            >
              <FileDown size={13} /> Download PDF
            </button>
          </div>
        </div>

        <CallSheetDocument data={data} redacted={redacted} />

        <p className="mt-8 text-center text-[11px] text-white/25 print:hidden">
          Outlander Magazine — confidential production document. Please don&apos;t forward
          this link outside the crew.
        </p>
      </div>
    </div>
  );
}
