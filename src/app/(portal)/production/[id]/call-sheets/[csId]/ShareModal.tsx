"use client";

import { useState } from "react";
import { X, Link2, Check, Mail, Users, Briefcase, Send } from "lucide-react";

// Two-mode sharing: internal (full detail) vs client (redacted contact info).
export function ShareModal({
  onClose,
  shareToken,
  clientShareToken,
  shootTitle,
  shootDate,
}: {
  onClose: () => void;
  shareToken: string | null;
  clientShareToken: string | null;
  shootTitle: string;
  shootDate: string;
}) {
  const [mode, setMode] = useState<"internal" | "client">("internal");
  const [copied, setCopied] = useState(false);
  const [emails, setEmails] = useState("");

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const isClient = mode === "client";
  const token = isClient ? clientShareToken : shareToken;
  const url = token
    ? `${origin}/call-sheet/${isClient ? "client/" : ""}${token}`
    : "";

  function copy() {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function sendEmail() {
    if (!url) return;
    const to = emails
      .split(/[,;\s]+/)
      .map((e) => e.trim())
      .filter(Boolean)
      .join(",");
    const subject = encodeURIComponent(
      `Call Sheet — ${shootTitle || "Outlander Production"}${shootDate ? ` (${shootDate})` : ""}`
    );
    const body = encodeURIComponent(
      `Hi,\n\nPlease find the ${
        isClient ? "client" : "production"
      } call sheet for ${shootTitle || "the shoot"}${
        shootDate ? ` on ${shootDate}` : ""
      } here:\n\n${url}\n\n${
        isClient
          ? "This is the client version — production contact details are routed via Outlander."
          : "Please confirm receipt with your production contact."
      }\n\nThanks,\nOutlander`
    );
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">Share Call Sheet</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 dark:text-gray-500">
            <X size={16} />
          </button>
        </div>

        {/* Mode switch */}
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 m-5 mb-3">
          <ModeButton active={!isClient} onClick={() => setMode("internal")}>
            <Users size={13} /> Internal (full)
          </ModeButton>
          <ModeButton active={isClient} onClick={() => setMode("client")}>
            <Briefcase size={13} /> Client (redacted)
          </ModeButton>
        </div>

        <div className="px-5 pb-5">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            {isClient
              ? "Client version — production team phone numbers and emails are masked. Keeps location, call times, talent, schedule and safety info."
              : "Full version — every contact detail, phone and email. For the production and Outlander team."}
          </p>

          {!token ? (
            <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border border-amber-100 dark:border-amber-800 rounded-xl px-3.5 py-2.5">
              Publish the call sheet to generate the {isClient ? "client " : ""}share link.
            </p>
          ) : (
            <>
              {/* Copy link */}
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Share link</label>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={url}
                  className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 truncate"
                />
                <button
                  onClick={copy}
                  className="flex items-center gap-1.5 bg-[#ff4444] text-white px-3.5 py-2 rounded-xl text-sm font-medium shrink-0"
                >
                  {copied ? <Check size={14} /> : <Link2 size={14} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>

              {/* Email */}
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 mt-4">
                <Mail size={12} className="inline mr-1" /> Email to (comma-separated)
              </label>
              <div className="flex gap-2">
                <input
                  value={emails}
                  onChange={(e) => setEmails(e.target.value)}
                  placeholder="name@example.com, other@example.com"
                  className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff4444]/25 focus:border-[#ff4444]"
                />
                <button
                  onClick={sendEmail}
                  disabled={!emails.trim()}
                  className="flex items-center gap-1.5 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 px-3.5 py-2 rounded-xl text-sm font-medium shrink-0 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <Send size={14} /> Send
                </button>
              </div>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5">
                Opens your email client with a pre-filled message and the call sheet link.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ModeButton({
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
      className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        active ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
      }`}
    >
      <span className="flex items-center justify-center gap-1.5">{children}</span>
    </button>
  );
}
