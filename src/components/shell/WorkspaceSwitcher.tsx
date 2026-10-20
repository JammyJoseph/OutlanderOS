"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, LayoutGrid, LogOut, Search } from "lucide-react";
import { useUser } from "@/components/user-context";
import { visibleWorkspaces, type Workspace } from "@/lib/workspaces";

/**
 * The grey "Workspace · Commercial" button at the top of the sidebar, and the
 * menu it opens: a filter box, your own workspace, the portals you can use,
 * then "All workspaces" and "Log out".
 *
 * Finance and Admin only appear for admins. The role comes from /api/me, which
 * reads the database, so a freshly promoted admin sees them straight away.
 */
export function WorkspaceSwitcher({ current }: { current: Workspace }) {
  const { user } = useUser();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const menuId = useId();

  const isAdmin = user?.role === "ADMIN";
  const all = visibleWorkspaces(isAdmin);
  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? all.filter((w) => `${w.name} ${w.blurb}`.toLowerCase().includes(q)) : all;
  }, [all, filter]);
  const mine = shown.filter((w) => w.key === "me");
  const portals = shown.filter((w) => w.key !== "me");

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    setFilter("");
  };

  async function logOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/login");
  }

  return (
    <div ref={wrap} className="relative">
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        className={`flex min-h-14 w-full items-center gap-3 rounded-xl px-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground ${
          open ? "bg-background shadow-[inset_0_0_0_2px_var(--foreground)]" : "bg-surface hover:bg-surface-2"
        }`}
      >
        <span className="size-2 shrink-0 rounded-full" style={{ background: current.dot }} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-muted-foreground">
            Workspace{current.adminOnly ? " · admin" : ""}
          </span>
          <span className="block truncate font-semibold">{current.name}</span>
        </span>
        <ChevronsUpDown className="size-[18px] shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Workspaces"
          className="absolute left-0 top-[calc(100%+8px)] z-50 w-[380px] max-w-[calc(100vw-32px)] rounded-[20px] bg-popover p-3 text-popover-foreground shadow-[0_1px_2px_rgba(11,18,32,0.08),0_24px_48px_-16px_rgba(11,18,32,0.24)] dark:ring-1 dark:ring-line"
        >
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} aria-hidden />
            <input
              ref={input}
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              aria-label="Find a workspace"
              placeholder="Find a workspace"
              className="block h-12 w-full rounded-lg border-0 bg-surface pl-11 pr-4 text-[15px] text-foreground placeholder:text-muted-foreground focus-visible:shadow-[0_0_0_3px_var(--focus)] focus-visible:outline-none"
            />
          </div>

          {mine.map((w) => (
            <Option key={w.key} w={w} on={w.key === current.key} onPick={close} />
          ))}
          {portals.length > 0 && <div className="px-3 pb-1.5 pt-3 text-xs font-semibold text-muted-foreground">Portals</div>}
          {portals.map((w) => (
            <Option key={w.key} w={w} on={w.key === current.key} onPick={close} />
          ))}
          {shown.length === 0 && <p className="px-3 py-4 text-sm text-muted-foreground">No workspace matches “{filter}”.</p>}

          <div className="mx-3 my-2 h-px bg-line" />
          <Link
            href="/hub"
            role="menuitem"
            onClick={close}
            className="flex min-h-12 items-center gap-3.5 rounded-[14px] px-3 font-semibold hover:bg-surface focus-visible:bg-surface focus-visible:outline-none"
          >
            <LayoutGrid className="size-5 text-ink-2" strokeWidth={1.75} aria-hidden />
            All workspaces
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={logOut}
            className="flex min-h-12 w-full items-center gap-3.5 rounded-[14px] px-3 text-left font-semibold text-bad hover:bg-bad-bg focus-visible:bg-bad-bg focus-visible:outline-none"
          >
            <LogOut className="size-5" strokeWidth={1.75} aria-hidden />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

function Option({ w, on, onPick }: { w: Workspace; on: boolean; onPick: () => void }) {
  const Icon = w.icon;
  return (
    <Link
      href={w.href}
      role="menuitem"
      aria-current={on ? "true" : undefined}
      onClick={onPick}
      className={`flex min-h-14 items-center gap-3.5 rounded-[14px] px-3 py-2 focus-visible:outline-none ${
        on ? "bg-accent" : "hover:bg-surface focus-visible:bg-surface"
      }`}
    >
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${on ? "bg-background" : "bg-surface"}`}>
        {w.key === "me" ? (
          <Icon className="size-5 text-ink-2" strokeWidth={1.75} aria-hidden />
        ) : (
          <span className="size-2 rounded-full" style={{ background: w.dot }} aria-hidden />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 font-semibold">
          {w.name}
          {w.adminOnly && (
            <span className="inline-flex h-[22px] items-center rounded-full bg-surface-2 px-2 text-[11px] font-semibold text-ink-2">Admin</span>
          )}
        </span>
        <span className="block truncate text-[13px] text-muted-foreground">{w.blurb}</span>
      </span>
      {on && <Check className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />}
    </Link>
  );
}
