"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { LogOut, Menu, Search, SlidersHorizontal, User, X } from "lucide-react";
import { useUser } from "@/components/user-context";
import { isNavActive, workspaceFor, type Workspace } from "@/lib/workspaces";
import { writePref } from "@/lib/use-pref";
import { Logo } from "./Logo";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { CommandPalette } from "./CommandPalette";

/**
 * The frame every signed-in page sits in, from the redesign:
 *   a 248px navy sidebar — logo, workspace switcher, that workspace's pages —
 *   and, top right of the white content, Search (⌘K) and you.
 *
 * The sidebar is navy by giving it the `dark` class: the navy colourway's
 * tokens then apply inside it and nowhere else, so the logo, switcher and nav
 * pick up their navy versions with no separate styles to keep in step.
 *
 * Pages keep their own content width and padding; the shell only owns the
 * frame, so nothing inside a page moved when this replaced the old headers.
 * Below 1024px the sidebar becomes a menu behind a button.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const workspace = workspaceFor(pathname);
  // The phone menu remembers the page it was opened on, so going anywhere
  // closes it without an effect.
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const menuOpen = menuFor === pathname;
  const setMenuOpen = (open: boolean) => setMenuFor(open ? pathname : null);

  // Remember the last workspace for the hub's "Last used" card and its
  // skip-this-screen option. A per-browser convenience, so localStorage.
  useEffect(() => {
    writePref(LAST_WORKSPACE_KEY, workspace.key);
  }, [workspace.key]);

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-primary focus:px-5 focus:py-3 focus:font-semibold focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <aside className="dark hidden w-[248px] shrink-0 overflow-y-auto overflow-x-hidden bg-background text-foreground lg:block print:hidden" aria-label="Workspace">
        <SidebarBody workspace={workspace} />
      </aside>

      {menuOpen && (
        <div className="fixed inset-0 z-[80] lg:hidden print:hidden">
          <div className="absolute inset-0 bg-[rgba(11,18,32,0.44)]" onClick={() => setMenuOpen(false)} aria-hidden />
          <div role="dialog" aria-modal="true" aria-label="Menu" className="dark absolute inset-y-0 left-0 w-[min(300px,86vw)] overflow-y-auto bg-background text-foreground shadow-2xl">
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-6 flex size-11 items-center justify-center rounded-full hover:bg-surface"
            >
              <X className="size-5" strokeWidth={1.75} />
            </button>
            <SidebarBody workspace={workspace} />
          </div>
        </div>
      )}

      <main id="main" className="min-w-0 flex-1 overflow-y-auto" tabIndex={-1}>
        <div className="flex items-center justify-between gap-3 px-4 pt-5 sm:px-8 lg:justify-end lg:px-12 lg:pt-7 print:hidden">
          <div className="flex items-center gap-2 lg:hidden">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              className="flex size-11 items-center justify-center rounded-full hover:bg-surface"
            >
              <Menu className="size-5" strokeWidth={1.75} />
            </button>
            <Logo className="h-[18px]" />
          </div>
          <div className="flex items-center gap-3">
            <SearchLauncher />
            <AccountMenu />
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}

export const LAST_WORKSPACE_KEY = "os:last-workspace";

/** The Search pill, its ⌘K / "/" shortcuts, and the palette it opens. */
export function SearchLauncher() {
  const [open, setOpen] = useState(false);

  // ⌘K / Ctrl+K anywhere, and "/" when you're not typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable='true']");
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-keyshortcuts="Meta+K Control+K"
        className="inline-flex h-11 items-center gap-2 rounded-full bg-background pl-4 pr-4 text-[15px] font-medium text-muted-foreground shadow-[inset_0_0_0_1px_#CDD4DD] hover:bg-surface dark:shadow-[inset_0_0_0_1px_var(--field)] sm:pr-5"
      >
        <Search className="size-[18px]" strokeWidth={1.75} aria-hidden />
        <span className="hidden sm:inline">Search</span>
        <span className="sr-only sm:hidden">Search</span>
        <span className="ml-3 hidden text-xs sm:inline" aria-hidden>
          ⌘K
        </span>
      </button>
      <CommandPalette open={open} onClose={close} />
    </>
  );
}

function SidebarBody({ workspace }: { workspace: Workspace }) {
  const pathname = usePathname() ?? "/";
  const params = useSearchParams();
  return (
    <div className="flex flex-col gap-7 px-6 py-8">
      <div className="px-4">
        <Logo className="h-5" />
      </div>
      <WorkspaceSwitcher current={workspace} />
      <nav aria-label={workspace.name} className="flex flex-col gap-0.5">
        {workspace.nav.map((item) => {
          const on = isNavActive(item, pathname, params, workspace);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={on ? "page" : undefined}
              className={`flex min-h-11 items-center gap-3.5 rounded-[22px] px-4 py-2 text-[15px] leading-tight transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground ${
                on ? "bg-accent font-semibold text-foreground" : "text-ink-2 hover:bg-surface hover:text-foreground"
              }`}
            >
              <Icon className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

/** The round initials button, and a small menu: you, Profile, Settings, Log out. */
export function AccountMenu() {
  const { user } = useUser();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
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

  const initials = (user?.name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  async function logOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/login");
  }

  const item =
    "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] hover:bg-surface focus-visible:bg-surface focus-visible:outline-none";

  return (
    <div ref={wrap} className="relative">
      <button
        ref={button}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={user?.name ? `${user.name}, your account` : "Your account"}
        className="flex size-11 items-center justify-center rounded-full bg-accent text-sm font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
      >
        {initials || <User className="size-5" strokeWidth={1.75} />}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-[calc(100%+8px)] z-50 w-64 rounded-[20px] bg-popover p-2 shadow-[0_1px_2px_rgba(11,18,32,0.08),0_24px_48px_-16px_rgba(11,18,32,0.24)] dark:ring-1 dark:ring-line">
          <div className="px-3 pb-2 pt-2">
            <div className="truncate font-semibold">{user?.name}</div>
            <div className="truncate text-[13px] text-muted-foreground">{user?.email}</div>
          </div>
          <div className="mx-3 my-1 h-px bg-line" />
          <Link role="menuitem" href="/me/profile" className={item} onClick={() => setOpen(false)}>
            <User className="size-5 text-ink-2" strokeWidth={1.75} aria-hidden /> Profile
          </Link>
          <Link role="menuitem" href="/me/settings" className={item} onClick={() => setOpen(false)}>
            <SlidersHorizontal className="size-5 text-ink-2" strokeWidth={1.75} aria-hidden /> Settings
          </Link>
          <button role="menuitem" type="button" onClick={logOut} className={`${item} font-semibold text-bad hover:bg-bad-bg focus-visible:bg-bad-bg`}>
            <LogOut className="size-5" strokeWidth={1.75} aria-hidden /> Log out
          </button>
        </div>
      )}
    </div>
  );
}
