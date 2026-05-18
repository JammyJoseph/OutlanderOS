"use client";

import Link from "next/link";
import { ArrowLeft, Edit2, Loader2, Check, Share2, Printer } from "lucide-react";
import { CallSheetDocument, type CallSheetViewData } from "./CallSheetDocument";

export function FinalView({
  productionTitle,
  productionId,
  viewData,
  onRevert,
  saving,
  copied,
  onCopy,
}: {
  productionTitle: string;
  productionId: string;
  viewData: CallSheetViewData;
  onRevert: () => void;
  saving: boolean;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="min-h-screen bg-[#F9F9F7] print:bg-white">
      <div className="max-w-4xl mx-auto px-6 py-10 print:px-0 print:py-0 print:max-w-none">
        <div className="flex items-center justify-between mb-6 print:hidden">
          <Link
            href={`/production/${productionId}`}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft size={15} />
            Back to Project
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Printer size={13} /> Print
            </button>
            <button
              onClick={onRevert}
              disabled={saving}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-60"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Edit2 size={13} />}
              Back to Editor
            </button>
            <button
              onClick={onCopy}
              className="flex items-center gap-1.5 bg-[#D4A853] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#c49843] transition-colors shadow-sm"
            >
              {copied ? <Check size={13} /> : <Share2 size={13} />}
              {copied ? "Copied!" : "Share"}
            </button>
          </div>
        </div>

        <div className="mb-4 flex items-center gap-2 print:hidden">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
            Published
          </span>
          <span className="text-xs text-gray-400">{productionTitle}</span>
        </div>

        <CallSheetDocument data={viewData} />
      </div>
    </div>
  );
}
