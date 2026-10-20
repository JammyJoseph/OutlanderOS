"use client";

import { useState } from "react";
import Link from "next/link";
import { STRANDS, STRAND_LABELS, strandOf } from "@/lib/production-strand";
import { ChevronDown, Check, ExternalLink, Link2, Loader2, Wand2 } from "lucide-react";
import { pill } from "@/components/os";
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
  /** Opens the five-step call sheet wizard — the screen's one primary action. */
  onNewCallSheet: () => void;
}

// The top of a project: where it came from, its title, then one row of pill
// actions (redesign board 5.2). Title and client stay editable in place.
export default function ProjectHeader({ production, onPatch, saving, saved, onNewCallSheet }: Props) {
  const [showStatus, setShowStatus] = useState(false);
  const [title, setTitle] = useState(production.title);
  const [client, setClient] = useState(getClientName(production));
  const [copied, setCopied] = useState(false);
  const [linking, setLinking] = useState(false);
  const style =
    PRODUCTION_STATUS_STYLES[production.status] || PRODUCTION_STATUS_STYLES.DRAFT;
  // What the strand would be if nobody had set one — shown on the "Auto" option
  // so the derivation is visible rather than a black box.
  const derivedStrand = strandOf({
    billingType: production.billingType,
    type: production.type,
    campaignId: production.campaignId,
  });

  // Fetch (or create) an internal share link and copy it to the clipboard.
  async function copyInternalLink() {
    setLinking(true);
    try {
      const res = await fetch(`/api/productions/${production.id}/share-link`);
      const data = await res.json();
      if (res.ok && data.token) {
        const url = `${window.location.origin}/production/share/${data.token}`;
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } finally {
      setLinking(false);
    }
  }

  return (
    <section className="flex flex-col gap-5">
      <div className="min-w-0">
        <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-base text-muted-foreground">
          <label className="min-w-0">
            <span className="sr-only">Client</span>
            <input
              type="text"
              value={client}
              onChange={(e) => setClient(e.target.value)}
              onBlur={() => {
                if (client !== getClientName(production)) onPatch({ clientName: client });
              }}
              placeholder="Client name"
              size={Math.max(8, client.length + 1)}
              className="-ml-1 max-w-full rounded-md bg-transparent px-1 text-base text-muted-foreground outline-none placeholder:text-muted-foreground/60 hover:bg-surface focus:bg-surface"
            />
          </label>
          {production.campaign && production.campaignId && (
            <>
              <span aria-hidden>·</span>
              <Link
                href={`/commercial/deals/${production.campaignId}`}
                className="underline decoration-line underline-offset-4 hover:text-foreground hover:decoration-foreground"
              >
                {production.campaign.title} deal
              </Link>
            </>
          )}
          <span aria-hidden>·</span>
          <div className="relative">
            <button
              onClick={() => setShowStatus((v) => !v)}
              aria-haspopup="listbox"
              aria-expanded={showStatus}
              className="inline-flex h-7 items-center gap-1.5 rounded-full bg-surface px-3 text-xs font-semibold text-ink-2 transition-colors hover:bg-surface-2"
            >
              <span className={`size-2 rounded-full ${style.dot}`} />
              {style.label}
              <ChevronDown size={12} />
            </button>
            {showStatus && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowStatus(false)} />
                <div role="listbox" className="absolute left-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-2xl bg-background p-1.5 shadow-[0_12px_32px_rgba(11,18,32,0.14)] ring-1 ring-line">
                  {(STATUS_OPTIONS ?? []).map((s: ProductionStatus) => {
                    const st = PRODUCTION_STATUS_STYLES[s];
                    return (
                      <button
                        key={s}
                        role="option"
                        aria-selected={s === production.status}
                        onClick={() => {
                          setShowStatus(false);
                          onPatch({ status: s });
                        }}
                        className="flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 text-left text-[15px] text-foreground transition-colors hover:bg-surface"
                      >
                        <span className={`size-2 rounded-full ${st.dot}`} />
                        {st.label}
                        {s === production.status && <Check size={14} className="ml-auto" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
          <span
            role="status"
            className={`text-sm font-medium transition-opacity ${saving || saved ? "opacity-100" : "opacity-0"} ${saving ? "text-muted-foreground" : "text-ok"}`}
          >
            {saving ? "Saving…" : saved ? "Saved" : ""}
          </span>
        </div>
        <label className="block">
          <span className="sr-only">Project title</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              if (title !== production.title) onPatch({ title });
            }}
            placeholder="Untitled project"
            className="-ml-1 w-full rounded-lg bg-transparent px-1 text-[28px] font-semibold leading-[1.15] tracking-[-0.015em] outline-none placeholder:text-muted-foreground/50 hover:bg-surface focus:bg-surface sm:text-4xl"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <button onClick={onNewCallSheet} className={pill("primary")}>
          <Wand2 /> New call sheet
        </button>
        <button
          onClick={copyInternalLink}
          disabled={linking}
          title="Copy an internal link to share this project with Outlander staff"
          className={pill("secondary")}
        >
          {linking ? <Loader2 className="animate-spin" /> : copied ? <Check /> : <Link2 />}
          {copied ? "Link copied" : "Copy internal link"}
        </button>
        {production.figmaUrl && (
          <a href={production.figmaUrl} target="_blank" rel="noopener noreferrer" className={pill("outline")}>
            Figma <ExternalLink />
          </a>
        )}
        {/* Strand — which part of the business this belongs to, and how the
            Projects list groups it. Left on "Auto" the strand is worked out
            from the project's data; setting it here is the only way to reach
            White Label, since nothing in the data implies it. */}
        <label className="flex items-center">
          <span className="sr-only">Strand</span>
          <select
            value={production.strand ?? ""}
            onChange={(e) => onPatch({ strand: e.target.value })}
            className="h-11 cursor-pointer rounded-full bg-background px-4 text-[15px] font-semibold text-foreground shadow-[inset_0_0_0_1px_var(--field)] outline-none focus-visible:outline-2 focus-visible:outline-foreground"
            title="Which strand this project belongs to in the Projects list"
          >
            <option value="">Strand: Auto — {STRAND_LABELS[derivedStrand]}</option>
            {STRANDS.map((s) => (
              <option key={s.key} value={s.key}>
                Strand: {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}
