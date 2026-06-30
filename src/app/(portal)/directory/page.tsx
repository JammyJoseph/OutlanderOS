"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
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
  LayoutGrid,
  List as ListIcon,
  Download,
  RefreshCw,
  Share2,
  CheckSquare,
  Square,
  UserPlus,
} from "lucide-react";
import {
  CONTACT_CATEGORIES,
  RADAR_STATUSES,
  RADAR_STATUS_LABELS,
  DIRECTORY_ACCENT,
} from "@/lib/directory";

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
  notes: string | null;
  portfolioLinks?: { title: string; url: string }[];
  isRadar: boolean;
  radarStatus: string | null;
  radarLink: string | null;
  createdAt: string;
  updatedAt: string;
  creator?: { id: string; name: string } | null;
}

type View = "contacts" | "categories" | "radar" | "recent";
type DisplayMode = "grid" | "list";
type SortKey = "name" | "category" | "rating" | "recent";

function isView(v: string | null): v is View {
  return v === "contacts" || v === "categories" || v === "radar" || v === "recent";
}

const MASTER_SHEET = "1RJFla1KOPRWN0-ue9H6clQ5bWuYEuo1RSHD6K8Zy2hY";

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
            className={i <= (rating ?? 0) ? "fill-[#ffd700] text-[#ffd700]" : "text-gray-300"}
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
    <span className="inline-flex items-center rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-300">
      {category}
    </span>
  );
}

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[var(--ring)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20";
const labelCls = "block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1";

// ── Page ───────────────────────────────────────────────────────────────────────

export default function DirectoryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <Loader2 className="animate-spin text-gray-600" size={24} />
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
  const view: View = isView(searchParams.get("view")) ? (searchParams.get("view") as View) : "contacts";

  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [radar, setRadar] = useState<ContactRecord[]>([]);
  const [categories, setCategories] = useState<{ category: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("");
  const [radarStatusFilter, setRadarStatusFilter] = useState<string>("");
  const [displayMode, setDisplayMode] = useState<DisplayMode>("grid");
  const [sortKey, setSortKey] = useState<SortKey>("recent");

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  const [editing, setEditing] = useState<ContactRecord | null | undefined>(undefined);
  const [addingRadar, setAddingRadar] = useState<ContactRecord | null | undefined>(undefined);

  const [importing, setImporting] = useState(false);

  const setView = useCallback(
    (v: View) => router.push(v === "contacts" ? "/directory" : `/directory?view=${v}`),
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

  async function runImport(sync: boolean) {
    setImporting(true);
    try {
      const res = await fetch("/api/directory/import-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetId: MASTER_SHEET }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(
          `${sync ? "Synced" : "Imported"} — ${data.imported} new, ${data.updated} updated`
        );
        await loadContacts();
        await loadCategories();
      } else {
        showToast(data.error || "Import failed");
      }
    } catch {
      showToast("Import failed — check the connection");
    } finally {
      setImporting(false);
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
    const base = view === "recent" ? [...contacts] : [...contacts];
    const arr = [...base];
    switch (sortKey) {
      case "name":
        arr.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "category":
        arr.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
        break;
      case "rating":
        arr.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || a.name.localeCompare(b.name));
        break;
      case "recent":
      default:
        arr.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    }
    return view === "recent" ? arr.slice(0, 60) : arr;
  }, [contacts, sortKey, view]);

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

  const VIEW_TABS: { key: View; label: string; icon: React.ElementType }[] = [
    { key: "contacts", label: "All Contacts", icon: ContactIcon },
    { key: "categories", label: "By Category", icon: Tags },
    { key: "radar", label: "Radar", icon: RadarIcon },
    { key: "recent", label: "Recently Added", icon: Clock },
  ];

  const showContactTools = view === "contacts" || view === "recent";

  return (
    <div className="min-h-full px-6 py-8 pb-28">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: ACCENT }}>
              OutlanderOS · Directory
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">
              {view === "radar" ? "Outlander Radar" : "Contact Directory"}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {view === "radar"
                ? "Emerging talent, creators & accounts we think will be big."
                : "Outlander's network of contacts, collaborators & talent."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {view !== "radar" && (
              <>
                <button
                  onClick={() => runImport(false)}
                  disabled={importing}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm font-medium text-gray-600 hover:border-[var(--ring)] disabled:opacity-50"
                  title="Import contacts from the master Google Sheet"
                >
                  {importing ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Download size={15} />
                  )}
                  Import from Google Sheet
                </button>
                <button
                  onClick={() => runImport(true)}
                  disabled={importing}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm font-medium text-gray-600 hover:border-[var(--ring)] disabled:opacity-50"
                  title="Re-sync from the sheet (updates existing, adds new)"
                >
                  <RefreshCw size={15} className={importing ? "animate-spin" : ""} /> Sync Sheet
                </button>
              </>
            )}
            {view === "radar" ? (
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
            return (
              <button
                key={t.key}
                onClick={() => setView(t.key)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                  isActive ? "text-black" : "text-gray-500 hover:text-gray-900"
                }`}
                style={isActive ? { backgroundColor: ACCENT } : undefined}
              >
                <Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Search + filters + tools */}
        {view !== "categories" && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
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
                  <option value="recent">Recently added</option>
                  <option value="name">Name (A–Z)</option>
                  <option value="category">Category</option>
                  <option value="rating">Rating</option>
                </select>
                <div className="flex items-center rounded-lg border border-border bg-card p-0.5">
                  <button
                    onClick={() => setDisplayMode("grid")}
                    className={`rounded-md p-1.5 ${displayMode === "grid" ? "text-black" : "text-gray-500 hover:text-gray-900"}`}
                    style={displayMode === "grid" ? { backgroundColor: ACCENT } : undefined}
                    title="Grid view"
                  >
                    <LayoutGrid size={15} />
                  </button>
                  <button
                    onClick={() => setDisplayMode("list")}
                    className={`rounded-md p-1.5 ${displayMode === "list" ? "text-black" : "text-gray-500 hover:text-gray-900"}`}
                    style={displayMode === "list" ? { backgroundColor: ACCENT } : undefined}
                    title="List view"
                  >
                    <ListIcon size={15} />
                  </button>
                </div>
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
            {(search || category || radarStatusFilter || sortKey !== "recent") && (
              <button
                onClick={() => {
                  setSearch("");
                  setCategory("");
                  setRadarStatusFilter("");
                  setSortKey("recent");
                }}
                className="px-2 py-1 text-xs font-medium text-gray-500 hover:text-gray-900"
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
                  : "border-border text-gray-500 hover:text-gray-900"
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
                        : "border-border text-gray-500 hover:text-gray-900"
                    }`}
                    style={active ? { backgroundColor: ACCENT } : undefined}
                  >
                    {c.category}
                    <span className={active ? "text-black/60" : "text-gray-600"}>{c.count}</span>
                  </button>
                );
              })}
          </div>
        )}

        {/* Body */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="animate-spin text-gray-600" size={24} />
          </div>
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
          <ContactsView
            contacts={sortedContacts}
            mode={displayMode}
            selected={selected}
            onToggleSelect={toggleSelect}
            onEdit={(c) => setEditing(c)}
            onAdd={() => setEditing(null)}
          />
        )}
      </div>

      {/* Floating share bar */}
      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-5">
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card/95 px-4 py-3 shadow-2xl backdrop-blur">
            <span className="text-sm font-semibold text-gray-900">
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
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-gray-400 hover:text-gray-900"
            >
              <X size={15} /> Clear selection
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed inset-x-0 bottom-24 z-50 flex justify-center px-4">
          <div className="rounded-xl border border-border bg-popover px-4 py-2.5 text-sm font-medium text-gray-900 shadow-xl">
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

// ── Contacts view (grid / list) ────────────────────────────────────────────────

function ContactsView({
  contacts,
  mode,
  selected,
  onToggleSelect,
  onEdit,
  onAdd,
}: {
  contacts: ContactRecord[];
  mode: DisplayMode;
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onEdit: (c: ContactRecord) => void;
  onAdd: () => void;
}) {
  if (contacts.length === 0) {
    return (
      <EmptyState
        icon={ContactIcon}
        title="No contacts yet"
        body="Build out Outlander's network — import your master sheet, or add photographers, stylists and brand contacts."
        action="Add your first contact"
        onAction={onAdd}
      />
    );
  }

  if (mode === "list") {
    return (
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {contacts.map((c, i) => (
          <ContactRow
            key={c.id}
            contact={c}
            selected={selected.has(c.id)}
            onToggleSelect={() => onToggleSelect(c.id)}
            onEdit={() => onEdit(c)}
            last={i === contacts.length - 1}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {contacts.map((c) => (
        <ContactCard
          key={c.id}
          contact={c}
          selected={selected.has(c.id)}
          onToggleSelect={() => onToggleSelect(c.id)}
          onEdit={() => onEdit(c)}
        />
      ))}
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
      className={selected ? "" : "text-gray-600 hover:text-gray-300"}
      style={selected ? { color: ACCENT } : undefined}
      title={selected ? "Deselect" : "Select"}
    >
      {selected ? <CheckSquare size={18} /> : <Square size={18} />}
    </button>
  );
}

function QuickActions({ contact, onEdit }: { contact: ContactRecord; onEdit: () => void }) {
  const handle = igHandle(contact.instagram);
  return (
    <div className="flex items-center gap-1.5">
      {contact.email && (
        <a
          href={`mailto:${contact.email}`}
          onClick={(e) => e.stopPropagation()}
          className="rounded-md p-1.5 text-gray-500 hover:bg-secondary hover:text-gray-900"
          title="Email"
        >
          <Mail size={14} />
        </a>
      )}
      {contact.phone && (
        <a
          href={`tel:${contact.phone}`}
          onClick={(e) => e.stopPropagation()}
          className="rounded-md p-1.5 text-gray-500 hover:bg-secondary hover:text-gray-900"
          title="Call"
        >
          <Phone size={14} />
        </a>
      )}
      {handle && (
        <a
          href={`https://www.instagram.com/${handle}/`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="rounded-md p-1.5 text-gray-500 hover:bg-secondary hover:text-[#dc2743]"
          title={`@${handle}`}
        >
          <Instagram size={14} />
        </a>
      )}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onEdit();
        }}
        className="rounded-md p-1.5 text-gray-500 hover:bg-secondary hover:text-gray-900"
        title="Edit"
      >
        <Pencil size={14} />
      </button>
    </div>
  );
}

function ContactCard({
  contact: c,
  selected,
  onToggleSelect,
  onEdit,
}: {
  contact: ContactRecord;
  selected: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
}) {
  const handle = igHandle(c.instagram);
  return (
    <Link
      href={`/directory/${c.id}`}
      className={`group relative flex flex-col gap-2 rounded-xl border bg-card p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--ring)] hover:shadow-lg ${
        selected ? "border-[var(--ring)]" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 min-w-0">
          <span
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-gray-500"
            aria-hidden
          >
            {c.name.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900">{c.name}</p>
            {(c.role || c.company) && (
              <p className="truncate text-xs text-gray-500">
                {[c.role, c.company].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        </div>
        <SelectBox selected={selected} onToggle={onToggleSelect} />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <CategoryBadge category={c.category} />
        {c.rating ? <Stars rating={c.rating} /> : null}
        {c.location && (
          <span className="inline-flex items-center gap-1 text-[10px] text-gray-500">
            <MapPin size={10} /> {c.location}
          </span>
        )}
      </div>
      {handle && (
        <span className="inline-flex w-fit items-center gap-1 text-[11px] font-medium text-[#dc2743]">
          <Instagram size={11} /> @{handle}
        </span>
      )}
      <div className="mt-1 flex items-center justify-between border-t border-border pt-2">
        <span className="truncate text-[11px] text-gray-600">
          {c.email || c.phone || ""}
        </span>
        <span className="opacity-0 transition-opacity group-hover:opacity-100">
          <QuickActions contact={c} onEdit={onEdit} />
        </span>
      </div>
    </Link>
  );
}

function ContactRow({
  contact: c,
  selected,
  onToggleSelect,
  onEdit,
  last,
}: {
  contact: ContactRecord;
  selected: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
  last: boolean;
}) {
  const handle = igHandle(c.instagram);
  return (
    <Link
      href={`/directory/${c.id}`}
      className={`group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary ${
        last ? "" : "border-b border-border"
      } ${selected ? "bg-secondary" : ""}`}
    >
      <SelectBox selected={selected} onToggle={onToggleSelect} />
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold text-gray-500">
        {c.name.slice(0, 2).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-gray-900">{c.name}</p>
          {c.rating ? <Stars rating={c.rating} /> : null}
        </div>
        <p className="truncate text-xs text-gray-500">
          {[c.role, c.company].filter(Boolean).join(" · ")}
        </p>
      </div>
      <div className="hidden w-32 shrink-0 sm:block">
        <CategoryBadge category={c.category} />
      </div>
      {handle && (
        <span className="hidden items-center gap-1 text-[11px] font-medium text-[#dc2743] md:inline-flex">
          <Instagram size={11} /> @{handle}
        </span>
      )}
      <span className="opacity-0 transition-opacity group-hover:opacity-100">
        <QuickActions contact={c} onEdit={onEdit} />
      </span>
    </Link>
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
          <span className="text-sm font-semibold text-gray-900">{c.category}</span>
          <span className="inline-flex items-center gap-2 text-xs text-gray-500">
            <span className="rounded-full border border-border px-2 py-0.5 font-semibold text-gray-600">
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
  WATCHING: "border-gray-600 text-gray-300",
  REACHED_OUT: "border-amber-700 text-amber-300",
  CONNECTED: "border-sky-700 text-sky-300",
  COLLABORATING: "border-emerald-700 text-emerald-300",
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
                <p className="truncate text-sm font-semibold text-gray-900">{e.name}</p>
                <CategoryBadge category={e.category} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
                {link && (
                  <a
                    href={link.startsWith("http") ? link : `https://${link.replace(/^@/, "instagram.com/")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(ev) => ev.stopPropagation()}
                    className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-900"
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
              {e.notes && <p className="mt-1.5 text-xs text-gray-400 line-clamp-2">{e.notes}</p>}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onCycle(e)}
                title="Click to advance status"
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors hover:bg-secondary ${
                  RADAR_STATUS_STYLE[status] ?? "border-gray-300 text-gray-600"
                }`}
              >
                {RADAR_STATUS_LABELS[status] ?? status}
              </button>
              <button
                onClick={() => onConvert(e)}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-medium text-gray-600 hover:border-emerald-500 hover:text-emerald-600"
                title="Promote to a full contact"
              >
                <UserPlus size={12} /> Convert
              </button>
              <button
                onClick={() => onEdit(e)}
                className="rounded-lg border border-border p-1.5 text-gray-500 hover:text-gray-900"
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
      <Icon size={28} className="mb-3 text-gray-600" />
      <p className="text-sm font-semibold text-gray-900">{title}</p>
      <p className="mt-1 max-w-md text-xs text-gray-500">{body}</p>
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
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900">
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
              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-red-400"
            >
              <Trash2 size={13} /> Delete
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="rounded-lg px-3 py-2 text-sm text-gray-400 hover:text-gray-900">
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
              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-red-400"
            >
              <Trash2 size={13} /> Remove
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="rounded-lg px-3 py-2 text-sm text-gray-400 hover:text-gray-900">
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
