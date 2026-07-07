"use client";

import { useState } from "react";
import {
  Edit2, FileDown, MessageSquareText, Link2, Check, Users, Briefcase, Mail, Send,
} from "lucide-react";
import { CallSheetDocument, type CallSheetViewData } from "./CallSheetDocument";
import { allSectionsVisible } from "./types";
import { generateSMSSummary } from "./smsSummary";

type CopyKey = "sms" | "team" | "client";

// The distribution portal — one screen with every share/export option plus a
// live preview of the call sheet below. Reached from Save & Export.
export function ExportPanel({
  data,
  shareToken,
  clientShareToken,
  onBackToEditor,
}: {
  data: CallSheetViewData;
  shareToken: string | null;
  clientShareToken: string | null;
  onBackToEditor: () => void;
}) {
  const [copied, setCopied] = useState<CopyKey | null>(null);
  const [emailMode, setEmailMode] = useState<"team" | "client">("team");
  const [emails, setEmails] = useState("");

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

  function printPdf() {
    window.print();
  }

  // Opens the user's mail client with the chosen link pre-filled (mirrors the
  // old ShareModal behaviour).
  function sendEmail() {
    const url = emailMode === "client" ? clientUrl : teamUrl;
    if (!url) return;
    const to = emails
      .split(/[,;\s]+/)
      .map((e) => e.trim())
      .filter(Boolean)
      .join(",");
    const label = data.shootTitle || data.productionTitle || "the shoot";
    const dateLabel = formatDate(data.shootDate);
    const subject = encodeURIComponent(
      `Call Sheet — ${data.shootTitle || "Outlander Production"}${dateLabel ? ` (${dateLabel})` : ""}`
    );
    const body = encodeURIComponent(
      `Hi,\n\nPlease find the ${
        emailMode === "client" ? "client" : "production"
      } call sheet for ${label}${dateLabel ? ` on ${dateLabel}` : ""} here:\n\n${url}\n\n${
        emailMode === "client"
          ? "This is the client version — production contact details are routed via Outlander."
          : "Please confirm receipt with your production contact."
      }\n\nThanks,\nOutlander`
    );
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
  }

  const dateLabel = formatDate(data.shootDate);

  return (
    <div>
      {/* ── Controls (hidden in print) ─────────────────────────────────── */}
      <div className="print:hidden">
        {/* Back */}
        <button
          onClick={onBackToEditor}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors mb-8"
        >
          <Edit2 size={14} /> Back to Editor
        </button>

        {/* Heading */}
        <div className="mb-8">
          <h2 className="text-xs font-bold tracking-[0.15em] text-gray-400 dark:text-gray-500 uppercase mb-1">
            Distribute Call Sheet
          </h2>
          <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
            {data.shootTitle || data.productionTitle || "Call Sheet"}
            {dateLabel && (
              <span className="text-gray-400 dark:text-gray-500 font-normal"> — {dateLabel}</span>
            )}
          </p>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <OptionCard
            icon={<FileDown size={20} />}
            title="PDF"
            subtitle="Download"
            onClick={printPdf}
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
            subtitle={copied === "client" ? "Copied!" : "Copy redacted"}
            active={copied === "client"}
            disabled={!clientUrl}
            onClick={() => copyText(clientUrl, "client")}
          />
        </div>

        {/* Share links + email — one panel */}
        <div className="mt-6 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
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

          {/* Email send */}
          <div className="p-4">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2.5">
              <Mail size={13} /> Email the call sheet
            </label>
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 mb-2.5 w-fit">
              <ToggleButton active={emailMode === "team"} onClick={() => setEmailMode("team")}>
                <Users size={12} /> Team
              </ToggleButton>
              <ToggleButton active={emailMode === "client"} onClick={() => setEmailMode("client")}>
                <Briefcase size={12} /> Client
              </ToggleButton>
            </div>
            <div className="flex gap-2">
              <input
                value={emails}
                onChange={(e) => setEmails(e.target.value)}
                placeholder="name@example.com, other@example.com"
                className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#A93B2E]/25 focus:border-[#A93B2E]"
              />
              <button
                onClick={sendEmail}
                disabled={!(emailMode === "client" ? clientUrl : teamUrl)}
                className="flex items-center gap-1.5 bg-[#A93B2E] text-white px-4 py-2 rounded-xl text-sm font-medium shrink-0 disabled:opacity-40 hover:opacity-90 transition-opacity"
              >
                <Send size={14} /> Send
              </button>
            </div>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5">
              Opens your email app with the {emailMode === "client" ? "redacted client" : "full team"} link
              pre-filled.
            </p>
          </div>
        </div>

        {/* Preview label */}
        <div className="mt-10 mb-3 flex items-center gap-2">
          <span className="text-xs font-bold tracking-[0.12em] text-gray-400 dark:text-gray-500 uppercase">
            Preview
          </span>
          <span className="h-px flex-1 bg-gray-100 dark:bg-gray-800" />
        </div>
      </div>

      {/* ── Live document — visible preview AND the print target ────────── */}
      <CallSheetDocument data={data} sections={allSectionsVisible()} redacted={false} />
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
      className={`flex flex-col items-start gap-3 p-4 rounded-2xl border text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
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
    <div className="p-4">
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">{label}</label>
        <span className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{hint}</span>
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

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
        active
          ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm"
          : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
      }`}
    >
      {children}
    </button>
  );
}

// "Wed 8 Jul 2026" — short weekday + day + month + year.
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
