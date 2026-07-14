"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Check, Mail, Plus } from "lucide-react";
import type { CallSheetViewData } from "./CallSheetDocument";
import type { ClientContactRef } from "./types";
import {
  buildMailto, clientRecipients, crewRecipients, emailBody, emailSubject,
  isValidEmail, type EmailAudience, type EmailRecipient,
} from "./emailShare";

// The second view of the share popup: pick who the sheet goes to, then hand off
// to the user's mail client. Nothing is sent from the portal — the button opens
// a draft with everyone in BCC and the share link in the body.
export function EmailSharePanel({
  data,
  audience,
  setAudience,
  teamUrl,
  clientUrl,
  clientContact,
  onBack,
}: {
  data: CallSheetViewData;
  audience: EmailAudience;
  setAudience: (a: EmailAudience) => void;
  teamUrl: string;
  clientUrl: string;
  clientContact: ClientContactRef | null;
  onBack: () => void;
}) {
  // Addresses typed in by hand, per audience — a client contact added to the
  // client draft shouldn't turn up in the crew one.
  const [extra, setExtra] = useState<Record<EmailAudience, string[]>>({ crew: [], client: [] });
  // Addresses the user has unticked, keyed by lowercased address.
  const [excluded, setExcluded] = useState<Record<EmailAudience, string[]>>({ crew: [], client: [] });
  const [draft, setDraft] = useState("");
  const [opened, setOpened] = useState(false);

  const fromSheet = useMemo(
    () => (audience === "crew" ? crewRecipients(data) : clientRecipients(data, clientContact)),
    [data, audience, clientContact]
  );

  const manual: EmailRecipient[] = extra[audience].map((email) => ({ email, name: "", role: "Added" }));
  const all = [...fromSheet, ...manual];
  const isOff = (email: string) => excluded[audience].includes(email.toLowerCase());
  const selected = all.filter((r) => !isOff(r.email));

  const link = audience === "crew" ? teamUrl : clientUrl;
  const subject = emailSubject(data);
  const body = emailBody(data, link, audience);

  function toggle(email: string) {
    const key = email.toLowerCase();
    setExcluded((prev) => ({
      ...prev,
      [audience]: prev[audience].includes(key)
        ? prev[audience].filter((e) => e !== key)
        : [...prev[audience], key],
    }));
  }

  function addDraft() {
    const value = draft.trim().replace(/,$/, "");
    if (!isValidEmail(value)) return;
    const key = value.toLowerCase();
    const known = all.some((r) => r.email.toLowerCase() === key);
    if (!known) setExtra((prev) => ({ ...prev, [audience]: [...prev[audience], value] }));
    // Re-tick an address that was previously unticked and is now re-added.
    setExcluded((prev) => ({ ...prev, [audience]: prev[audience].filter((e) => e !== key) }));
    setDraft("");
  }

  // Hand off to the mail client. A synthetic anchor click (rather than a
  // location assignment) keeps the current page put when the OS opens the mail
  // app, and is the path browsers handle most consistently for mailto:.
  function openDraft() {
    if (!selected.length) return;
    const href = buildMailto({ bcc: selected.map((r) => r.email), subject, body });
    const a = document.createElement("a");
    a.href = href;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setOpened(true);
    setTimeout(() => setOpened(false), 2500);
  }

  const noLink =
    !link &&
    `Publish the sheet to generate the ${audience === "crew" ? "team" : "client"} link — the draft will go out without one.`;

  return (
    <div className="p-5">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors mb-4"
      >
        <ArrowLeft size={13} /> Share options
      </button>

      {/* Who the draft goes to */}
      <div className="flex p-0.5 rounded-xl bg-gray-100 dark:bg-gray-800 mb-4">
        {(["crew", "client"] as EmailAudience[]).map((a) => (
          <button
            key={a}
            onClick={() => setAudience(a)}
            className={`flex-1 px-3 py-1.5 rounded-[10px] text-xs font-semibold transition-colors ${
              audience === a
                ? "bg-white dark:bg-gray-900 text-[#A93B2E] shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            }`}
          >
            {a === "crew" ? "Email Crew" : "Email Client"}
          </button>
        ))}
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2.5">
        {audience === "crew"
          ? "Crew and talent from the call sheet roster."
          : "The client contact on the deal, plus the agency team on the sheet."}{" "}
        Everyone goes in BCC.
      </p>

      {/* Recipients */}
      {all.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-500 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl px-3 py-4 text-center">
          {audience === "crew"
            ? "No crew or talent on this sheet have an email address yet."
            : "No client or agency email addresses on this deal yet."}{" "}
          Add one below.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
          {all.map((r) => {
            const off = isOff(r.email);
            return (
              <button
                key={r.email}
                onClick={() => toggle(r.email)}
                title={r.email}
                className={`inline-flex items-center gap-1.5 max-w-full px-2.5 py-1.5 rounded-lg border text-xs transition-colors ${
                  off
                    ? "border-gray-200 dark:border-gray-700 bg-transparent text-gray-400 dark:text-gray-500 line-through"
                    : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
              >
                <span className={`shrink-0 ${off ? "text-gray-300 dark:text-gray-600" : "text-[#A93B2E]"}`}>
                  {off ? <Plus size={11} /> : <Check size={11} />}
                </span>
                <span className="truncate">{r.name || r.email}</span>
                {r.role && (
                  <span className="text-gray-400 dark:text-gray-500 truncate">· {r.role}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Add an address by hand */}
      <div className="flex gap-2 mt-3">
        <input
          type="email"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addDraft();
            }
          }}
          placeholder="Add another email…"
          className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:border-gray-300 dark:focus:border-gray-600"
        />
        <button
          onClick={addDraft}
          disabled={!isValidEmail(draft)}
          className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus size={15} />
        </button>
      </div>

      {/* What the draft will say */}
      <div className="mt-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5">
        <p className="text-[11px] uppercase tracking-wide font-semibold text-gray-400 dark:text-gray-500">
          Subject
        </p>
        <p className="text-xs text-gray-700 dark:text-gray-300 mt-0.5 break-words">{subject}</p>
        <p className="text-[11px] uppercase tracking-wide font-semibold text-gray-400 dark:text-gray-500 mt-2.5">
          BCC
        </p>
        <p className="text-xs text-gray-700 dark:text-gray-300 mt-0.5">
          {selected.length} {selected.length === 1 ? "recipient" : "recipients"}
        </p>
      </div>

      {noLink && (
        <p className="text-xs text-amber-700 dark:text-amber-400 mt-2.5">{noLink}</p>
      )}

      <button
        onClick={openDraft}
        disabled={!selected.length}
        className="flex items-center justify-center gap-1.5 w-full mt-4 bg-[#A93B2E] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
      >
        {opened ? <Check size={15} /> : <Mail size={15} />}
        {opened ? "Draft opened in your email app" : "Open email draft"}
      </button>
      <p className="text-[11px] text-gray-400 dark:text-gray-500 text-center mt-2">
        Opens a draft in your email app — nothing is sent from here.
      </p>
    </div>
  );
}
