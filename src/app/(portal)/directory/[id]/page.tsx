"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Star,
  Loader2,
  Mail,
  Phone,
  MapPin,
  Building2,
  ExternalLink,
  Plus,
  X,
  Trash2,
  Briefcase,
  Film,
  Check,
  Network as NetworkIcon,
  Users,
  Sparkles,
} from "lucide-react";
import { DIRECTORY_ACCENT } from "@/lib/directory";
import { isValidUrl } from "@/lib/validation";
import { ErrorState } from "@/components/ui/error-state";
import { igHandle } from "@/lib/directory-utils";
import { InstagramIcon as Instagram } from "@/components/icons/InstagramIcon";

const ACCENT = DIRECTORY_ACCENT;

interface PortfolioLink {
  title: string;
  url: string;
}
interface Collaboration {
  productionId: string;
  productionTitle: string;
  role: string;
  source: "crew" | "team";
}
interface NetworkLink {
  handle: string;
  count: number;
  role: string | null;
  contactId: string | null;
  contactName: string | null;
}
interface ContactDetail {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  role: string | null;
  category: string;
  tags: string[];
  instagram: string | null;
  website: string | null;
  location: string | null;
  rating: number | null;
  isFavourite?: boolean;
  notes: string | null;
  portfolioLinks: PortfolioLink[];
  isRadar: boolean;
  createdAt: string;
  collaborations: Collaboration[];
  network?: NetworkLink[];
  source?: string | null;
  confidence?: "VERIFIED" | "LIKELY" | "UNVERIFIED" | null;
  followers?: number | null;
  profilePic?: string | null;
  creator?: { id: string; name: string } | null;
}

const CONFIDENCE_STYLE: Record<string, string> = {
  VERIFIED: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  LIKELY: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  UNVERIFIED: "border-border bg-secondary text-gray-500 dark:text-gray-400",
};
const CONFIDENCE_LABEL: Record<string, string> = {
  VERIFIED: "Verified",
  LIKELY: "Likely",
  UNVERIFIED: "Unverified",
};

const cardCls = "rounded-2xl border border-border bg-card p-5";
const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-[var(--ring)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20";
const labelCls =
  "block text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2";

function Stars({
  rating,
  onChange,
  size = 22,
}: {
  rating: number | null;
  onChange?: (r: number) => void;
  size?: number;
}) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange?.(i === rating ? 0 : i)}
          className={onChange ? "cursor-pointer" : "cursor-default"}
          title={`${i} star${i > 1 ? "s" : ""}`}
        >
          <Star
            size={size}
            className={
              i <= (rating ?? 0)
                ? "fill-[#9C7C2E] text-[#9C7C2E] dark:fill-[#C9A44A] dark:text-[#C9A44A]"
                : "text-gray-300 dark:text-gray-600 hover:text-gray-400 dark:hover:text-gray-500"
            }
          />
        </button>
      ))}
    </div>
  );
}

export default function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [contact, setContact] = useState<ContactDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    setNotFound(false);
    try {
      const res = await fetch(`/api/contacts/${id}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) {
        setLoadError(true);
        return;
      }
      const data = await res.json();
      setContact({
        ...data,
        tags: Array.isArray(data.tags) ? data.tags : [],
        portfolioLinks: Array.isArray(data.portfolioLinks) ? data.portfolioLinks : [],
        collaborations: Array.isArray(data.collaborations) ? data.collaborations : [],
        network: Array.isArray(data.network) ? data.network : [],
      });
    } catch {
      // Network / parse failure — show a retry instead of spinning forever.
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const patch = useCallback(
    async (body: Partial<ContactDetail>) => {
      // optimistic
      setContact((c) => (c ? { ...c, ...body } : c));
      await fetch(`/api/contacts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    },
    [id]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="animate-spin text-gray-600 dark:text-gray-400" size={24} />
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="px-6 py-20">
        <ErrorState
          title="Couldn't load this contact"
          message="Something went wrong fetching this contact. Check your connection and try again."
          onRetry={load}
        />
        <div className="mt-4 text-center">
          <Link href="/directory" className="text-sm" style={{ color: ACCENT }}>
            ← Back to directory
          </Link>
        </div>
      </div>
    );
  }
  if (notFound || !contact) {
    return (
      <div className="px-6 py-20 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">This contact could not be found.</p>
        <Link href="/directory" className="mt-4 inline-block text-sm" style={{ color: ACCENT }}>
          ← Back to directory
        </Link>
      </div>
    );
  }

  const handle = igHandle(contact.instagram);

  return (
    <div className="min-h-full px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/directory"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
        >
          <ArrowLeft size={15} /> Back to directory
        </Link>

        {/* Header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <button
                onClick={() => patch({ isFavourite: !contact.isFavourite })}
                title={contact.isFavourite ? "Remove from favourites" : "Add to favourites"}
                aria-pressed={contact.isFavourite}
                className="shrink-0"
              >
                <Star
                  size={24}
                  className={
                    contact.isFavourite
                      ? "fill-[#9C7C2E] text-[#9C7C2E] dark:fill-[#C9A44A] dark:text-[#C9A44A]"
                      : "text-gray-400 dark:text-gray-500 hover:text-[#9C7C2E] dark:hover:text-[#C9A44A]"
                  }
                />
              </button>
              <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                {contact.name}
              </h1>
              <span className="inline-flex items-center rounded-full border border-border bg-secondary px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                {contact.category}
              </span>
              {contact.source === "instagram_scan" && contact.confidence && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    CONFIDENCE_STYLE[contact.confidence] ?? CONFIDENCE_STYLE.UNVERIFIED
                  }`}
                  title="Scanned from Instagram"
                >
                  <Sparkles size={9} />{" "}
                  {CONFIDENCE_LABEL[contact.confidence] ?? contact.confidence}
                </span>
              )}
            </div>
            {(contact.role || contact.company) && (
              <p className="mt-1 text-base text-gray-500 dark:text-gray-400">
                {[contact.role, contact.company].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          <Stars rating={contact.rating} onChange={(r) => patch({ rating: r || null })} />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Left / main column */}
          <div className="space-y-5 lg:col-span-2">
            {/* Contact info */}
            <div className={cardCls}>
              <h2 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">Contact details</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <InfoRow icon={<Mail size={14} />} label="Email">
                  {contact.email ? (
                    <a href={`mailto:${contact.email}`} className="hover:text-gray-900 dark:hover:text-gray-100">
                      {contact.email}
                    </a>
                  ) : (
                    <Muted />
                  )}
                </InfoRow>
                <InfoRow icon={<Phone size={14} />} label="Phone">
                  {contact.phone ? (
                    <a href={`tel:${contact.phone}`} className="hover:text-gray-900 dark:hover:text-gray-100">
                      {contact.phone}
                    </a>
                  ) : (
                    <Muted />
                  )}
                </InfoRow>
                <InfoRow icon={<Building2 size={14} />} label="Company">
                  {contact.company || <Muted />}
                </InfoRow>
                <InfoRow icon={<MapPin size={14} />} label="Location">
                  {contact.location || <Muted />}
                </InfoRow>
                <InfoRow icon={<ExternalLink size={14} />} label="Website">
                  {contact.website ? (
                    <a
                      href={contact.website.startsWith("http") ? contact.website : `https://${contact.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate hover:text-gray-900 dark:hover:text-gray-100"
                    >
                      {contact.website}
                    </a>
                  ) : (
                    <Muted />
                  )}
                </InfoRow>
              </div>
            </div>

            {/* Tags */}
            <div className={cardCls}>
              <TagEditor tags={contact.tags} onChange={(tags) => patch({ tags })} />
            </div>

            {/* Notes */}
            <div className={cardCls}>
              <NotesEditor notes={contact.notes ?? ""} onSave={(notes) => patch({ notes: notes || null })} />
            </div>

            {/* Portfolio */}
            <div className={cardCls}>
              <PortfolioEditor
                links={contact.portfolioLinks}
                onChange={(portfolioLinks) => patch({ portfolioLinks })}
              />
            </div>

            {/* Collaboration history */}
            <div className={cardCls}>
              <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                <Film size={15} style={{ color: ACCENT }} /> Collaboration history
              </h2>
              {contact.collaborations.length === 0 ? (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  No productions on record yet. When {contact.name.split(" ")[0]} is added to a
                  production team or call sheet, it&apos;ll show up here.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {contact.collaborations.map((c, i) => (
                    <li key={i}>
                      <Link
                        href={`/production/${c.productionId}`}
                        className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2.5 transition-colors hover:border-[var(--ring)]"
                      >
                        <span className="text-sm text-gray-900 dark:text-gray-100">
                          Worked with us on{" "}
                          <span className="font-semibold">{c.productionTitle}</span>{" "}
                          as <span className="text-gray-400 dark:text-gray-500">{c.role}</span>
                        </span>
                        <ExternalLink size={13} className="text-gray-600 dark:text-gray-400" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Collaboration network (from Instagram credit scans) */}
            {contact.network && contact.network.length > 0 && (
              <div className={cardCls}>
                <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  <NetworkIcon size={15} style={{ color: ACCENT }} /> Network
                </h2>
                <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
                  Has worked with {contact.network.length} other
                  {contact.network.length === 1 ? "" : "s"}, mapped from scanned post credits.
                </p>
                <div className="flex flex-wrap gap-2">
                  {contact.network.map((c) => {
                    const inner = (
                      <>
                        <Users size={12} className="shrink-0 text-gray-500 dark:text-gray-400" />
                        <span className="font-medium text-gray-700 dark:text-gray-300">
                          {c.contactName || `@${c.handle}`}
                        </span>
                        {c.role && <span className="text-gray-500 dark:text-gray-400"> · {c.role}</span>}
                        <span
                          className="ml-1 rounded-full px-1.5 text-[10px] font-semibold text-black"
                          style={{ backgroundColor: ACCENT }}
                        >
                          {c.count}
                        </span>
                      </>
                    );
                    const cls =
                      "inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs transition-colors hover:border-[var(--ring)]";
                    return c.contactId ? (
                      <Link key={c.handle} href={`/directory/${c.contactId}`} className={cls}>
                        {inner}
                      </Link>
                    ) : (
                      <a
                        key={c.handle}
                        href={`https://www.instagram.com/${c.handle}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cls}
                      >
                        {inner}
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right / Instagram + meta */}
          <div className="space-y-5">
            {handle ? (
              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                <div
                  className="flex items-center gap-3 px-5 py-4"
                  style={{
                    background:
                      "linear-gradient(90deg, rgba(240,148,51,0.18), rgba(220,39,67,0.18), rgba(188,24,136,0.18), rgba(64,93,230,0.18))",
                  }}
                >
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-xl text-white"
                    style={{
                      background:
                        "linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)",
                    }}
                  >
                    <Instagram size={22} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                      Instagram
                    </p>
                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">@{handle}</p>
                  </div>
                </div>
                {/* Embedded profile preview — falls back to the link below if IG blocks it. */}
                <iframe
                  src={`https://www.instagram.com/${handle}/embed`}
                  title={`@${handle} on Instagram`}
                  className="h-[360px] w-full border-0 bg-white"
                  loading="lazy"
                  scrolling="no"
                />
                <a
                  href={`https://www.instagram.com/${handle}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{
                    background:
                      "linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)",
                  }}
                >
                  <Instagram size={15} /> View @{handle} on Instagram
                </a>
              </div>
            ) : (
              <div className={cardCls}>
                <p className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <Instagram size={15} /> No Instagram on file
                </p>
              </div>
            )}

            <div className={cardCls}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Added
              </p>
              <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
                {new Date(contact.createdAt).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
                {contact.creator?.name ? ` · by ${contact.creator.name}` : ""}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 text-gray-600 dark:text-gray-400">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
        <div className="truncate text-sm text-gray-400 dark:text-gray-500">{children}</div>
      </div>
    </div>
  );
}

function Muted() {
  return <span className="text-gray-600 dark:text-gray-400">—</span>;
}

function TagEditor({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  const [input, setInput] = useState("");
  function add() {
    const t = input.trim();
    if (!t || tags.includes(t)) {
      setInput("");
      return;
    }
    onChange([...tags, t]);
    setInput("");
  }
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Tags</h2>
      <div className="flex flex-wrap items-center gap-2">
        {tags.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1 text-xs text-gray-600 dark:text-gray-400"
          >
            {t}
            <button
              onClick={() => onChange(tags.filter((x) => x !== t))}
              className="text-gray-500 dark:text-gray-400 hover:text-red-400"
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          onBlur={add}
          placeholder="Add tag…"
          className="min-w-[100px] flex-1 rounded-full border border-dashed border-border bg-transparent px-3 py-1 text-xs text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-[var(--ring)] focus:outline-none"
        />
      </div>
    </div>
  );
}

function NotesEditor({
  notes,
  onSave,
}: {
  notes: string;
  onSave: (notes: string) => void;
}) {
  const [value, setValue] = useState(notes);
  const [dirty, setDirty] = useState(false);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Notes</h2>
        {dirty && (
          <button
            onClick={() => {
              onSave(value);
              setDirty(false);
            }}
            className="inline-flex items-center gap-1 text-xs font-semibold"
            style={{ color: ACCENT }}
          >
            <Check size={13} /> Save
          </button>
        )}
      </div>
      <textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setDirty(true);
        }}
        onBlur={() => {
          if (dirty) {
            onSave(value);
            setDirty(false);
          }
        }}
        placeholder="Anything worth remembering about this contact…"
        className={`${inputCls} min-h-[110px]`}
      />
    </div>
  );
}

function PortfolioEditor({
  links,
  onChange,
}: {
  links: PortfolioLink[];
  onChange: (links: PortfolioLink[]) => void;
}) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  function add() {
    setError(null);
    if (!url.trim()) return;
    if (!isValidUrl(url)) {
      setError("Please enter a valid URL (e.g. https://example.com).");
      return;
    }
    onChange([...links, { title: title.trim() || url.trim(), url: url.trim() }]);
    setTitle("");
    setUrl("");
  }
  return (
    <div>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
        <Briefcase size={15} style={{ color: ACCENT }} /> Work &amp; portfolio
      </h2>
      {links.length > 0 && (
        <ul className="mb-3 space-y-2">
          {links.map((l, i) => (
            <li
              key={i}
              className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2"
            >
              <a
                href={l.url.startsWith("http") ? l.url : `https://${l.url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 truncate text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              >
                <ExternalLink size={13} className="shrink-0 text-gray-600 dark:text-gray-400" />
                <span className="truncate">{l.title}</span>
              </a>
              <button
                onClick={() => onChange(links.filter((_, idx) => idx !== i))}
                className="ml-2 shrink-0 text-gray-600 dark:text-gray-400 hover:text-red-400"
              >
                <Trash2 size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (e.g. Portfolio, Reel)"
          className={`${inputCls} sm:w-1/3`}
        />
        <input
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="https://…"
          className={`${inputCls} ${url.trim() && !isValidUrl(url) ? "border-red-400 focus:ring-red-300/30" : ""}`}
        />
        <button
          onClick={add}
          disabled={!url.trim()}
          className="inline-flex items-center justify-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-black disabled:opacity-50"
          style={{ backgroundColor: ACCENT }}
        >
          <Plus size={15} /> Add
        </button>
      </div>
      {error && <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
