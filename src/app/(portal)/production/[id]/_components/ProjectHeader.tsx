"use client";

import { useState } from "react";
import { Film, ChevronDown, Check, ExternalLink } from "lucide-react";
import {
  ProductionFull,
  PRODUCTION_STATUS_STYLES,
  STATUS_OPTIONS,
  ProductionStatus,
  getClientName,
} from "./types";

interface Props {
  production: ProductionFull;
  onPatch: (patch: Record<string, unknown>) => void;
  saving: boolean;
  saved: boolean;
}

export default function ProjectHeader({ production, onPatch, saving, saved }: Props) {
  const [showStatus, setShowStatus] = useState(false);
  const [title, setTitle] = useState(production.title);
  const [client, setClient] = useState(getClientName(production));
  const style =
    PRODUCTION_STATUS_STYLES[production.status] || PRODUCTION_STATUS_STYLES.DRAFT;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center flex-shrink-0 mt-0.5">
          <Film size={22} className="text-[#D4A853]" />
        </div>
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              if (title !== production.title) onPatch({ title });
            }}
            placeholder="Untitled Project"
            className="text-2xl font-semibold text-gray-900 tracking-tight bg-transparent border-none outline-none w-full placeholder-gray-300 -ml-1 px-1 rounded-md focus:bg-amber-50/40"
          />
          <input
            type="text"
            value={client}
            onChange={(e) => setClient(e.target.value)}
            onBlur={() => {
              if (client !== getClientName(production)) onPatch({ clientName: client });
            }}
            placeholder="Client name"
            className="text-sm text-gray-500 bg-transparent border-none outline-none w-full placeholder-gray-300 -ml-1 px-1 mt-0.5 rounded-md focus:bg-amber-50/40"
          />
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <div className="relative">
              <button
                onClick={() => setShowStatus((v) => !v)}
                className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full cursor-pointer ${style.bg} ${style.text}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                {style.label}
                <ChevronDown size={12} />
              </button>
              {showStatus && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowStatus(false)} />
                  <div className="absolute top-full left-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg z-20 overflow-hidden w-48 py-1">
                    {(STATUS_OPTIONS ?? []).map((s: ProductionStatus) => {
                      const st = PRODUCTION_STATUS_STYLES[s];
                      return (
                        <button
                          key={s}
                          onClick={() => {
                            setShowStatus(false);
                            onPatch({ status: s });
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors text-left"
                        >
                          <span className={`w-2 h-2 rounded-full ${st.dot}`} />
                          {st.label}
                          {s === production.status && (
                            <Check size={13} className="ml-auto text-[#D4A853]" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
            {production.campaign && (
              <span className="text-xs text-gray-500">
                Campaign: <span className="font-medium text-gray-700">{production.campaign.title}</span>
              </span>
            )}
            {production.figmaUrl && (
              <a
                href={production.figmaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-[#D4A853] hover:underline"
              >
                Figma <ExternalLink size={11} />
              </a>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {saving && <span className="text-xs text-gray-400">Saving…</span>}
          {!saving && saved && (
            <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
              <Check size={12} /> Saved
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
