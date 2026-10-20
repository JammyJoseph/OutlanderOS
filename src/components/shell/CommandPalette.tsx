"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowRight, CornerDownLeft, Search } from "lucide-react";
import { useUser } from "@/components/user-context";
import { visibleWorkspaces } from "@/lib/workspaces";

interface Hit {
  id: string;
  href: string;
  title: string;
  detail?: string;
  /** A workspace dot colour, or initials for a person. */
  mark?: { dot?: string; initials?: string; icon?: boolean };
}
interface Group {
  label: string;
  hits: Hit[];
}

const DOT = { deal: "#9C7C2E", production: "#A93B2E", client: "#9C7C2E" };

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase();

/** Wraps each case-insensitive occurrence of `q` in <mark>. */
function Highlight({ text, q }: { text: string; q: string }) {
  if (q.length < 2) return <>{text}</>;
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig"));
  return (
    <>
      {parts.map((p, i) =>
        p.toLowerCase() === q.toLowerCase() ? (
          <mark key={i} className="rounded-[3px] bg-[#D3E8FF] px-px text-foreground dark:bg-[#2A4E7A]">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

/**
 * ⌘K. Pages first (instant, from the workspace config), then records from
 * /api/search once you've typed two letters. Arrow keys move, Enter opens,
 * Escape closes and gives focus back to whatever opened it.
 */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { user } = useUser();
  const [q, setQ] = useState("");
  const [records, setRecords] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const listId = useId();

  const pages = useMemo<Hit[]>(() => {
    const out: Hit[] = [];
    for (const w of visibleWorkspaces(user?.role === "ADMIN")) {
      for (const n of w.nav) {
        out.push({
          id: `${w.key}:${n.href}`,
          href: n.href,
          title: w.key === "me" ? n.label : `${w.name} · ${n.label}`,
          mark: { dot: w.key === "me" ? undefined : w.dot, icon: w.key === "me" },
        });
      }
    }
    return out;
  }, [user?.role]);

  const workspaces = useMemo<Hit[]>(
    () =>
      visibleWorkspaces(user?.role === "ADMIN").map((w) => ({
        id: `ws:${w.key}`,
        href: w.href,
        title: w.name,
        detail: w.blurb,
        mark: { dot: w.key === "me" ? undefined : w.dot, icon: w.key === "me" },
      })),
    [user?.role],
  );

  const groups = useMemo<Group[]>(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [{ label: "Workspaces", hits: workspaces }];
    const pageHits = pages.filter((p) => p.title.toLowerCase().includes(term)).slice(0, 6);
    return [...records, { label: "Pages", hits: pageHits }].filter((g) => g.hits.length > 0);
  }, [q, pages, records, workspaces]);

  const flat = useMemo(() => groups.flatMap((g) => g.hits), [groups]);

  // Open: remember focus, reset, focus the box. Close: hand focus back.
  useEffect(() => {
    if (open) {
      returnTo.current = document.activeElement as HTMLElement | null;
      setQ("");
      setRecords([]);
      setActive(0);
      requestAnimationFrame(() => input.current?.focus());
    } else {
      returnTo.current?.focus?.();
    }
  }, [open]);

  // Records, debounced, and only the newest answer wins.
  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < 2) {
      setRecords([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error();
        const d = await res.json();
        setRecords([
          { label: "Deals", hits: (d.deals ?? []).map((h: Hit) => ({ ...h, mark: { dot: DOT.deal } })) },
          { label: "Productions", hits: (d.productions ?? []).map((h: Hit) => ({ ...h, mark: { dot: DOT.production } })) },
          { label: "Clients", hits: (d.clients ?? []).map((h: Hit) => ({ ...h, mark: { dot: DOT.client } })) },
          { label: "Contacts", hits: (d.contacts ?? []).map((h: Hit) => ({ ...h, mark: { initials: initials(h.title) } })) },
        ]);
        setActive(0);
      } catch {
        if (!ctrl.signal.aborted) setRecords([]);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 160);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, open]);

  const go = useCallback(
    (hit: Hit | undefined) => {
      if (!hit) return;
      onClose();
      router.push(hit.href);
    },
    [onClose, router],
  );

  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(flat.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(flat[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  let index = -1;
  const term = q.trim();
  return (
    <div className="fixed inset-0 z-[90]" onKeyDown={onKeyDown}>
      <div className="absolute inset-0 bg-[rgba(11,18,32,0.44)]" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="absolute left-1/2 top-[max(16px,8vh)] w-[680px] max-w-[calc(100%-32px)] -translate-x-1/2 overflow-hidden rounded-3xl bg-popover text-popover-foreground shadow-[0_32px_64px_-24px_rgba(11,18,32,0.5)] dark:ring-1 dark:ring-line"
      >
        <div className="flex h-[68px] items-center gap-3 border-b border-line px-5">
          <Search className="size-5 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden />
          <input
            ref={input}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={flat[active] ? `${listId}-${active}` : undefined}
            aria-label="Search deals, productions, clients, contacts and pages"
            placeholder="Search deals, productions, contacts…"
            className="h-12 min-w-0 flex-1 border-0 bg-transparent text-[19px] text-foreground outline-none placeholder:text-muted-foreground focus-visible:shadow-none"
          />
          <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-surface-2 px-1.5 text-xs text-ink-2">esc</kbd>
        </div>

        <div ref={list} id={listId} role="listbox" aria-label="Results" className="max-h-[min(640px,62vh)] overflow-auto px-3 pb-3 pt-1">
          {groups.map((g) => (
            <div key={g.label} role="group" aria-label={g.label}>
              <div className="px-3 pb-1.5 pt-3.5 text-xs font-semibold text-muted-foreground">{g.label}</div>
              {g.hits.map((h) => {
                index += 1;
                const i = index;
                const on = i === active;
                return (
                  <div
                    key={`${g.label}-${h.id}`}
                    id={`${listId}-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={on}
                    onMouseMove={() => setActive(i)}
                    onClick={() => go(h)}
                    className={`flex min-h-14 cursor-pointer items-center gap-3.5 rounded-[14px] px-3 py-2 ${on ? "bg-accent" : ""}`}
                  >
                    <span className={`flex size-10 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold ${on ? "bg-background" : "bg-surface"}`}>
                      {h.mark?.initials ? (
                        h.mark.initials
                      ) : h.mark?.dot ? (
                        <span className="size-2 rounded-full" style={{ background: h.mark.dot }} />
                      ) : (
                        <ArrowRight className="size-[18px] text-ink-2" strokeWidth={1.75} />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">
                        <Highlight text={h.title} q={term} />
                      </span>
                      {h.detail && (
                        <span className={`block truncate text-[13px] ${on ? "text-ink-2" : "text-muted-foreground"}`}>
                          <Highlight text={h.detail} q={term} />
                        </span>
                      )}
                    </span>
                    {on && (
                      <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-surface-2 px-1.5 text-ink-2">
                        <CornerDownLeft className="size-3.5" strokeWidth={1.75} aria-label="Enter" />
                      </kbd>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          {term.length >= 2 && !loading && flat.length === 0 && (
            <p className="px-3 py-8 text-center text-[15px] text-muted-foreground">Nothing found for “{term}”.</p>
          )}
          {loading && flat.length === 0 && <p className="px-3 py-8 text-center text-[15px] text-muted-foreground">Searching…</p>}
        </div>

        <div className="flex flex-wrap gap-5 border-t border-line px-6 py-3.5 text-[13px] text-muted-foreground">
          <span>
            <Kbd>↑</Kbd> <Kbd>↓</Kbd> to move
          </span>
          <span>
            <Kbd>↵</Kbd> to open
          </span>
          <span>
            <Kbd>esc</Kbd> to close
          </span>
        </div>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-surface-2 px-1.5 font-sans text-xs text-ink-2">
      {children}
    </kbd>
  );
}
