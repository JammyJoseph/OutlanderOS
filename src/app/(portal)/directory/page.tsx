"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  Plus,
  Star,
  Loader2,
  X,
  Mail,
  Phone,
  MapPin,
  Trash2,
  Radar as RadarIcon,
  Contact as ContactIcon,
  Tags,
  Clock,
  ChevronRight,
  ExternalLink,
  Pencil,
  Share2,
  CheckSquare,
  Square,
  UserPlus,
  Users,
  ScanLine,
  Network as NetworkIcon,
  Sparkles,
  LayoutDashboard,
  TrendingUp,
  Handshake,
  Trophy,
} from "lucide-react";
import {
  CONTACT_CATEGORIES,
  RADAR_STATUSES,
  RADAR_STATUS_LABELS,
  DIRECTORY_ACCENT,
} from "@/lib/directory";
import ScannerPanel from "@/components/directory/ScannerPanel";
import NetworkPanel from "@/components/directory/NetworkPanel";

const ACCENT = DIRECTORY_ACCENT;

// lucide-react in this build doesn't ship an Instagram glyph — inline the classic mark.
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

interface ContactRecord {
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
  archived?: boolean;
  notes: string | null;
  portfolioLinks?: { title: string; url: string }[];
  isRadar: boolean;
  radarStatus: string | null;
  radarLink: string | null;
  source?: string | null;
  confidence?: "VERIFIED" | "LIKELY" | "UNVERIFIED" | null;
  followers?: number | null;
  profilePic?: string | null;
  recentPosts?: { shortcode: string; imageUrl: string; caption?: string | null }[];
  collaborations?: unknown[];
  scannedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  creator?: { id: string; name: string } | null;
}

type View =
  | "dashboard"
  | "contacts"
  | "categories"
  | "radar"
  | "recent"
  | "scanner"
  | "network"
  | "lighthouse";
type SortKey = "name" | "za" | "category" | "followers" | "recent";

function isView(v: string | null): v is View {
  return (
    v === "dashboard" ||
    v === "contacts" ||
    v === "categories" ||
    v === "radar" ||
    v === "recent" ||
    v === "scanner" ||
    v === "network"
  );
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

function ConfidenceBadge({ confidence }: { confidence: string }) {
  const style = CONFIDENCE_STYLE[confidence] ?? CONFIDENCE_STYLE.UNVERIFIED;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${style}`}
      title="Scanned from Instagram"
    >
      <Sparkles size={9} /> {CONFIDENCE_LABEL[confidence] ?? confidence}
    </span>
  );
}

function igHandle(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return (
    raw
      .replace(/https?:\/\/(www\.)?instagram\.com\//i, "")
      .replace(/^@/, "")
      .replace(/\/.*$/, "")
      .trim() || null
  );
}

// Compact follower count — "12.5K", "1.2M". Null when unknown.
function fmtFollowers(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

// Free-text location → a coarse country for the Country filter. Locations are
// entered loosely ("London", "Shoreditch, London, UK"), so we map well-known
// cities to countries and fall back to the trailing comma segment.
const CITY_COUNTRY: Record<string, string> = {
  london: "UK", manchester: "UK", glasgow: "UK", edinburgh: "UK", bristol: "UK",
  leeds: "UK", liverpool: "UK", birmingham: "UK", brighton: "UK", cardiff: "UK",
  belfast: "UK", "new york": "USA", nyc: "USA", "los angeles": "USA", la: "USA",
  miami: "USA", "san francisco": "USA", chicago: "USA", paris: "France",
  milan: "Italy", rome: "Italy", berlin: "Germany", munich: "Germany",
  madrid: "Spain", barcelona: "Spain", amsterdam: "Netherlands", dublin: "Ireland",
  lisbon: "Portugal", copenhagen: "Denmark", stockholm: "Sweden", sydney: "Australia",
  melbourne: "Australia", toronto: "Canada", dubai: "UAE", "abu dhabi": "UAE",
  tokyo: "Japan", "cape town": "South Africa", lagos: "Nigeria",
};
const COUNTRY_ALIASES: Record<string, string> = {
  uk: "UK", "united kingdom": "UK", england: "UK", scotland: "UK", wales: "UK",
  gb: "UK", "great britain": "UK", usa: "USA", us: "USA", "united states": "USA",
  america: "USA", uae: "UAE",
};
function countryOf(location: string | null | undefined): string | null {
  if (!location) return null;
  const parts = location.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  const tail = parts[parts.length - 1];
  const aliased = COUNTRY_ALIASES[tail.toLowerCase()];
  if (aliased) return aliased;
  for (const p of parts) {
    const c = CITY_COUNTRY[p.toLowerCase()];
    if (c) return c;
  }
  return tail.length <= 24 ? tail : null;
}

// Builds the WhatsApp/text share block from selected contacts.
function buildShareText(contacts: ContactRecord[]): string {
  return contacts
    .map((c, i) => {
      const lines = [`${i + 1}.`];
      const title = c.role || c.category;
      if (title) lines.push(title);
      lines.push(c.name.toUpperCase());
      const handle = igHandle(c.instagram);
      if (handle) lines.push(`instagram.com/${handle}`);
      else if (c.email) lines.push(c.email);
      return lines.join("\n");
    })
    .join("\n\n");
}

// ── Shared bits ───────────────────────────────────────────────────────────────

function Stars({
  rating,
  onChange,
  size = 14,
}: {
  rating: number | null;
  onChange?: (r: number) => void;
  size?: number;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => {
        const star = (
          <Star
            size={size}
            className={i <= (rating ?? 0) ? "fill-[#ffd700] text-[#ffd700]" : "text-gray-300 dark:text-gray-600"}
          />
        );
        return onChange ? (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i)}
            className="cursor-pointer"
            title={`${i} star${i > 1 ? "s" : ""}`}
          >
            {star}
          </button>
        ) : (
          <span key={i} className="cursor-default">
            {star}
          </span>
        );
      })}
    </div>
  );
}

function CategoryBadge({ category }: { category: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
      {category}
    </span>
  );
}

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-[var(--ring)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20";
const labelCls = "block text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1";

// ── Page ───────────────────────────────────────────────────────────────────────

export default function DirectoryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <Loader2 className="animate-spin text-gray-600 dark:text-gray-400" size={24} />
        </div>
      }
    >
      <Directory />
    </Suspense>
  );
}

function Directory() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view: View = isView(searchParams.get("view")) ? (searchParams.get("view") as View) : "dashboard";

  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [radar, setRadar] = useState<ContactRecord[]>([]);
  const [categories, setCategories] = useState<{ category: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("");
  const [country, setCountry] = useState<string>("");
  const [favouritesOnly, setFavouritesOnly] = useState(false);
  const [radarStatusFilter, setRadarStatusFilter] = useState<string>("");
  // A–Z is always the landing sort for the contact list.
  const [sortKey, setSortKey] = useState<SortKey>("name");

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  const [editing, setEditing] = useState<ContactRecord | null | undefined>(undefined);
  const [addingRadar, setAddingRadar] = useState<ContactRecord | null | undefined>(undefined);

  const setView = useCallback(
    (v: View) => router.push(v === "dashboard" ? "/directory" : `/directory?view=${v}`),
    [router]
  );

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }

  const loadContacts = useCallback(async () => {
    const params = new URLSearchParams({ radar: "false" });
    if (search.trim()) params.set("search", search.trim());
    if (category) params.set("category", category);
    const res = await fetch(`/api/contacts?${params.toString()}`);
    const data = await res.json();
    setContacts(Array.isArray(data) ? data : []);
  }, [search, category]);

  const loadRadar = useCallback(async () => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (radarStatusFilter) params.set("status", radarStatusFilter);
    const res = await fetch(`/api/directory/radar?${params.toString()}`);
    const data = await res.json();
    setRadar(Array.isArray(data) ? data : []);
  }, [search, radarStatusFilter]);

  const loadCategories = useCallback(async () => {
    const res = await fetch("/api/directory/categories");
    const data = await res.json();
    setCategories(Array.isArray(data?.categories) ? data.categories : []);
  }, []);

  // (Re)load whatever the current view needs. Categories load for the chip row too.
  useEffect(() => {
    let active = true;
    setLoading(true);
    const jobs: Promise<unknown>[] = [];
    if (view === "radar") jobs.push(loadRadar());
    else jobs.push(loadContacts());
    if (view !== "radar") jobs.push(loadCategories());
    Promise.all(jobs).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [view, loadContacts, loadRadar, loadCategories]);

  async function saveContact(payload: Partial<ContactRecord>, id?: string) {
    const res = await fetch(id ? `/api/contacts/${id}` : "/api/contacts", {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setEditing(undefined);
      await loadContacts();
      await loadCategories();
    }
    return res.ok;
  }

  async function deleteContact(id: string) {
    if (!confirm("Delete this contact permanently?")) return;
    const res = await fetch(`/api/contacts/${id}`, { method: "DELETE" });
    if (res.ok) {
      setEditing(undefined);
      await loadContacts();
      if (view === "radar") await loadRadar();
    }
  }

  async function saveRadar(payload: Partial<ContactRecord>, id?: string) {
    const res = await fetch(id ? `/api/contacts/${id}` : "/api/directory/radar", {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setAddingRadar(undefined);
      await loadRadar();
    }
    return res.ok;
  }

  async function cycleRadarStatus(entry: ContactRecord) {
    const idx = RADAR_STATUSES.indexOf((entry.radarStatus ?? "WATCHING") as never);
    const next = RADAR_STATUSES[(idx + 1) % RADAR_STATUSES.length];
    setRadar((prev) => prev.map((r) => (r.id === entry.id ? { ...r, radarStatus: next } : r)));
    await fetch(`/api/contacts/${entry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ radarStatus: next }),
    });
    if (radarStatusFilter) await loadRadar();
  }

  async function convertRadar(entry: ContactRecord) {
    const handle = igHandle(entry.radarLink || entry.instagram);
    const res = await fetch(`/api/contacts/${entry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        isRadar: false,
        radarStatus: null,
        instagram: handle ? `@${handle}` : entry.instagram ?? undefined,
        website:
          !handle && entry.radarLink && entry.radarLink.startsWith("http")
            ? entry.radarLink
            : undefined,
      }),
    });
    if (res.ok) {
      showToast(`${entry.name} promoted to a contact`);
      await loadRadar();
    }
  }

  // Toggle a contact's favourite (starred) flag, optimistically.
  async function toggleFavourite(contact: ContactRecord) {
    const next = !contact.isFavourite;
    setContacts((prev) =>
      prev.map((c) => (c.id === contact.id ? { ...c, isFavourite: next } : c))
    );
    await fetch(`/api/contacts/${contact.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isFavourite: next }),
    });
  }

  // Soft-archive a contact — drop it from the list optimistically, then persist.
  async function archiveContact(contact: ContactRecord) {
    setContacts((prev) => prev.filter((c) => c.id !== contact.id));
    showToast(`Archived ${contact.name}`);
    const res = await fetch(`/api/contacts/${contact.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    });
    if (res.ok) await loadCategories();
    else {
      showToast("Could not archive — refreshing");
      await loadContacts();
    }
  }

  // Selection helpers
  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const sortedContacts = useMemo(() => {
    // "Recently Added" is its own view: contacts from the last 30 days, newest first.
    if (view === "recent") {
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
      return [...contacts]
        .filter((c) => +new Date(c.createdAt) >= cutoff)
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    }
    const arr = [...contacts];
    switch (sortKey) {
      case "name":
        // Default sort — favourites float to the top, then A–Z.
        arr.sort(
          (a, b) =>
            Number(Boolean(b.isFavourite)) - Number(Boolean(a.isFavourite)) ||
            a.name.localeCompare(b.name)
        );
        break;
      case "za":
        arr.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case "category":
        arr.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
        break;
      case "followers":
        arr.sort((a, b) => (b.followers ?? 0) - (a.followers ?? 0) || a.name.localeCompare(b.name));
        break;
      case "recent":
        arr.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
        break;
      default:
        arr.sort((a, b) => a.name.localeCompare(b.name));
    }
    return arr;
  }, [contacts, sortKey, view]);

  // Distinct countries present in the loaded contacts, most common first.
  const countryOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of contacts) {
      const co = countryOf(c.location);
      if (co) counts.set(co, (counts.get(co) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  }, [contacts]);

  // Country + favourites filtering happens client-side.
  const displayedContacts = useMemo(() => {
    let list = sortedContacts;
    if (country) list = list.filter((c) => countryOf(c.location) === country);
    if (favouritesOnly) list = list.filter((c) => c.isFavourite);
    return list;
  }, [sortedContacts, country, favouritesOnly]);

  const selectedContacts = useMemo(
    () => contacts.filter((c) => selected.has(c.id)),
    [contacts, selected]
  );

  async function copyShare() {
    const text = buildShareText(selectedContacts);
    try {
      await navigator.clipboard.writeText(text);
      showToast(`Copied ${selectedContacts.length} contact${selectedContacts.length > 1 ? "s" : ""}!`);
    } catch {
      showToast("Could not copy to clipboard");
    }
  }

  const VIEW_TABS: {
    key: View;
    label: string;
    icon: React.ElementType;
    href?: string;
  }[] = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "contacts", label: "All Contacts", icon: ContactIcon },
    { key: "scanner", label: "Scanner", icon: ScanLine },
    { key: "network", label: "Network", icon: NetworkIcon },
    { key: "lighthouse", label: "Lighthouse", icon: Sparkles, href: "/directory/lighthouse" },
    { key: "recent", label: "Recently Added", icon: Clock },
  ];

  // The contact list only sorts/filters in "All Contacts" — "Recently Added" is
  // a fixed 30-day recency view.
  const showContactTools = view === "contacts";
  const isToolView = view === "scanner" || view === "network" || view === "dashboard";

  return (
    <div className="min-h-full px-6 py-8 pb-28">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: ACCENT }}>
              OutlanderOS · Directory
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
              {view === "dashboard"
                ? "Directory"
                : view === "radar"
                ? "Outlander Radar"
                : view === "scanner"
                ? "Profile Scanner"
                : view === "network"
                ? "Collaboration Network"
                : view === "recent"
                ? "Recently Added"
                : "Contact Directory"}
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {view === "dashboard"
                ? "Your directory at a glance — contacts, scanning, network & radar."
                : view === "radar"
                ? "Emerging talent, creators & accounts we think will be big."
                : view === "scanner"
                ? "Scan Instagram profiles to build the directory and map who works with whom."
                : view === "network"
                ? "Who's collaborated with whom, mapped from scanned post credits."
                : view === "recent"
                ? "Contacts added to the directory in the last 30 days."
                : "Outlander's network of contacts, collaborators & talent."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isToolView ? null : view === "radar" ? (
              <button
                onClick={() => setAddingRadar(null)}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
                style={{ backgroundColor: ACCENT }}
              >
                <Plus size={16} /> Add to Radar
              </button>
            ) : (
              <button
                onClick={() => setEditing(null)}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
                style={{ backgroundColor: ACCENT }}
              >
                <Plus size={16} /> Add Contact
              </button>
            )}
          </div>
        </div>

        {/* View tabs */}
        <div className="mb-5 flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1 w-fit">
          {VIEW_TABS.map((t) => {
            const Icon = t.icon;
            const isActive = view === t.key;
            const cls = `inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
              isActive ? "text-black" : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            }`;
            // Lighthouse is its own route — render it as a link, everything else
            // switches the in-page view.
            if (t.href) {
              return (
                <Link key={t.key} href={t.href} className={cls}>
                  <Icon size={14} />
                  {t.label}
                </Link>
              );
            }
            return (
              <button
                key={t.key}
                onClick={() => setView(t.key)}
                className={cls}
                style={isActive ? { backgroundColor: ACCENT } : undefined}
              >
                <Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Search + filters + tools */}
        {view !== "categories" && !isToolView && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={view === "radar" ? "Search radar…" : "Search name, company, anything…"}
                className={`${inputCls} pl-8 w-72`}
              />
            </div>
            {showContactTools && (
              <>
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as SortKey)}
                  className={`${inputCls} w-auto`}
                  title="Sort"
                >
                  <option value="name">Name (A–Z)</option>
                  <option value="za">Name (Z–A)</option>
                  <option value="recent">Recently added</option>
                  <option value="followers">Most followers</option>
                  <option value="category">By category</option>
                </select>
                {countryOptions.length > 0 && (
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className={`${inputCls} w-auto`}
                    title="Filter by country"
                  >
                    <option value="">All countries</option>
                    {countryOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  onClick={() => setFavouritesOnly((v) => !v)}
                  title="Show favourites only"
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    favouritesOnly
                      ? "border-[#ffd700] text-gray-900 dark:text-gray-100"
                      : "border-border text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                  }`}
                  style={favouritesOnly ? { backgroundColor: "rgba(255,215,0,0.12)" } : undefined}
                >
                  <Star
                    size={14}
                    className={favouritesOnly ? "fill-[#ffd700] text-[#ffd700]" : "text-gray-400 dark:text-gray-500"}
                  />
                  Favourites
                </button>
              </>
            )}
            {view === "radar" && (
              <select
                value={radarStatusFilter}
                onChange={(e) => setRadarStatusFilter(e.target.value)}
                className={`${inputCls} w-auto`}
              >
                <option value="">All statuses</option>
                {RADAR_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {RADAR_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            )}
            {(search || category || country || radarStatusFilter || favouritesOnly || sortKey !== "name") && (
              <button
                onClick={() => {
                  setSearch("");
                  setCategory("");
                  setCountry("");
                  setRadarStatusFilter("");
                  setFavouritesOnly(false);
                  setSortKey("name");
                }}
                className="px-2 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              >
                Clear
              </button>
            )}
          </div>
        )}

        {/* Filter chips */}
        {showContactTools && categories.some((c) => c.count > 0) && (
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setCategory("")}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                category === ""
                  ? "border-transparent text-black"
                  : "border-border text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              }`}
              style={category === "" ? { backgroundColor: ACCENT } : undefined}
            >
              All
            </button>
            {categories
              .filter((c) => c.count > 0)
              .map((c) => {
                const active = category === c.category;
                return (
                  <button
                    key={c.category}
                    onClick={() => setCategory(active ? "" : c.category)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      active
                        ? "border-transparent text-black"
                        : "border-border text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                    }`}
                    style={active ? { backgroundColor: ACCENT } : undefined}
                  >
                    {c.category}
                    <span className={active ? "text-black/60" : "text-gray-600 dark:text-gray-400"}>{c.count}</span>
                  </button>
                );
              })}
          </div>
        )}

        {/* Body */}
        {view === "scanner" ? (
          <ScannerPanel
            onChanged={() => {
              loadContacts();
              loadCategories();
            }}
          />
        ) : view === "network" ? (
          <NetworkPanel />
        ) : loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="animate-spin text-gray-600 dark:text-gray-400" size={24} />
          </div>
        ) : view === "dashboard" ? (
          <Dashboard
            contacts={contacts}
            categories={categories}
            onNavigate={setView}
          />
        ) : view === "categories" ? (
          <CategoriesGrid
            categories={categories}
            onPick={(c) => {
              setCategory(c);
              setView("contacts");
            }}
          />
        ) : view === "radar" ? (
          <RadarList
            entries={radar}
            onCycle={cycleRadarStatus}
            onEdit={(e) => setAddingRadar(e)}
            onAdd={() => setAddingRadar(null)}
            onConvert={convertRadar}
          />
        ) : (
          <SplitPanel
            contacts={displayedContacts}
            selected={selected}
            onToggleSelect={toggleSelect}
            onToggleFavourite={toggleFavourite}
            onArchive={archiveContact}
            onEdit={(c) => setEditing(c)}
            onAdd={() => setEditing(null)}
          />
        )}
      </div>

      {/* Floating share bar */}
      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-5">
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card/95 px-4 py-3 shadow-2xl backdrop-blur">
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {selected.size} selected
            </span>
            <div className="h-5 w-px bg-border" />
            <button
              onClick={copyShare}
              className="inline-flex items-center gap-2 rounded-xl bg-[#22c55e] px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90"
              style={{ boxShadow: "0 0 22px -6px #22c55e" }}
            >
              <Share2 size={15} /> Share
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
            >
              <X size={15} /> Clear selection
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed inset-x-0 bottom-24 z-50 flex justify-center px-4">
          <div className="rounded-xl border border-border bg-popover px-4 py-2.5 text-sm font-medium text-gray-900 dark:text-gray-100 shadow-xl">
            {toast}
          </div>
        </div>
      )}

      {editing !== undefined && (
        <ContactModal
          contact={editing}
          onClose={() => setEditing(undefined)}
          onSave={saveContact}
          onDelete={deleteContact}
        />
      )}
      {addingRadar !== undefined && (
        <RadarModal
          entry={addingRadar}
          onClose={() => setAddingRadar(undefined)}
          onSave={saveRadar}
          onDelete={deleteContact}
        />
      )}
    </div>
  );
}

// ── Contacts split-panel (list + detail) ───────────────────────────────────────

function SplitPanel({
  contacts,
  selected,
  onToggleSelect,
  onToggleFavourite,
  onArchive,
  onEdit,
  onAdd,
}: {
  contacts: ContactRecord[];
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleFavourite: (c: ContactRecord) => void;
  onArchive: (c: ContactRecord) => void;
  onEdit: (c: ContactRecord) => void;
  onAdd: () => void;
}) {
  // The highlighted contact, tracked by id so it survives list re-sorts/filters.
  const [activeId, setActiveId] = useState<string | null>(contacts[0]?.id ?? null);
  // Contact awaiting an archive confirmation (from the ← key), null when idle.
  const [confirmArchive, setConfirmArchive] = useState<ContactRecord | null>(null);
  // True for a beat after a → favourite so the detail-panel star pops.
  const [favPulse, setFavPulse] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Default to (or fall back to) the first contact whenever the list changes.
  useEffect(() => {
    if (contacts.length === 0) {
      setActiveId(null);
    } else if (!contacts.some((c) => c.id === activeId)) {
      setActiveId(contacts[0].id);
    }
  }, [contacts, activeId]);

  const active = contacts.find((c) => c.id === activeId) ?? contacts[0] ?? null;

  // Keyboard shortcuts (ignored while typing in a field):
  //   ↑ ↓  move the highlight   →  favourite (instant)   ←  archive (confirm)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      // While an archive confirmation is up, Enter confirms, anything else cancels.
      if (confirmArchive) {
        if (e.key === "Enter") {
          e.preventDefault();
          onArchive(confirmArchive);
          setConfirmArchive(null);
        } else if (e.key === "Escape" || e.key === "ArrowLeft") {
          e.preventDefault();
          setConfirmArchive(null);
        }
        return;
      }

      const idx = contacts.findIndex((c) => c.id === activeId);
      const cur = idx < 0 ? 0 : idx;
      const current = contacts[cur] ?? null;

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const next =
          e.key === "ArrowDown"
            ? Math.min(cur + 1, contacts.length - 1)
            : Math.max(cur - 1, 0);
        setActiveId(contacts[next]?.id ?? null);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (current) {
          onToggleFavourite(current);
          setFavPulse(true);
          window.setTimeout(() => setFavPulse(false), 200);
        }
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (current) setConfirmArchive(current);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [contacts, activeId, confirmArchive, onArchive, onToggleFavourite]);

  // Auto-dismiss the archive confirmation if it's left unanswered.
  useEffect(() => {
    if (!confirmArchive) return;
    const t = setTimeout(() => setConfirmArchive(null), 4000);
    return () => clearTimeout(t);
  }, [confirmArchive]);

  // Keep the highlighted row visible as the selection moves.
  useEffect(() => {
    if (!activeId) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-cid="${activeId}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  if (contacts.length === 0) {
    return (
      <EmptyState
        icon={ContactIcon}
        title="No contacts found"
        body="Nothing matches these filters yet. Clear the search, category or country filter — or add a new contact."
        action="Add a contact"
        onAction={onAdd}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4 lg:h-[calc(100dvh-330px)] lg:min-h-[560px] lg:flex-row">
      {/* Left — contact list */}
      <div className="relative flex w-full flex-col overflow-hidden rounded-2xl border border-border bg-card lg:w-2/5">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card/95 px-4 py-2.5 backdrop-blur">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">
            {contacts.length} contact{contacts.length === 1 ? "" : "s"}
          </p>
          <p className="hidden text-[10px] text-gray-400 dark:text-gray-500 sm:block">↑ ↓ to browse</p>
        </div>
        <div ref={listRef} className="flex-1 overflow-y-auto">
          {contacts.map((c) => (
            <SplitRow
              key={c.id}
              contact={c}
              active={c.id === active?.id}
              selected={selected.has(c.id)}
              onSelect={() => setActiveId(c.id)}
              onToggleSelect={() => onToggleSelect(c.id)}
              onToggleFavourite={() => onToggleFavourite(c)}
            />
          ))}
        </div>

        {/* Key hint — subtle, muted, pinned to the bottom of the list. */}
        <div className="border-t border-border bg-card/95 px-4 py-2 text-center text-[10px] font-medium tracking-wide text-gray-400 dark:text-gray-500">
          <span className="text-gray-500 dark:text-gray-400">←</span> Archive
          <span className="mx-1.5 text-gray-300 dark:text-gray-600">·</span>
          <span className="text-gray-500 dark:text-gray-400">↑↓</span> Navigate
          <span className="mx-1.5 text-gray-300 dark:text-gray-600">·</span>
          <span className="text-gray-500 dark:text-gray-400">→</span> Favourite
        </div>

        {/* Archive confirmation — brief overlay, Enter to confirm / Esc to cancel. */}
        {confirmArchive && (
          <div className="absolute inset-x-3 bottom-12 z-20 rounded-xl border border-border bg-popover px-4 py-3 shadow-2xl">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Archive {confirmArchive.name}?
            </p>
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={() => {
                  onArchive(confirmArchive);
                  setConfirmArchive(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-black"
                style={{ backgroundColor: ACCENT }}
              >
                Archive
              </button>
              <button
                onClick={() => setConfirmArchive(null)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              >
                Cancel
              </button>
              <span className="ml-auto text-[10px] text-gray-400 dark:text-gray-500">
                <span className="font-semibold text-gray-500 dark:text-gray-400">Enter</span> confirm ·{" "}
                <span className="font-semibold text-gray-500 dark:text-gray-400">Esc</span> cancel
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Right — contact detail */}
      <div className="flex w-full flex-col overflow-hidden rounded-2xl border border-border bg-card lg:w-3/5">
        {active && (
          <ContactDetailPanel
            key={active.id}
            contact={active}
            onEdit={onEdit}
            onToggleFavourite={onToggleFavourite}
            favPulse={favPulse}
          />
        )}
      </div>
    </div>
  );
}

function SplitRow({
  contact: c,
  active,
  selected,
  onSelect,
  onToggleSelect,
  onToggleFavourite,
}: {
  contact: ContactRecord;
  active: boolean;
  selected: boolean;
  onSelect: () => void;
  onToggleSelect: () => void;
  onToggleFavourite: () => void;
}) {
  const handle = igHandle(c.instagram);
  const followers = fmtFollowers(c.followers);
  return (
    <div
      data-cid={c.id}
      onClick={onSelect}
      className={`flex cursor-pointer items-center gap-2.5 border-b border-border px-3 py-2.5 transition-colors ${
        active ? "bg-secondary" : "hover:bg-secondary/60"
      }`}
      style={active ? { boxShadow: `inset 3px 0 0 ${ACCENT}` } : undefined}
    >
      <SelectBox selected={selected} onToggle={onToggleSelect} />
      <FavouriteStar favourite={Boolean(c.isFavourite)} onToggle={onToggleFavourite} />
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold text-gray-500 dark:text-gray-400">
        {c.name.slice(0, 2).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-bold leading-tight text-gray-900 dark:text-gray-100">{c.name}</p>
        <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
          {handle ? (
            <span className="truncate font-semibold text-[#dc2743]">@{handle}</span>
          ) : (
            <span className="truncate">{c.role || c.company || "—"}</span>
          )}
          {followers && (
            <span className="inline-flex shrink-0 items-center gap-0.5" title="Followers">
              <Users size={10} /> {followers}
            </span>
          )}
        </div>
      </div>
      <span className="hidden shrink-0 sm:block">
        <CategoryBadge category={c.category} />
      </span>
    </div>
  );
}

function SelectBox({ selected, onToggle }: { selected: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      className={selected ? "" : "text-gray-600 dark:text-gray-400 hover:text-gray-300 dark:hover:text-gray-600"}
      style={selected ? { color: ACCENT } : undefined}
      title={selected ? "Deselect" : "Select"}
    >
      {selected ? <CheckSquare size={18} /> : <Square size={18} />}
    </button>
  );
}

// Star toggle — gold when favourited, grey outline when not. `pulse` briefly
// pops the star (used for the → keyboard favourite so the change feels instant).
function FavouriteStar({
  favourite,
  onToggle,
  size = 16,
  pulse = false,
}: {
  favourite: boolean;
  onToggle: () => void;
  size?: number;
  pulse?: boolean;
}) {
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      className="shrink-0"
      title={favourite ? "Remove from favourites" : "Add to favourites"}
      aria-pressed={favourite}
    >
      <Star
        size={size}
        style={{
          transform: pulse ? "scale(1.45)" : "scale(1)",
          transition: "transform 0.18s ease",
        }}
        className={
          favourite
            ? "fill-[#ffd700] text-[#ffd700]"
            : "text-gray-400 dark:text-gray-500 hover:text-[#ffd700]"
        }
      />
    </button>
  );
}

// ── Contact detail panel ────────────────────────────────────────────────────────

interface Collaboration {
  productionId: string;
  productionTitle: string;
  role: string;
  source: "crew" | "team";
}

interface ContactDetail extends Omit<ContactRecord, "collaborations"> {
  collaborations?: Collaboration[];
}

function ContactDetailPanel({
  contact,
  onEdit,
  onToggleFavourite,
  favPulse = false,
}: {
  contact: ContactRecord;
  onEdit: (c: ContactRecord) => void;
  onToggleFavourite: (c: ContactRecord) => void;
  favPulse?: boolean;
}) {
  const [detail, setDetail] = useState<ContactDetail | null>(null);
  const [loading, setLoading] = useState(false);

  // Pull the full profile (collaborations, portfolio, etc.) for the selection.
  const id = contact.id;
  useEffect(() => {
    let active = true;
    setLoading(true);
    setDetail(null);
    fetch(`/api/contacts/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active && d) setDetail(d);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const c: ContactDetail = detail ?? (contact as unknown as ContactDetail);
  const handle = igHandle(c.instagram);
  const followers = fmtFollowers(c.followers);
  const collaborations = detail?.collaborations ?? [];
  const portfolio = c.portfolioLinks ?? [];
  const tags = c.tags ?? [];
  const recentPosts = (c.recentPosts ?? []).filter((p) => p?.imageUrl && p?.shortcode);

  return (
    <>
      {/* Sticky header */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border bg-card/95 px-5 py-3 backdrop-blur">
        <div className="flex min-w-0 items-center gap-2">
          <FavouriteStar
            favourite={Boolean(contact.isFavourite)}
            onToggle={() => onToggleFavourite(contact)}
            size={18}
            pulse={favPulse}
          />
          <p className="min-w-0 truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{c.name}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => onEdit(contact)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          >
            <Pencil size={13} /> Edit
          </button>
          <Link
            href={`/directory/${c.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-black transition-opacity hover:opacity-90"
            style={{ backgroundColor: ACCENT }}
          >
            Open Full Profile <ChevronRight size={13} />
          </Link>
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
        {/* Identity */}
        <div>
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-gray-500 dark:text-gray-400">
              {c.name.slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-semibold leading-tight text-gray-900 dark:text-gray-100">{c.name}</h2>
              {(c.role || c.company) && (
                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                  {[c.role, c.company].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <CategoryBadge category={c.category} />
            {c.source === "instagram_scan" && c.confidence && (
              <ConfidenceBadge confidence={c.confidence} />
            )}
            {c.rating ? <Stars rating={c.rating} /> : null}
            {c.location && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <MapPin size={12} /> {c.location}
              </span>
            )}
          </div>
        </div>

        {/* Instagram + follower count, prominent */}
        {(handle || followers) && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3">
            {handle ? (
              <a
                href={`https://www.instagram.com/${handle}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#dc2743] hover:underline"
              >
                <Instagram size={16} /> @{handle}
              </a>
            ) : (
              <span className="text-sm text-gray-500 dark:text-gray-400">Instagram</span>
            )}
            {followers && (
              <span className="text-right">
                <span className="block text-base font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                  {followers}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  Followers
                </span>
              </span>
            )}
          </div>
        )}

        {/* Contact details */}
        <div className="grid grid-cols-1 gap-1.5 text-sm text-gray-600 dark:text-gray-400">
          {c.email && (
            <a href={`mailto:${c.email}`} className="inline-flex items-center gap-2 hover:text-gray-900 dark:hover:text-gray-100">
              <Mail size={14} className="text-gray-400 dark:text-gray-500" /> {c.email}
            </a>
          )}
          {c.phone && (
            <a href={`tel:${c.phone}`} className="inline-flex items-center gap-2 hover:text-gray-900 dark:hover:text-gray-100">
              <Phone size={14} className="text-gray-400 dark:text-gray-500" /> {c.phone}
            </a>
          )}
          {c.location && (
            <span className="inline-flex items-center gap-2">
              <MapPin size={14} className="text-gray-400 dark:text-gray-500" /> {c.location}
            </span>
          )}
          {c.website && (
            <a
              href={c.website.startsWith("http") ? c.website : `https://${c.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 hover:text-gray-900 dark:hover:text-gray-100"
            >
              <ExternalLink size={14} className="text-gray-400 dark:text-gray-500" /> {c.website}
            </a>
          )}
        </div>

        {/* Instagram preview — a 3×3 grid of scanned posts when we have them,
            otherwise a tall live embed. */}
        {handle && (
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Instagram
            </p>
            {recentPosts.length > 0 ? (
              <PostGrid handle={handle} posts={recentPosts} />
            ) : (
              <div className="overflow-hidden rounded-xl border border-border bg-background">
                <iframe
                  key={handle}
                  src={`https://www.instagram.com/${handle}/embed/`}
                  title={`@${handle} on Instagram`}
                  className="h-[500px] w-full"
                  loading="lazy"
                  scrolling="no"
                />
              </div>
            )}
            <a
              href={`https://www.instagram.com/${handle}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            >
              <ExternalLink size={12} />{" "}
              {recentPosts.length > 0
                ? "Open the full profile on Instagram"
                : "View on Instagram if the preview doesn't load"}
            </a>
          </div>
        )}

        {/* Bio / notes */}
        {c.notes && (
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Bio / Notes
            </p>
            <p className="whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-400">{c.notes}</p>
          </div>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Tags
            </p>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-border bg-secondary px-2.5 py-0.5 text-[11px] font-medium text-gray-600 dark:text-gray-400"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Portfolio */}
        {portfolio.length > 0 && (
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Portfolio
            </p>
            <div className="space-y-1.5">
              {portfolio.map((p, i) => (
                <a
                  key={i}
                  href={p.url.startsWith("http") ? p.url : `https://${p.url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:border-[var(--ring)] hover:text-gray-900 dark:hover:text-gray-100"
                >
                  <ExternalLink size={13} className="text-gray-400 dark:text-gray-500" />
                  <span className="truncate">{p.title || p.url}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Collaboration history */}
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Collaboration history
          </p>
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
              <Loader2 size={14} className="animate-spin" /> Loading…
            </div>
          ) : collaborations.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-gray-500">No productions linked yet.</p>
          ) : (
            <div className="space-y-1.5">
              {collaborations.map((col) => (
                <Link
                  key={`${col.productionId}-${col.role}`}
                  href={`/production/${col.productionId}`}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm hover:border-[var(--ring)]"
                >
                  <span className="truncate text-gray-700 dark:text-gray-300">{col.productionTitle}</span>
                  <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">{col.role}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Instagram post grid (3×3 of scanned posts) ──────────────────────────────────

function PostGrid({
  handle,
  posts,
}: {
  handle: string;
  posts: { shortcode: string; imageUrl: string; caption?: string | null }[];
}) {
  return (
    <div className="grid grid-cols-3 gap-1.5 overflow-hidden rounded-xl">
      {posts.slice(0, 9).map((p) => (
        <a
          key={p.shortcode}
          href={`https://www.instagram.com/p/${p.shortcode}/`}
          target="_blank"
          rel="noopener noreferrer"
          title={p.caption?.slice(0, 120) || `@${handle} on Instagram`}
          className="group relative block aspect-square overflow-hidden rounded-lg border border-border bg-secondary"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={p.imageUrl}
            alt={p.caption?.slice(0, 80) || `Post by @${handle}`}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-opacity group-hover:bg-black/30 group-hover:opacity-100">
            <ExternalLink size={16} className="text-white" />
          </span>
        </a>
      ))}
    </div>
  );
}

// ── Directory dashboard (landing overview) ───────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
        <Icon size={15} style={{ color: ACCENT }} />
        <span className="text-[11px] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100 tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{hint}</p>}
    </div>
  );
}

// Compact top-5 preview of the leaderboard for the dashboard landing. Pulls
// from the same scoring endpoint the full /directory/leaderboard page uses.
type LeaderPreview = {
  id: string;
  name: string;
  category: string;
  followers: number | null;
  profilePic: string | null;
  collaborationCount: number;
  score: number;
};

const MEDAL_COLORS: Record<number, string> = {
  1: "#f5b301",
  2: "#9ca3af",
  3: "#cd7f32",
};

function HottestCreatives() {
  const [top, setTop] = useState<LeaderPreview[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/directory/leaderboard?limit=5")
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        setTop(Array.isArray(data?.entries) ? data.entries : []);
        setLoaded(true);
      })
      .catch(() => active && setLoaded(true));
    return () => {
      active = false;
    };
  }, []);

  if (loaded && top.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
          <Trophy size={15} style={{ color: ACCENT }} />
          <span className="text-[11px] font-semibold uppercase tracking-wide">
            Hottest creatives
          </span>
        </div>
        <Link
          href="/directory/leaderboard"
          className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
        >
          See all <ChevronRight size={13} />
        </Link>
      </div>

      {!loaded ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="animate-spin text-gray-400 dark:text-gray-500" size={18} />
        </div>
      ) : (
        <div className="space-y-1">
          {top.map((c, i) => {
            const rank = i + 1;
            const followers = fmtFollowers(c.followers);
            return (
              <Link
                key={c.id}
                href={`/directory/${c.id}`}
                className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-secondary/50"
              >
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums"
                  style={
                    MEDAL_COLORS[rank]
                      ? { backgroundColor: MEDAL_COLORS[rank], color: "#fff" }
                      : { backgroundColor: "var(--secondary)", color: "#6b7280" }
                  }
                >
                  {rank}
                </span>
                {c.profilePic ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.profilePic}
                    alt={c.name}
                    referrerPolicy="no-referrer"
                    className="h-7 w-7 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold text-gray-500 dark:text-gray-400">
                    {c.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                  {c.name}
                </span>
                {followers && (
                  <span className="hidden shrink-0 items-center gap-1 text-xs text-gray-400 dark:text-gray-500 sm:inline-flex">
                    <Users size={11} /> {followers}
                  </span>
                )}
                <span className="shrink-0 text-xs font-semibold tabular-nums text-gray-400 dark:text-gray-500">
                  {c.score}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Dashboard({
  contacts,
  categories,
  onNavigate,
}: {
  contacts: ContactRecord[];
  categories: { category: string; count: number }[];
  onNavigate: (v: View) => void;
}) {
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

  const recentlyAdded = contacts.filter((c) => +new Date(c.createdAt) >= weekAgo).length;
  const collaborators = contacts.filter(
    (c) => Array.isArray(c.collaborations) && c.collaborations.length > 0
  ).length;
  const favourites = contacts.filter((c) => c.isFavourite).length;

  // Most-populated categories first, for the breakdown card.
  const topCategories = [...categories]
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  // Last 5 scanned profiles, newest scan first.
  const recentlyScanned = contacts
    .filter((c) => c.source === "instagram_scan" && c.scannedAt)
    .sort((a, b) => +new Date(b.scannedAt!) - +new Date(a.scannedAt!))
    .slice(0, 5);

  const QUICK: {
    key: string;
    title: string;
    body: string;
    icon: React.ElementType;
    view?: View;
    href?: string;
  }[] = [
    { key: "contacts", title: "Contacts", body: "Browse your full contact directory", icon: ContactIcon, view: "contacts" },
    { key: "scanner", title: "Scanner", body: "Scan Instagram profiles to discover talent", icon: ScanLine, view: "scanner" },
    { key: "network", title: "Network", body: "View collaboration connections", icon: NetworkIcon, view: "network" },
    { key: "lighthouse", title: "Lighthouse", body: "Spotlight & radar — coming soon", icon: Sparkles, href: "/directory/lighthouse" },
  ];

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Users} label="Total Contacts" value={contacts.length} />
        <StatCard
          icon={Clock}
          label="Recently Added"
          value={recentlyAdded}
          hint="in the last 7 days"
        />
        <StatCard
          icon={Handshake}
          label="Collaborators"
          value={collaborators}
          hint="with collaboration history"
        />
        <StatCard
          icon={Star}
          label="Favourites"
          value={favourites}
          hint="starred contacts"
        />
      </div>

      {/* Category breakdown */}
      {topCategories.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2 text-gray-500 dark:text-gray-400">
            <Tags size={15} style={{ color: ACCENT }} />
            <span className="text-[11px] font-semibold uppercase tracking-wide">
              Categories breakdown
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {topCategories.map((c) => (
              <button
                key={c.category}
                onClick={() => onNavigate("contacts")}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors hover:border-[var(--ring)]"
              >
                {c.category}
                <span className="rounded-full bg-secondary px-1.5 py-0.5 text-xs font-semibold tabular-nums text-gray-500 dark:text-gray-400">
                  {c.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Hottest creatives preview */}
      <HottestCreatives />

      {/* Quick access */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {QUICK.map((q) => {
          const Icon = q.icon;
          const inner = (
            <>
              <span
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${ACCENT}1a`, color: ACCENT }}
              >
                <Icon size={18} />
              </span>
              <div>
                <p className="flex items-center gap-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {q.title}
                  <ChevronRight
                    size={14}
                    className="text-gray-400 dark:text-gray-500 transition-transform group-hover:translate-x-0.5"
                  />
                </p>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{q.body}</p>
              </div>
            </>
          );
          const cls =
            "group flex flex-col items-start gap-3 rounded-2xl border border-border bg-card p-5 text-left transition-colors hover:border-[var(--ring)]";
          return q.href ? (
            <Link key={q.key} href={q.href} className={cls}>
              {inner}
            </Link>
          ) : (
            <button key={q.key} onClick={() => q.view && onNavigate(q.view)} className={cls}>
              {inner}
            </button>
          );
        })}
      </div>

      {/* Recently scanned */}
      {recentlyScanned.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2 text-gray-500 dark:text-gray-400">
            <TrendingUp size={15} style={{ color: ACCENT }} />
            <span className="text-[11px] font-semibold uppercase tracking-wide">
              Recently scanned
            </span>
          </div>
          <div className="space-y-1.5">
            {recentlyScanned.map((c) => {
              const handle = igHandle(c.instagram);
              const followers = fmtFollowers(c.followers);
              return (
                <Link
                  key={c.id}
                  href={`/directory/${c.id}`}
                  className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2 transition-colors hover:border-[var(--ring)]"
                >
                  {c.profilePic ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.profilePic}
                      alt={c.name}
                      referrerPolicy="no-referrer"
                      className="h-9 w-9 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                      {c.name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{c.name}</p>
                    {handle && (
                      <p className="truncate text-[11px] font-medium text-[#dc2743]">@{handle}</p>
                    )}
                  </div>
                  {followers && (
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                      <Users size={12} /> {followers}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Categories grid ─────────────────────────────────────────────────────────────

function CategoriesGrid({
  categories,
  onPick,
}: {
  categories: { category: string; count: number }[];
  onPick: (c: string) => void;
}) {
  const withCounts = categories.filter((c) => c.count > 0);
  if (withCounts.length === 0) {
    return (
      <EmptyState
        icon={Tags}
        title="No categories yet"
        body="Categories appear here as you add contacts to the directory."
      />
    );
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {withCounts.map((c) => (
        <button
          key={c.category}
          onClick={() => onPick(c.category)}
          className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3.5 text-left transition-colors hover:border-[var(--ring)]"
        >
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{c.category}</span>
          <span className="inline-flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="rounded-full border border-border px-2 py-0.5 font-semibold text-gray-600 dark:text-gray-400">
              {c.count}
            </span>
            <ChevronRight size={14} />
          </span>
        </button>
      ))}
    </div>
  );
}

// ── Radar list ──────────────────────────────────────────────────────────────────

const RADAR_STATUS_STYLE: Record<string, string> = {
  WATCHING: "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400",
  REACHED_OUT: "border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300",
  CONNECTED: "border-sky-300 dark:border-sky-800 text-sky-700 dark:text-sky-300",
  COLLABORATING: "border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300",
};

function RadarList({
  entries,
  onCycle,
  onEdit,
  onAdd,
  onConvert,
}: {
  entries: ContactRecord[];
  onCycle: (e: ContactRecord) => void;
  onEdit: (e: ContactRecord) => void;
  onAdd: () => void;
  onConvert: (e: ContactRecord) => void;
}) {
  if (entries.length === 0) {
    return (
      <EmptyState
        icon={RadarIcon}
        title="The radar is clear"
        body="Track emerging talent, creators and accounts you think will be big — your scouting board."
        action="Add the first one to watch"
        onAction={onAdd}
      />
    );
  }
  return (
    <div className="space-y-3">
      {entries.map((e) => {
        const status = e.radarStatus ?? "WATCHING";
        const link = e.radarLink || e.instagram || e.website;
        return (
          <div
            key={e.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
            style={{ boxShadow: `0 0 0 1px rgba(224,224,224,0.04), 0 0 24px -12px ${ACCENT}` }}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <RadarIcon size={14} style={{ color: ACCENT }} />
                <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{e.name}</p>
                <CategoryBadge category={e.category} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-gray-500 dark:text-gray-400">
                {link && (
                  <a
                    href={link.startsWith("http") ? link : `https://${link.replace(/^@/, "instagram.com/")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(ev) => ev.stopPropagation()}
                    className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                  >
                    <ExternalLink size={11} /> {e.radarLink || e.instagram || e.website}
                  </a>
                )}
                {e.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={11} /> {e.location}
                  </span>
                )}
                {e.creator?.name && <span>Added by {e.creator.name}</span>}
              </div>
              {e.notes && <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500 line-clamp-2">{e.notes}</p>}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onCycle(e)}
                title="Click to advance status"
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors hover:bg-secondary ${
                  RADAR_STATUS_STYLE[status] ?? "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400"
                }`}
              >
                {RADAR_STATUS_LABELS[status] ?? status}
              </button>
              <button
                onClick={() => onConvert(e)}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-medium text-gray-600 dark:text-gray-400 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400"
                title="Promote to a full contact"
              >
                <UserPlus size={12} /> Convert
              </button>
              <button
                onClick={() => onEdit(e)}
                className="rounded-lg border border-border p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                title="Edit"
              >
                <Pencil size={13} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Empty state ─────────────────────────────────────────────────────────────────

function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  onAction,
}: {
  icon: React.ElementType;
  title: string;
  body: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 py-20 text-center">
      <Icon size={28} className="mb-3 text-gray-600 dark:text-gray-400" />
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</p>
      <p className="mt-1 max-w-md text-xs text-gray-500 dark:text-gray-400">{body}</p>
      {action && onAction && (
        <button
          onClick={onAction}
          className="mt-5 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-black"
          style={{ backgroundColor: ACCENT }}
        >
          <Plus size={15} /> {action}
        </button>
      )}
    </div>
  );
}

// ── Modal shell ─────────────────────────────────────────────────────────────────

function ModalShell({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 py-10 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[65vh] space-y-4 overflow-y-auto px-5 py-5">{children}</div>
        <div className="flex items-center justify-between gap-2 border-t border-border px-5 py-4">
          {footer}
        </div>
      </div>
    </div>
  );
}

// ── Contact modal (add / edit) ───────────────────────────────────────────────────

function ContactModal({
  contact,
  onClose,
  onSave,
  onDelete,
}: {
  contact: ContactRecord | null;
  onClose: () => void;
  onSave: (payload: Partial<ContactRecord>, id?: string) => Promise<boolean>;
  onDelete: (id: string) => void;
}) {
  const [form, setForm] = useState({
    name: contact?.name ?? "",
    role: contact?.role ?? "",
    company: contact?.company ?? "",
    category: contact?.category ?? "Other",
    email: contact?.email ?? "",
    phone: contact?.phone ?? "",
    instagram: contact?.instagram ?? "",
    website: contact?.website ?? "",
    location: contact?.location ?? "",
    rating: contact?.rating ?? (null as number | null),
    notes: contact?.notes ?? "",
    tags: (contact?.tags ?? []).join(", "),
  });
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit() {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload: Partial<ContactRecord> = {
      name: form.name.trim(),
      role: form.role || null,
      company: form.company || null,
      category: form.category,
      email: form.email || null,
      phone: form.phone || null,
      instagram: form.instagram || null,
      website: form.website || null,
      location: form.location || null,
      rating: form.rating,
      notes: form.notes || null,
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    };
    const ok = await onSave(payload, contact?.id);
    setSaving(false);
    if (!ok) alert("Could not save contact — check the email address.");
  }

  return (
    <ModalShell
      title={contact ? "Edit contact" : "Add contact"}
      onClose={onClose}
      footer={
        <>
          {contact ? (
            <button
              onClick={() => onDelete(contact.id)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-red-400"
            >
              <Trash2 size={13} /> Delete
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="rounded-lg px-3 py-2 text-sm text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-100">
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={saving || !form.name.trim()}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
              style={{ backgroundColor: ACCENT }}
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {contact ? "Save changes" : "Add contact"}
            </button>
          </div>
        </>
      }
    >
      <div>
        <label className={labelCls}>Name *</label>
        <input className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Role / title</label>
          <input className={inputCls} value={form.role} onChange={(e) => set("role", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Company</label>
          <input className={inputCls} value={form.company} onChange={(e) => set("company", e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Category</label>
          <select className={inputCls} value={form.category} onChange={(e) => set("category", e.target.value)}>
            {CONTACT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Location</label>
          <input className={inputCls} value={form.location} onChange={(e) => set("location", e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Email</label>
          <input className={inputCls} value={form.email} onChange={(e) => set("email", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Phone</label>
          <input className={inputCls} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Instagram</label>
          <input className={inputCls} value={form.instagram} onChange={(e) => set("instagram", e.target.value)} placeholder="@handle" />
        </div>
        <div>
          <label className={labelCls}>Website</label>
          <input className={inputCls} value={form.website} onChange={(e) => set("website", e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelCls}>Rating</label>
        <Stars rating={form.rating} onChange={(r) => set("rating", r === form.rating ? null : r)} size={18} />
      </div>
      <div>
        <label className={labelCls}>Tags (comma-separated)</label>
        <input className={inputCls} value={form.tags} onChange={(e) => set("tags", e.target.value)} placeholder="editorial, london, reliable" />
      </div>
      <div>
        <label className={labelCls}>Notes</label>
        <textarea className={`${inputCls} min-h-[90px]`} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
      </div>
    </ModalShell>
  );
}

// ── Radar modal (add / edit) ─────────────────────────────────────────────────────

function RadarModal({
  entry,
  onClose,
  onSave,
  onDelete,
}: {
  entry: ContactRecord | null;
  onClose: () => void;
  onSave: (payload: Partial<ContactRecord>, id?: string) => Promise<boolean>;
  onDelete: (id: string) => void;
}) {
  const [form, setForm] = useState({
    name: entry?.name ?? "",
    category: entry?.category ?? "Talent",
    radarLink: entry?.radarLink ?? entry?.instagram ?? "",
    location: entry?.location ?? "",
    radarStatus: entry?.radarStatus ?? "WATCHING",
    notes: entry?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit() {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload: Partial<ContactRecord> = {
      name: form.name.trim(),
      category: form.category,
      radarLink: form.radarLink || null,
      location: form.location || null,
      radarStatus: form.radarStatus,
      notes: form.notes || null,
      isRadar: true,
    };
    const ok = await onSave(payload, entry?.id);
    setSaving(false);
    if (!ok) alert("Could not save radar entry.");
  }

  return (
    <ModalShell
      title={entry ? "Edit radar entry" : "Add to radar"}
      onClose={onClose}
      footer={
        <>
          {entry ? (
            <button
              onClick={() => onDelete(entry.id)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-red-400"
            >
              <Trash2 size={13} /> Remove
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="rounded-lg px-3 py-2 text-sm text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-100">
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={saving || !form.name.trim()}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
              style={{ backgroundColor: ACCENT }}
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {entry ? "Save changes" : "Add to radar"}
            </button>
          </div>
        </>
      }
    >
      <div>
        <label className={labelCls}>Name *</label>
        <input className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Category</label>
          <select className={inputCls} value={form.category} onChange={(e) => set("category", e.target.value)}>
            {CONTACT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Status</label>
          <select className={inputCls} value={form.radarStatus} onChange={(e) => set("radarStatus", e.target.value)}>
            {RADAR_STATUSES.map((s) => (
              <option key={s} value={s}>
                {RADAR_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className={labelCls}>Handle / link</label>
        <input className={inputCls} value={form.radarLink} onChange={(e) => set("radarLink", e.target.value)} placeholder="@handle or https://…" />
      </div>
      <div>
        <label className={labelCls}>Location</label>
        <input className={inputCls} value={form.location} onChange={(e) => set("location", e.target.value)} />
      </div>
      <div>
        <label className={labelCls}>Why they&apos;re interesting</label>
        <textarea className={`${inputCls} min-h-[100px]`} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="What makes them one to watch?" />
      </div>
    </ModalShell>
  );
}
