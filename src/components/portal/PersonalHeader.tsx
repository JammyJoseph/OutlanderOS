"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { User as UserIcon } from "lucide-react";
import { PortalSwitcher } from "@/components/portal/PortalSwitcher";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useUser } from "@/components/user-context";

export function PersonalHeader() {
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // User data comes from the shared UserProvider (single /api/me fetch) instead
  // of a per-header fetch.
  const { user: me } = useUser();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/login");
  }

  const initials = (me?.name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card/80 backdrop-blur-md px-5 sticky top-0 z-30">
      {/* Left: Logo + dashboard label */}
      <div className="flex items-center gap-3">
        <Link
          href="/me"
          className="text-sm font-bold text-gray-900 dark:text-gray-100 hover:text-[#9C7C2E] transition-colors"
        >
          Outlander<span className="text-[#9C7C2E]">OS</span>
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">My Dashboard</span>
      </div>

      {/* Right */}
      <div className="flex items-center gap-1">
        {/* Portals dropdown (shared with PortalHeader) */}
        <PortalSwitcher />

        {/* Theme toggle */}
        <ThemeToggle />

        {/* Notifications (shared unified bell) */}
        <NotificationBell />

        {/* Profile */}
        <div className="relative ml-1" ref={profileRef}>
          <button
            onClick={() => setProfileOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#9C7C2E]/15 text-[10px] font-bold text-[#9C7C2E]">
              {initials || <UserIcon className="h-3.5 w-3.5" />}
            </div>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300 hidden sm:inline">
              {me?.name?.split(/\s+/)[0] ?? "Me"}
            </span>
          </button>
          {profileOpen && (
            <div className="absolute right-0 top-full mt-1 w-52 rounded-xl bg-popover border border-border shadow-lg shadow-black/40 z-50 overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800">
                <div className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">{me?.name}</div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{me?.email}</div>
              </div>
              <button
                onClick={() => { router.push("/me/profile"); setProfileOpen(false); }}
                className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Profile
              </button>
              <button
                onClick={() => { router.push("/me/settings"); setProfileOpen(false); }}
                className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Settings
              </button>
              <div className="h-px bg-gray-100 dark:bg-gray-800" />
              <button
                onClick={logout}
                className="w-full px-3 py-2 text-left text-sm text-[#ff6b6b] hover:bg-[#ff6b6b]/10"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
