"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  Loader2,
  UserPlus,
  CheckCircle2,
  ExternalLink,
  Users,
  ScanLine,
  ListChecks,
  AlertTriangle,
  MapPin,
  Globe,
  Sparkles,
} from "lucide-react";
import { DIRECTORY_ACCENT } from "@/lib/directory";

const ACCENT = DIRECTORY_ACCENT;

function Instagram({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

type Confidence = "VERIFIED" | "LIKELY" | "UNVERIFIED";

interface ScanProfileResult {
  handle: string;
  name: string | null;
  bio: string | null;
  followers: number | null;
  profilePic: string | null;
  website: string | null;
  category: string | null;
  location: string | null;
  confidence: Confidence;
  taggedAccounts: string[];
  recentPosts?: { shortcode: string; imageUrl: string; caption?: string | null }[];
  source: string;
  ok: boolean;
  error?: string;
  cached?: boolean;
  existingContact?: { id: string; name: string } | null;
}

type CreditTier = "credited" | "likely" | "social";

interface CreditPerson {
  handle: string;
  role: string | null;
  category: string | null;
  mentionCount: number;
  posts: string[];
  confidence: Confidence;
  tier: CreditTier;
  bioMatched?: boolean;
}

interface CollaborationPair {
  a: string;
  b: string;
  count: number;
}

interface ScanCreditsResult {
  handle: string;
  credits: CreditPerson[];
  socialMentions?: CreditPerson[];
  collaborationPairs: CollaborationPair[];
  postsScanned: number;
  ok: boolean;
  error?: string;
  cached?: boolean;
}

interface BatchEntry {
  input: string;
  handle: string | null;
  ok: boolean;
  result?: ScanProfileResult;
  cached?: boolean;
  existingContact?: { id: string; name: string } | null;
  error?: string;
}

// Queue entry for the "Scan All credits" flow.
interface QueueItem {
  handle: string;
  role: string | null;
  status: "pending" | "scanning" | "done" | "failed" | "skipped";
  result?: ScanProfileResult;
  existingContact?: { id: string; name: string } | null;
}

const cardCls = "rounded-2xl border border-border bg-card p-5";
const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-[var(--ring)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20";
const labelCls =
  "block text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1";

function fmtCount(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

const CONFIDENCE_STYLE: Record<Confidence, string> = {
  VERIFIED: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  LIKELY: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  UNVERIFIED: "border-border bg-secondary text-gray-500 dark:text-gray-400",
};
const CONFIDENCE_LABEL: Record<Confidence, string> = {
  VERIFIED: "Verified",
  LIKELY: "Likely",
  UNVERIFIED: "Unverified",
};

export function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${CONFIDENCE_STYLE[confidence]}`}
    >
      <Sparkles size={9} /> {CONFIDENCE_LABEL[confidence]}
    </span>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────────

export default function ScannerPanel({ onChanged }: { onChanged?: () => void }) {
  const [tab, setTab] = useState<"single" | "batch">("single");
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1 w-fit">
        {([
          { key: "single", label: "Scan Profile", icon: ScanLine },
          { key: "batch", label: "Batch Scan", icon: ListChecks },
        ] as const).map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                active ? "text-black" : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              }`}
              style={active ? { backgroundColor: ACCENT } : undefined}
            >
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "single" ? (
        <SingleScanner showToast={showToast} onChanged={onChanged} />
      ) : (
        <BatchScanner showToast={showToast} onChanged={onChanged} />
      )}

      {toast && (
        <div className="fixed inset-x-0 bottom-24 z-50 flex justify-center px-4">
          <div className="rounded-xl border border-border bg-popover px-4 py-2.5 text-sm font-medium text-gray-900 dark:text-gray-100 shadow-xl">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Single profile scanner ───────────────────────────────────────────────────────

function SingleScanner({
  showToast,
  onChanged,
}: {
  showToast: (m: string) => void;
  onChanged?: () => void;
}) {
  const [input, setInput] = useState("");
  const [scanning, setScanning] = useState(false);
  const [profile, setProfile] = useState<ScanProfileResult | null>(null);
  const [adding, setAdding] = useState(false);
  const [addedId, setAddedId] = useState<string | null>(null);

  // Credits
  const [credits, setCredits] = useState<ScanCreditsResult | null>(null);
  const [scanningCredits, setScanningCredits] = useState(false);
  const [addingAllCredits, setAddingAllCredits] = useState(false);

  // Scan queue (Scan All)
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [queueRunning, setQueueRunning] = useState(false);

  // Whether the filtered-out social mentions (Tier 3) are expanded.
  const [showSocial, setShowSocial] = useState(false);

  async function scan() {
    if (!input.trim()) return;
    setScanning(true);
    setProfile(null);
    setCredits(null);
    setQueue([]);
    setAddedId(null);
    try {
      const res = await fetch("/api/directory/scan-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: input.trim() }),
      });
      const data: ScanProfileResult = await res.json();
      setProfile(data);
      if (data.existingContact) setAddedId(data.existingContact.id);
    } catch {
      setProfile({
        handle: input.trim(),
        name: null,
        bio: null,
        followers: null,
        profilePic: null,
        website: null,
        category: null,
        location: null,
        confidence: "UNVERIFIED",
        taggedAccounts: [],
        source: "none",
        ok: false,
        error: "Network error — couldn't reach the scanner.",
      });
    } finally {
      setScanning(false);
    }
  }

  async function addProfile() {
    if (!profile?.ok) return;
    setAdding(true);
    try {
      const res = await fetch("/api/directory/scan-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contacts: [profileToInput(profile)] }),
      });
      const data = await res.json();
      if (res.ok && data.imported?.[0]) {
        setAddedId(data.imported[0].id);
        showToast(data.created ? "Added to directory" : "Updated existing contact");
        onChanged?.();
      } else {
        showToast(data.error || "Couldn't add contact");
      }
    } catch {
      showToast("Couldn't add contact");
    } finally {
      setAdding(false);
    }
  }

  async function scanForCredits() {
    if (!profile?.handle) return;
    setScanningCredits(true);
    setCredits(null);
    try {
      const res = await fetch("/api/directory/scan-credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: profile.handle }),
      });
      const data: ScanCreditsResult = await res.json();
      setCredits(data);
    } catch {
      setCredits({
        handle: profile.handle,
        credits: [],
        collaborationPairs: [],
        postsScanned: 0,
        ok: false,
        error: "Network error — couldn't reach the scanner.",
      });
    } finally {
      setScanningCredits(false);
    }
  }

  // Queue each credited handle for profile scanning, 1 at a time (server paces).
  async function scanAllCredits() {
    if (!credits?.credits.length) return;
    const items: QueueItem[] = credits.credits.map((c) => ({
      handle: c.handle,
      role: c.role,
      status: "pending",
    }));
    setQueue(items);
    setQueueRunning(true);

    for (let i = 0; i < items.length; i++) {
      setQueue((prev) =>
        prev.map((it, idx) => (idx === i ? { ...it, status: "scanning" } : it))
      );
      try {
        const res = await fetch("/api/directory/scan-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ handle: items[i].handle }),
        });
        const data: ScanProfileResult = await res.json();
        setQueue((prev) =>
          prev.map((it, idx) =>
            idx === i
              ? {
                  ...it,
                  status: data.ok ? "done" : "failed",
                  result: data,
                  existingContact: data.existingContact ?? null,
                }
              : it
          )
        );
      } catch {
        setQueue((prev) =>
          prev.map((it, idx) => (idx === i ? { ...it, status: "failed" } : it))
        );
      }
    }
    setQueueRunning(false);
  }

  // Add every successfully-scanned queue item to the directory, plus the
  // collaboration links between everyone co-credited on this profile.
  async function addAllFromQueue() {
    const contacts = queue
      .filter((q) => q.status === "done" && q.result?.ok)
      .map((q) => profileToInput(q.result!));
    // Include the subject themselves so collaboration links resolve.
    if (profile?.ok) contacts.push(profileToInput(profile));
    if (contacts.length === 0) {
      showToast("Nothing to add yet");
      return;
    }
    try {
      const res = await fetch("/api/directory/scan-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contacts,
          collaborationPairs: credits?.collaborationPairs ?? [],
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(
          `Added ${data.created} new, updated ${data.merged}, ${data.collaborationsRecorded} links`
        );
        onChanged?.();
      } else {
        showToast(data.error || "Couldn't add contacts");
      }
    } catch {
      showToast("Couldn't add contacts");
    }
  }

  // One-click: import EVERY credited person from this profile's credit scan.
  // No per-profile re-scan needed — we add the handles directly. scan-import
  // dedups by handle (existing contacts are merged, never duplicated) and we
  // link each credited person to the subject profile as a collaborator.
  async function addAllFromCredits() {
    if (!credits?.credits.length || !profile?.ok) {
      showToast("Scan a profile's credits first");
      return;
    }
    setAddingAllCredits(true);
    try {
      const subjectHandle = profile.handle.toLowerCase();
      // The subject profile itself, plus every credited person (Tier 1 + Tier 2
      // only — credits.credits already excludes Tier 3 social mentions).
      const contacts = [
        profileToInput(profile),
        ...credits.credits.map((c) => ({
          handle: c.handle,
          category: c.category,
          confidence: c.confidence,
          scanSource: subjectHandle,
        })),
      ];
      // Link the subject to each credited person (they collaborated), alongside
      // the co-mention pairs the scan already surfaced.
      const subjectLinks = credits.credits.map((c) => ({
        a: subjectHandle,
        b: c.handle,
        count: Math.max(1, c.mentionCount || 1),
      }));
      const collaborationPairs = [...subjectLinks, ...(credits.collaborationPairs ?? [])];

      const res = await fetch("/api/directory/scan-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contacts, collaborationPairs }),
      });
      const data = await res.json();
      if (res.ok) {
        // Report new vs. existing, excluding the subject profile from the tally.
        const imported: { handle: string; created: boolean }[] = Array.isArray(data.imported)
          ? data.imported
          : [];
        const people = imported.filter((i) => i.handle !== subjectHandle);
        const newCount = people.filter((i) => i.created).length;
        const linkedCount = people.filter((i) => !i.created).length;
        showToast(
          `Added ${newCount} new contact${newCount === 1 ? "" : "s"}, linked ${linkedCount} existing collaborator${linkedCount === 1 ? "" : "s"}`
        );
        onChanged?.();
      } else {
        showToast(data.error || "Couldn't add contacts");
      }
    } catch {
      showToast("Couldn't add contacts");
    } finally {
      setAddingAllCredits(false);
    }
  }

  const creditsByRole = useMemo(() => groupByRole(credits?.credits ?? []), [credits]);
  const socialMentions = credits?.socialMentions ?? [];
  const queueDone = queue.filter((q) => q.status === "done" || q.status === "failed").length;

  return (
    <div className="space-y-5">
      {/* Search bar */}
      <div className={cardCls}>
        <label className={labelCls}>Instagram profile</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Instagram
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400"
            />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  scan();
                }
              }}
              placeholder="@handle or instagram.com/handle"
              className={`${inputCls} pl-9`}
            />
          </div>
          <button
            onClick={scan}
            disabled={scanning || !input.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: ACCENT }}
          >
            {scanning ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
            {scanning ? "Scanning…" : "Scan"}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
          Public profiles only · results cached for 24h · scraping is rate-limited.
        </p>
      </div>

      {/* Failure / fallback */}
      {profile && !profile.ok && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-600 dark:text-amber-400">
            <AlertTriangle size={15} /> {profile.error || "Couldn't access this profile"}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Instagram may be blocking this scan. You can still add{" "}
            <span className="font-medium text-gray-700 dark:text-gray-300">@{profile.handle}</span> manually
            from the Add Contact button, or try again later.
          </p>
        </div>
      )}

      {/* Profile result */}
      {profile?.ok && (
        <div className={cardCls}>
          <div className="flex flex-wrap items-start gap-4">
            {profile.profilePic ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.profilePic}
                alt={profile.name || profile.handle}
                className="h-20 w-20 shrink-0 rounded-full border border-border object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-secondary text-lg font-semibold text-gray-500 dark:text-gray-400">
                {(profile.name || profile.handle).slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {profile.name || `@${profile.handle}`}
                </h3>
                <ConfidenceBadge confidence={profile.confidence} />
                {profile.cached && (
                  <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:text-gray-400">
                    cached
                  </span>
                )}
              </div>
              <a
                href={`https://www.instagram.com/${profile.handle}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-[#dc2743] hover:underline"
              >
                <Instagram size={11} /> @{profile.handle}
              </a>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                <span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {fmtCount(profile.followers)}
                  </span>{" "}
                  followers
                </span>
                {profile.category && (
                  <span className="inline-flex items-center rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {profile.category}
                  </span>
                )}
                {profile.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={11} /> {profile.location}
                  </span>
                )}
                {profile.website && (
                  <a
                    href={profile.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                  >
                    <Globe size={11} /> {profile.website.replace(/^https?:\/\//, "")}
                  </a>
                )}
              </div>
              {profile.bio && (
                <p className="mt-2 whitespace-pre-line text-sm text-gray-600 dark:text-gray-400">{profile.bio}</p>
              )}
              {profile.taggedAccounts.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Tagged
                  </span>
                  {profile.taggedAccounts.slice(0, 12).map((h) => (
                    <a
                      key={h}
                      href={`https://www.instagram.com/${h}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[11px] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                    >
                      @{h}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
            {addedId ? (
              <Link
                href={`/directory/${addedId}`}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400"
              >
                <CheckCircle2 size={15} /> In Directory — view
              </Link>
            ) : (
              <button
                onClick={addProfile}
                disabled={adding}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: ACCENT }}
              >
                {adding ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
                Add to Directory
              </button>
            )}
            <button
              onClick={scanForCredits}
              disabled={scanningCredits}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:border-[var(--ring)] disabled:opacity-50"
            >
              {scanningCredits ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Users size={15} />
              )}
              Scan Credits
            </button>
          </div>
        </div>
      )}

      {/* Credits */}
      {credits && !credits.ok && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <AlertTriangle size={15} className="text-amber-500 dark:text-amber-400" />
            {credits.error || "No credits found."}
          </p>
        </div>
      )}

      {credits?.ok && (
        <div className={cardCls}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                <Users size={15} style={{ color: ACCENT }} /> Credits
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {credits.credits.length} people across {credits.postsScanned} post
                {credits.postsScanned === 1 ? "" : "s"}
              </p>
            </div>
            {credits.credits.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={addAllFromCredits}
                  disabled={addingAllCredits || queueRunning}
                  className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: ACCENT }}
                  title="Import every credited person — dedupes against the directory and links them to this profile"
                >
                  {addingAllCredits ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <UserPlus size={14} />
                  )}
                  Add All to Directory
                </button>
                <button
                  onClick={scanAllCredits}
                  disabled={queueRunning || addingAllCredits}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:border-[var(--ring)] disabled:opacity-50"
                  title="Scrape each credited person's profile to enrich them before adding"
                >
                  {queueRunning ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <ScanLine size={14} />
                  )}
                  Scan All
                </button>
              </div>
            )}
          </div>

          {credits.credits.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              No @-credits detected in this profile&apos;s captions.
            </p>
          ) : (
            <div className="space-y-4">
              {creditsByRole.map(({ role, people }) => (
                <div key={role}>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {role}
                  </p>
                  <div className="overflow-hidden rounded-lg border border-border">
                    {people.map((p, i) => (
                      <CreditRow
                        key={p.handle}
                        person={p}
                        last={i === people.length - 1}
                        subjectHandle={credits.handle}
                        subjectInput={profile?.ok ? profileToInput(profile) : null}
                        showToast={showToast}
                        onChanged={onChanged}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tier 3 — social mentions filtered out of the credit list. Hidden by
              default; a user can expand and add any individually (opt-in). */}
          {socialMentions.length > 0 && (
            <div className="mt-5 rounded-xl border border-border bg-background">
              <button
                onClick={() => setShowSocial((s) => !s)}
                className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400">
                  <AlertTriangle size={14} className="text-gray-400 dark:text-gray-500" />
                  {socialMentions.length} social mention
                  {socialMentions.length === 1 ? "" : "s"} filtered out
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {showSocial ? "Hide" : "Show"}
                </span>
              </button>
              {showSocial && (
                <div className="border-t border-border px-4 pb-4 pt-3">
                  <p className="mb-2 text-[11px] text-gray-500 dark:text-gray-400">
                    No production role in the caption and no matching bio — likely
                    friends, brands, or venues. Not included in “Add All”. Add any
                    you know are crew.
                  </p>
                  <div className="overflow-hidden rounded-lg border border-border">
                    {socialMentions.map((p, i) => (
                      <CreditRow
                        key={p.handle}
                        person={p}
                        last={i === socialMentions.length - 1}
                        subjectHandle={credits.handle}
                        subjectInput={profile?.ok ? profileToInput(profile) : null}
                        showToast={showToast}
                        onChanged={onChanged}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Scan queue progress */}
          {queue.length > 0 && (
            <div className="mt-5 rounded-xl border border-border bg-background p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {queueRunning
                    ? `Scanning ${Math.min(queueDone + 1, queue.length)}/${queue.length}…`
                    : `Scanned ${queueDone}/${queue.length}`}
                </p>
                {!queueRunning && (
                  <button
                    onClick={addAllFromQueue}
                    className="inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold text-black"
                    style={{ backgroundColor: ACCENT }}
                  >
                    <UserPlus size={13} /> Add All to Directory
                  </button>
                )}
              </div>
              <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${(queueDone / queue.length) * 100}%`,
                    backgroundColor: ACCENT,
                  }}
                />
              </div>
              <div className="space-y-1">
                {queue.map((q) => (
                  <div
                    key={q.handle}
                    className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400"
                  >
                    <span className="font-medium text-gray-700 dark:text-gray-300">@{q.handle}</span>
                    <QueueStatus item={q} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function QueueStatus({ item }: { item: QueueItem }) {
  if (item.status === "scanning")
    return (
      <span className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400">
        <Loader2 size={11} className="animate-spin" /> scanning
      </span>
    );
  if (item.status === "pending") return <span className="text-gray-400 dark:text-gray-500">queued</span>;
  if (item.status === "failed")
    return <span className="text-amber-600 dark:text-amber-400">couldn&apos;t access</span>;
  if (item.status === "done")
    return (
      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 size={11} />
        {item.result?.name || "scanned"}
      </span>
    );
  return null;
}

function CreditRow({
  person,
  last,
  subjectHandle,
  subjectInput,
  showToast,
  onChanged,
}: {
  person: CreditPerson;
  last: boolean;
  subjectHandle?: string | null;
  subjectInput?: ReturnType<typeof profileToInput> | null;
  showToast: (m: string) => void;
  onChanged?: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  async function add() {
    setAdding(true);
    try {
      // Include the subject profile so the collaboration link can resolve both
      // ends; scan-import dedups by handle so neither side is duplicated.
      const contacts: unknown[] = [
        {
          handle: person.handle,
          category: person.category,
          confidence: person.confidence,
          scanSource: subjectHandle ?? undefined,
        },
      ];
      if (subjectInput) contacts.push(subjectInput);
      const collaborationPairs =
        subjectHandle && subjectHandle.toLowerCase() !== person.handle.toLowerCase()
          ? [{ a: subjectHandle, b: person.handle, count: Math.max(1, person.mentionCount || 1) }]
          : [];

      const res = await fetch("/api/directory/scan-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contacts, collaborationPairs }),
      });
      const data = await res.json();
      if (res.ok) {
        setAdded(true);
        // Did this person already exist? Read it back from the import report.
        const row = Array.isArray(data.imported)
          ? (data.imported as { handle: string; created: boolean }[]).find(
              (i) => i.handle === person.handle.toLowerCase()
            )
          : undefined;
        const created = row ? row.created : (data.created ?? 0) > 0;
        showToast(
          created
            ? `Added @${person.handle}`
            : `@${person.handle} already in Directory — added as collaborator`
        );
        onChanged?.();
      } else {
        showToast(data.error || "Couldn't add");
      }
    } catch {
      showToast("Couldn't add");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div
      className={`flex items-center justify-between gap-2 px-3 py-2.5 ${
        last ? "" : "border-b border-border"
      }`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <a
          href={`https://www.instagram.com/${person.handle}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-[#dc2743]"
        >
          @{person.handle}
        </a>
        <ConfidenceBadge confidence={person.confidence} />
        <span className="hidden text-[11px] text-gray-500 dark:text-gray-400 sm:inline">
          {person.mentionCount}× {person.tier === "social" ? "mentioned" : "credited"}
          {person.bioMatched ? " · bio" : ""}
        </span>
      </div>
      {added ? (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 size={13} /> Added
        </span>
      ) : (
        <button
          onClick={add}
          disabled={adding}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:border-[var(--ring)] hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-50"
        >
          {adding ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} />}
          Add
        </button>
      )}
    </div>
  );
}

// ── Batch scanner ────────────────────────────────────────────────────────────────

function BatchScanner({
  showToast,
  onChanged,
}: {
  showToast: (m: string) => void;
  onChanged?: () => void;
}) {
  const [text, setText] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [results, setResults] = useState<BatchEntry[]>([]);
  const [addingAll, setAddingAll] = useState(false);

  const handles = useMemo(
    () =>
      text
        .split(/[\n,]/)
        .map((h) => h.trim())
        .filter(Boolean),
    [text]
  );

  async function run() {
    if (handles.length === 0) return;
    setRunning(true);
    setResults([]);
    setProgress({ done: 0, total: handles.length });

    // Scan one at a time so we can show live progress and respect rate limits.
    const collected: BatchEntry[] = [];
    for (let i = 0; i < handles.length; i++) {
      try {
        const res = await fetch("/api/directory/batch-scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ handles: [handles[i]] }),
        });
        const data = await res.json();
        if (data.results?.[0]) collected.push(data.results[0]);
      } catch {
        collected.push({
          input: handles[i],
          handle: null,
          ok: false,
          error: "Network error",
        });
      }
      setResults([...collected]);
      setProgress({ done: i + 1, total: handles.length });
    }
    setRunning(false);
  }

  async function addAll() {
    const contacts = results
      .filter((r) => r.ok && r.result?.ok && !r.existingContact)
      .map((r) => profileToInput(r.result!));
    if (contacts.length === 0) {
      showToast("Nothing new to add");
      return;
    }
    setAddingAll(true);
    try {
      const res = await fetch("/api/directory/scan-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contacts }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Added ${data.created} new, updated ${data.merged}`);
        onChanged?.();
        // Refresh existing markers
        setResults((prev) =>
          prev.map((r) =>
            r.result?.ok
              ? { ...r, existingContact: r.existingContact ?? { id: "", name: r.result.name || r.handle || "" } }
              : r
          )
        );
      } else {
        showToast(data.error || "Couldn't add contacts");
      }
    } catch {
      showToast("Couldn't add contacts");
    } finally {
      setAddingAll(false);
    }
  }

  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  const addable = results.filter((r) => r.ok && r.result?.ok && !r.existingContact).length;

  return (
    <div className="space-y-5">
      <div className={cardCls}>
        <label className={labelCls}>Instagram handles (one per line)</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"@nadia.photo\n@studio.knot\ninstagram.com/lux.casting"}
          className={`${inputCls} min-h-[140px] font-mono text-xs`}
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            {handles.length} handle{handles.length === 1 ? "" : "s"} · max 30 · ~3s each
          </p>
          <button
            onClick={run}
            disabled={running || handles.length === 0}
            className="inline-flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: ACCENT }}
          >
            {running ? <Loader2 size={15} className="animate-spin" /> : <ScanLine size={15} />}
            {running ? "Scanning…" : "Batch Scan"}
          </button>
        </div>
      </div>

      {progress && (
        <div className={cardCls}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {running
                ? `Scanning ${progress.done}/${progress.total}…`
                : `Done — ${succeeded} ok, ${failed} failed`}
            </p>
            {!running && addable > 0 && (
              <button
                onClick={addAll}
                disabled={addingAll}
                className="inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold text-black disabled:opacity-50"
                style={{ backgroundColor: ACCENT }}
              >
                {addingAll ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <UserPlus size={13} />
                )}
                Add All to Directory ({addable})
              </button>
            )}
          </div>
          <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${(progress.done / progress.total) * 100}%`,
                backgroundColor: ACCENT,
              }}
            />
          </div>
          <div className="overflow-hidden rounded-lg border border-border">
            {results.map((r, i) => (
              <div
                key={`${r.input}-${i}`}
                className={`flex items-center justify-between gap-3 px-3 py-2.5 ${
                  i === results.length - 1 ? "" : "border-b border-border"
                }`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  {r.result?.profilePic ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.result.profilePic}
                      alt=""
                      className="h-7 w-7 shrink-0 rounded-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold text-gray-500 dark:text-gray-400">
                      {(r.handle || r.input).slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                      {r.result?.name || `@${r.handle || r.input}`}
                    </p>
                    {r.handle && <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">@{r.handle}</p>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {r.ok && r.result ? (
                    <>
                      <ConfidenceBadge confidence={r.result.confidence} />
                      {r.existingContact ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                          <CheckCircle2 size={12} /> in directory
                        </span>
                      ) : (
                        <span className="text-[11px] text-gray-400 dark:text-gray-500">new</span>
                      )}
                    </>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                      <AlertTriangle size={12} /> {r.error || "failed"}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── helpers ─────────────────────────────────────────────────────────────────────

function profileToInput(p: ScanProfileResult) {
  return {
    handle: p.handle,
    name: p.name,
    bio: p.bio,
    category: p.category,
    location: p.location,
    website: p.website,
    followers: p.followers,
    profilePic: p.profilePic,
    recentPosts: p.recentPosts ?? [],
    confidence: p.confidence,
  };
}

function groupByRole(credits: CreditPerson[]): { role: string; people: CreditPerson[] }[] {
  const map = new Map<string, CreditPerson[]>();
  for (const c of credits) {
    const role = c.role || "Mentioned";
    if (!map.has(role)) map.set(role, []);
    map.get(role)!.push(c);
  }
  // Stable, with role-tagged groups before the generic "Mentioned" bucket.
  return [...map.entries()]
    .sort((a, b) => {
      if (a[0] === "Mentioned") return 1;
      if (b[0] === "Mentioned") return -1;
      return a[0].localeCompare(b[0]);
    })
    .map(([role, people]) => ({ role, people }));
}
