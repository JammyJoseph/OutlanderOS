"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import {
  Bell,
  ChevronDown,
  Lock,
  LayoutGrid,
  Calendar,
  Shield,
  User as UserIcon,
} from "lucide-react";

const PORTALS = [
  { name: "Commercial", href: "/commercial" },
  { name: "Production", href: "/production" },
  { name: "Finance", href: "/finance", restricted: true },
  { name: "Print", href: "/print" },
];

interface NotificationItem {
  id: string;
  type: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

interface MeUser {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string | null;
}

export function PersonalHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [portalsOpen, setPortalsOpen] = useState(false);
  const [notifsOpen, setNotifsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const portalsRef = useRef<HTMLDivElement>(null);
  const notifsRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [me, setMe] = useState<MeUser | null>(null);

  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((d) => {
        setNotifications(Array.isArray(d.notifications) ? d.notifications : []);
        setUnreadCount(d.unreadCount ?? 0);
      })
      .catch(() => {});
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setMe(d.user ?? null))
      .catch(() => {});
  }, [pathname]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (portalsRef.current && !portalsRef.current.contains(e.target as Node)) setPortalsOpen(false);
      if (notifsRef.current && !notifsRef.current.contains(e.target as Node)) setNotifsOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function markNotificationRead(n: NotificationItem) {
    if (n.read) return;
    setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    setUnreadCount((c) => Math.max(0, c - 1));
    await fetch(`/api/notifications/${n.id}`, { method: "PUT" });
  }

  async function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    await fetch("/api/notifications/mark-all-read", { method: "POST" });
  }

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
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-100 bg-white/80 backdrop-blur-md px-5 sticky top-0 z-30">
      {/* Left: Logo + dashboard label */}
      <div className="flex items-center gap-3">
        <Link
          href="/me"
          className="text-sm font-bold text-gray-900 hover:text-[#D4A853] transition-colors"
        >
          Outlander<span className="text-[#D4A853]">OS</span>
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-semibold text-gray-800">My Dashboard</span>
      </div>

      {/* Right */}
      <div className="flex items-center gap-1">
        {/* Portals dropdown */}
        <div className="relative" ref={portalsRef}>
          <button
            onClick={() => setPortalsOpen((v) => !v)}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <LayoutGrid className="h-3.5 w-3.5 text-gray-400" />
            Portals
            <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${portalsOpen ? "rotate-180" : ""}`} />
          </button>
          {portalsOpen && (
            <div className="absolute right-0 top-full mt-1 w-56 rounded-xl bg-white border border-gray-200 shadow-lg z-50 overflow-hidden">
              <div className="px-3 py-1.5 border-b border-gray-100">
                <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Switch Portal</span>
              </div>
              {PORTALS.map((p) => (
                <button
                  key={p.href}
                  onClick={() => { router.push(p.href); setPortalsOpen(false); }}
                  className="flex items-center justify-between w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <span>{p.name}</span>
                  {p.restricted && <Lock className="h-3 w-3 text-gray-400" />}
                </button>
              ))}
              <div className="h-px bg-gray-100" />
              <button
                onClick={() => { router.push("/hub"); setPortalsOpen(false); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
              >
                <LayoutGrid className="h-3.5 w-3.5 text-gray-400" />
                Hub
              </button>
              <button
                onClick={() => { router.push("/admin"); setPortalsOpen(false); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
              >
                <Shield className="h-3.5 w-3.5 text-gray-400" />
                Admin & Settings
              </button>
              <button
                onClick={() => { router.push("/"); setPortalsOpen(false); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
              >
                <Calendar className="h-3.5 w-3.5 text-gray-400" />
                Year Calendar
              </button>
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="relative" ref={notifsRef}>
          <button
            onClick={() => setNotifsOpen((v) => !v)}
            className="relative flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#D4A853] px-1 text-[10px] font-bold text-black">
                {unreadCount}
              </span>
            )}
          </button>
          {notifsOpen && (
            <div className="absolute right-0 top-full mt-1 w-80 rounded-xl bg-white border border-gray-200 shadow-lg z-50 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
                <span className="text-xs font-semibold text-gray-700">Notifications</span>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-[11px] text-[#D4A853] font-semibold hover:underline">
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-xs text-gray-400">No notifications</div>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => {
                        markNotificationRead(n);
                        if (n.link) router.push(n.link);
                      }}
                      className={`w-full text-left px-3 py-2 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                        n.read ? "opacity-60" : "bg-amber-50/30"
                      }`}
                    >
                      <div className="text-xs text-gray-800">{n.message}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        {new Date(n.createdAt).toLocaleString("en-GB", {
                          month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                        })}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile */}
        <div className="relative ml-1" ref={profileRef}>
          <button
            onClick={() => setProfileOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-gray-100 transition-colors"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-[10px] font-bold text-amber-800">
              {initials || <UserIcon className="h-3.5 w-3.5" />}
            </div>
            <span className="text-xs font-medium text-gray-700 hidden sm:inline">
              {me?.name?.split(/\s+/)[0] ?? "Me"}
            </span>
          </button>
          {profileOpen && (
            <div className="absolute right-0 top-full mt-1 w-52 rounded-xl bg-white border border-gray-200 shadow-lg z-50 overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-100">
                <div className="text-xs font-semibold text-gray-900 truncate">{me?.name}</div>
                <div className="text-[10px] text-gray-500 truncate">{me?.email}</div>
              </div>
              <button
                onClick={() => { router.push("/me/profile"); setProfileOpen(false); }}
                className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                Profile
              </button>
              <button
                onClick={() => { router.push("/me/settings"); setProfileOpen(false); }}
                className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                Settings
              </button>
              <div className="h-px bg-gray-100" />
              <button
                onClick={logout}
                className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
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
