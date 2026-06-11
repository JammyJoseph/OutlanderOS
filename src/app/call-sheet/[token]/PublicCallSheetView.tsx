"use client";

import { FileDown } from "lucide-react";
import {
  CallSheetDocument,
  type CallSheetViewData,
} from "@/app/(portal)/production/[id]/call-sheets/[csId]/CallSheetDocument";

// Read-only public view — clean white page, Outlander branding, no portal chrome.
export function PublicCallSheetView({ viewData }: { viewData: CallSheetViewData }) {
  return (
    <div className="min-h-screen bg-white" data-callsheet-print>
      <div className="max-w-4xl mx-auto px-6 py-8 print:px-0 print:py-0 print:max-w-none">
        <div className="flex items-center justify-between mb-6 print:hidden">
          <div>
            <p className="text-sm font-extrabold tracking-[0.3em] uppercase text-gray-900">
              Outlander
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Production call sheet · please confirm receipt with your contact
            </p>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <FileDown size={13} /> Download PDF
          </button>
        </div>

        <CallSheetDocument data={viewData} />

        <p className="mt-8 text-center text-[11px] text-gray-300 print:hidden">
          Outlander Magazine — confidential production document. Please don&apos;t forward
          this link outside the crew.
        </p>
      </div>
    </div>
  );
}
