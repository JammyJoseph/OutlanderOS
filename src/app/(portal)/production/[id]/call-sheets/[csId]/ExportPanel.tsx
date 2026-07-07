"use client";

import { useState } from "react";
import { Edit2, Eye, FileDown, MessageSquareText, Link2, Check, Users, Briefcase } from "lucide-react";
import type { CallSheetViewData } from "./CallSheetDocument";
import { generateSMSSummary } from "./smsSummary";

type CopyKey = "sms" | "team" | "client";

// Step 3 of the share flow: a clean panel of export options — PDF, an SMS
// roundup, and the two live share links (full crew view + redacted client view).
export function ExportPanel({
  data,
  shareToken,
  clientShareToken,
  onBackToEditor,
  onBackToPreview,
  onPrint,
}: {
  data: CallSheetViewData;
  shareToken: string | null;
  clientShareToken: string | null;
  onBackToEditor: () => void;
  onBackToPreview: () => void;
  onPrint: () => void;
}) {
  const [copied, setCopied] = useState<CopyKey | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const teamUrl = shareToken ? `${origin}/call-sheet/${shareToken}` : "";
  const clientUrl = clientShareToken ? `${origin}/call-sheet/client/${clientShareToken}` : "";

  function flash(key: CopyKey) {
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000);
  }

  function copyText(text: string, key: CopyKey) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    flash(key);
  }

  const dateLabel = formatDate(data.shootDate);

  return (
    <div className="print:hidden">
      {/* Back navigation */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={onBackToEditor}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
        >
          <Edit2 size={14} /> Back to Editor
        </button>
        <button
          onClick={onBackToPreview}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
        >
          <Eye size={14} /> Back to Preview
        </button>
      </div>

      {/* Title */}
      <div className="mb-8">
        <h2 className="text-xs font-bold tracking-[0.15em] text-gray-400 dark:text-gray-500 uppercase mb-1">
          Export Call Sheet
        </h2>
        <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
          {data.shootTitle || data.productionTitle || "Call Sheet"}
          {dateLabel && (
            <span className="text-gray-400 dark:text-gray-500 font-normal"> — {dateLabel}</span>
          )}
        </p>
      </div>

      {/* Option cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 max-w-xl">
        <OptionCard
          icon={<FileDown size={20} />}
          title="PDF"
          subtitle="Download"
          onClick={onPrint}
        />
        <OptionCard
          icon={<MessageSquareText size={20} />}
          title="SMS"
          subtitle={copied === "sms" ? "Copied!" : "Copy summary"}
          active={copied === "sms"}
          onClick={() => copyText(generateSMSSummary(data, teamUrl || null), "sms")}
        />
        <OptionCard
          icon={<Users size={20} />}
          title="Team Link"
          subtitle={copied === "team" ? "Copied!" : "Copy full link"}
          active={copied === "team"}
          disabled={!teamUrl}
          onClick={() => copyText(teamUrl, "team")}
        />
        <OptionCard
          icon={<Briefcase size={20} />}
          title="Client Link"
          subtitle={copied === "client" ? "Copied!" : "Copy redacted link"}
          active={copied === "client"}
          disabled={!clientUrl}
          onClick={() => copyText(clientUrl, "client")}
        />
      </div>

      {/* Live link details */}
      <div className="max-w-xl mt-8 space-y-5">
        <LinkRow
          label="Team link"
          hint="Full view — crew contacts, talent details and deliverables."
          url={teamUrl}
          copied={copied === "team"}
          onCopy={() => copyText(teamUrl, "team")}
        />
        <LinkRow
          label="Client link"
          hint="Client view — contacts and deliverables hidden."
          url={clientUrl}
          copied={copied === "client"}
          onCopy={() => copyText(clientUrl, "client")}
        />
      </div>
    </div>
  );
}

function OptionCard({
  icon,
  title,
  subtitle,
  onClick,
  active,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-start gap-3 p-5 rounded-2xl border text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        active
          ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20"
          : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
      }`}
    >
      <span className={active ? "text-emerald-600 dark:text-emerald-400" : "text-[#A93B2E]"}>
        {active ? <Check size={20} /> : icon}
      </span>
      <span>
        <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</span>
        <span
          className={`block text-xs mt-0.5 ${
            active ? "text-emerald-600 dark:text-emerald-400" : "text-gray-500 dark:text-gray-400"
          }`}
        >
          {subtitle}
        </span>
      </span>
    </button>
  );
}

function LinkRow({
  label,
  hint,
  url,
  copied,
  onCopy,
}: {
  label: string;
  hint: string;
  url: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">{label}</label>
        <span className="text-[11px] text-gray-400 dark:text-gray-500">{hint}</span>
      </div>
      <div className="flex gap-2">
        <input
          readOnly
          value={url || "Generating link…"}
          className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 truncate"
        />
        <button
          onClick={onCopy}
          disabled={!url}
          className="flex items-center gap-1.5 bg-[#A93B2E] text-white px-3.5 py-2 rounded-xl text-sm font-medium shrink-0 disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          {copied ? <Check size={14} /> : <Link2 size={14} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

// "Wed 8 Jul 2026" — matches the export panel heading in the spec.
function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
