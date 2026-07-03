"use client";

import { useState } from "react";
import { X, FileDown, Check } from "lucide-react";
import type { SectionKey } from "./types";
import { ALL_SECTIONS, allSectionsVisible } from "./types";

// Pre-print modal: choose which sections to include and whether to show contact
// details (unchecked = client/redacted version).
export function PdfExportModal({
  onClose,
  onExport,
}: {
  onClose: () => void;
  onExport: (sections: Record<SectionKey, boolean>, includeContacts: boolean) => void;
}) {
  const [sections, setSections] = useState<Record<SectionKey, boolean>>(allSectionsVisible());
  const [includeContacts, setIncludeContacts] = useState(true);

  function toggle(k: SectionKey) {
    setSections((s) => ({ ...s, [k]: !s[k] }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">Export PDF</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 dark:text-gray-500">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-3 overflow-y-auto">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Choose the sections to include.</p>
          <div className="space-y-1">
            {ALL_SECTIONS.map((s) => (
              <Row key={s.key} label={s.label} checked={sections[s.key]} onToggle={() => toggle(s.key)} />
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
            <Row
              label="Contact Details (phone / email)"
              checked={includeContacts}
              onToggle={() => setIncludeContacts((v) => !v)}
              hint="Uncheck for the client version — production contact details masked."
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={() => onExport(sections, includeContacts)}
            className="flex items-center gap-1.5 bg-[#ff4444] text-white px-4 py-2 rounded-xl text-sm font-medium"
          >
            <FileDown size={14} /> Export / Print
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  checked,
  onToggle,
  hint,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-start gap-2.5 w-full text-left px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
    >
      <span
        className={`mt-0.5 shrink-0 w-4 h-4 rounded border flex items-center justify-center ${
          checked ? "bg-[#ff4444] border-[#ff4444]" : "border-gray-300 dark:border-gray-600"
        }`}
      >
        {checked && <Check size={11} className="text-white" />}
      </span>
      <span>
        <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
        {hint && <span className="block text-[11px] text-gray-400 dark:text-gray-500">{hint}</span>}
      </span>
    </button>
  );
}
