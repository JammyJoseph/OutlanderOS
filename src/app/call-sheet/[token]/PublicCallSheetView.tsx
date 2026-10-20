"use client";

import { useEffect, useState } from "react";
import { FileDown, CloudSun, MapPin } from "lucide-react";
import { pill } from "@/components/os";
import {
  CallSheetDocument,
  type CallSheetViewData,
} from "@/app/(portal)/production/[id]/call-sheets/[csId]/CallSheetDocument";
import { resolveUnitCall } from "@/app/(portal)/production/[id]/call-sheets/[csId]/types";

// Read-only public view (redesign board 5.4): white page, Outlander mark, the
// day and the unit call up top in navy, then the full document underneath.
// The summary is screen-only, so the printed / downloaded PDF is unchanged.
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

  const unitCall = resolveUnitCall(data.unitCallTime, data.callTime);
  const day = data.shootDate
    ? new Date(data.shootDate + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })
    : "";
  const firstStop = data.locations.find((l) => (l.address || "").trim()) ?? null;
  const address = (firstStop?.address || data.location.address || "").trim();
  const mapHref =
    firstStop?.mapLink?.trim() ||
    (address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : "");
  const context = [data.clientName, data.shootTitle].filter(Boolean).join(" · ");

  return (
    <div className="min-h-screen bg-background text-foreground print:bg-white" data-callsheet-print>
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-4 py-5 sm:px-8 print:hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/OutlanderOS_Logo_Ink.svg" alt="OutlanderOS" className="h-5 w-auto" />
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {redacted ? "Client call sheet" : "Shared call sheet"}
          </span>
          <button onClick={() => window.print()} className={pill("secondary", "sm")}>
            <FileDown size={16} /> Download PDF
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 pb-16 pt-8 sm:px-6 sm:pt-10 print:max-w-none print:px-0 print:py-0">
        <div className="mb-10 flex flex-col gap-6 print:hidden">
          <section className="flex flex-col gap-1.5">
            {context && <p className="text-base text-muted-foreground">{context}</p>}
            <h1 className="text-[28px] font-semibold leading-[1.15] tracking-[-0.015em] sm:text-[34px]">{day || data.shootTitle}</h1>
          </section>

          {(unitCall || address) && (
            <section className="flex flex-col gap-5 rounded-[24px] bg-navy p-6 text-on-navy sm:p-7">
              <div className="flex flex-wrap items-end justify-between gap-4">
                {unitCall ? (
                  <div>
                    <div className="text-sm text-[#C9D6E5]">Unit call</div>
                    <div className="font-stat text-[72px] font-semibold leading-[0.9] tabular-nums text-primary sm:text-[96px]">
                      {unitCall}
                    </div>
                  </div>
                ) : (
                  <span />
                )}
                <div className="text-sm text-[#C9D6E5] sm:text-right">
                  {redacted ? "Client version" : "Your own call time is on the crew list below"}
                  {data.wrapTime && (
                    <>
                      <br />
                      Wrap {data.wrapTime}
                    </>
                  )}
                </div>
              </div>
              {address && (
                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/15 pt-5">
                  <div className="min-w-0">
                    <div className="font-semibold">{firstStop?.name?.trim() || "Location"}</div>
                    <div className="text-sm text-[#C9D6E5]">{address}</div>
                  </div>
                  {mapHref && (
                    <a href={mapHref} target="_blank" rel="noopener noreferrer" className={pill("onNavy")}>
                      <MapPin /> Open in Maps
                    </a>
                  )}
                </div>
              )}
            </section>
          )}

          {liveAt && (
            <p className="-mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
              <CloudSun size={15} /> Live weather, updated {liveAt}
            </p>
          )}
          {!redacted && (
            <p className="-mt-2 text-sm text-muted-foreground">
              Please confirm receipt with your production contact.
            </p>
          )}
        </div>

        <CallSheetDocument data={data} redacted={redacted} />

        <p className="mt-8 text-center text-sm text-muted-foreground print:hidden">
          Private &amp; confidential © Outlander Magazine Ltd. Please don&apos;t forward this link
          outside the crew.
        </p>
      </div>
    </div>
  );
}
