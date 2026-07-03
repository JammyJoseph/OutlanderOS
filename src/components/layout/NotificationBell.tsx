"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, AlarmClock, MessageSquare } from "lucide-react";

interface NotificationItem {
  id: string;
  type: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

interface Deadline {
  id: string;
  title: string;
  dueDate: string;
  status: string;
  priority: string;
}

// A single row in the merged feed — either a notification or an active deadline.
type FeedItem =
  | { kind: "notification"; id: string; time: number; notification: NotificationItem }
  | { kind: "deadline"; id: string; time: number; deadline: Deadline; dayDiff: number };

const DAY_MS = 86_400_000;
const NOTIF_PAGE_SIZE = 10;

function startOfDay(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// Whole-day offset from today: <0 overdue, 0 due today, >0 upcoming.
function dayDiffOf(dueDate: string): number {
  return Math.round((startOfDay(new Date(dueDate)) - startOfDay(new Date())) / DAY_MS);
}

function relTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Unified notification bell — merges personal notifications (read/unread) with
// overdue/today deadlines into one dropdown, sorted newest-first.
export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifTotal, setNotifTotal] = useState(0);
  const [notifPage, setNotifPage] = useState(1);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);

  const loadNotifications = useCallback(async (page: number) => {
    try {
      const res = await fetch(`/api/notifications?page=${page}&limit=${NOTIF_PAGE_SIZE}`);
      const d = await res.json();
      const items: NotificationItem[] = Array.isArray(d.data) ? d.data : [];
      setNotifications((prev) => (page === 1 ? items : [...prev, ...items]));
      setUnreadCount(d.unreadCount ?? 0);
      setNotifTotal(d.total ?? items.length);
      setNotifPage(page);
    } catch {
      // silent — keep whatever we already have
    }
  }, []);

  const loadDeadlines = useCallback(async () => {
    try {
      const res = await fetch("/api/deadlines");
      const d = await res.json();
      if (Array.isArray(d)) setDeadlines(d);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    loadNotifications(1);
    loadDeadlines();
    const t = setInterval(() => {
      loadNotifications(1);
      loadDeadlines();
    }, 60_000);
    return () => clearInterval(t);
  }, [loadNotifications, loadDeadlines]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function markRead(n: NotificationItem) {
    if (!n.read) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnreadCount((c) => Math.max(0, c - 1));
      await fetch(`/api/notifications/${n.id}`, { method: "PUT" }).catch(() => {});
    }
    if (n.link) router.push(n.link);
    setOpen(false);
  }

  async function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    await fetch("/api/notifications/mark-all-read", { method: "POST" }).catch(() => {});
  }

  // Active (overdue or due-today) deadlines drive the badge alongside unread notifs.
  const activeDeadlines = deadlines
    .filter((d) => d.status !== "COMPLETED")
    .map((d) => ({ d, dayDiff: dayDiffOf(d.dueDate) }))
    .filter(({ dayDiff }) => dayDiff <= 0);
  const overdueCount = activeDeadlines.filter(({ dayDiff }) => dayDiff < 0).length;
  const todayCount = activeDeadlines.filter(({ dayDiff }) => dayDiff === 0).length;

  const badgeTotal = unreadCount + activeDeadlines.length;
  const badgeColor =
    overdueCount > 0
      ? "bg-red-500 text-white"
      : unreadCount > 0 || todayCount > 0
      ? "bg-[#ffd700] text-black"
      : "bg-gray-400 text-white";

  // Merge both sources into one feed, newest-first.
  const feed: FeedItem[] = [
    ...notifications.map(
      (n): FeedItem => ({
        kind: "notification",
        id: `n-${n.id}`,
        time: new Date(n.createdAt).getTime(),
        notification: n,
      })
    ),
    ...activeDeadlines.map(
      ({ d, dayDiff }): FeedItem => ({
        kind: "deadline",
        id: `d-${d.id}`,
        time: new Date(d.dueDate).getTime(),
        deadline: d,
        dayDiff,
      })
    ),
  ].sort((a, b) => b.time - a.time);

  const canLoadMore = notifications.length < notifTotal;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {badgeTotal > 0 && (
          <span
            className={`absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${badgeColor}`}
          >
            {badgeTotal}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-9 z-50 w-80 rounded-xl border border-border bg-popover shadow-lg shadow-black/40 overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-4 py-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                Notifications
              </p>
              <div className="mt-1 flex items-center gap-3 text-[11px]">
                {overdueCount > 0 && (
                  <span className="flex items-center gap-1 font-semibold text-red-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                    {overdueCount} overdue
                  </span>
                )}
                {todayCount > 0 && (
                  <span className="flex items-center gap-1 font-semibold text-amber-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    {todayCount} due today
                  </span>
                )}
                {unreadCount > 0 && (
                  <span className="flex items-center gap-1 font-semibold text-[#ffd700]">
                    {unreadCount} unread
                  </span>
                )}
                {badgeTotal === 0 && <span className="text-gray-400">All caught up.</span>}
              </div>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="shrink-0 text-[11px] font-semibold text-[#ffd700] hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <ul className="max-h-80 overflow-y-auto">
            {feed.length === 0 ? (
              <li className="px-4 py-6 text-center text-xs text-gray-400">Nothing new.</li>
            ) : (
              feed.map((item) =>
                item.kind === "notification" ? (
                  <li key={item.id}>
                    <button
                      onClick={() => markRead(item.notification)}
                      className={`w-full text-left flex items-start gap-2.5 px-4 py-2.5 border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                        item.notification.read ? "opacity-60" : "bg-[#ffd700]/5"
                      }`}
                    >
                      <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs text-gray-800 dark:text-gray-200">
                          {item.notification.message}
                        </span>
                        <span className="mt-0.5 block text-[10px] text-gray-400">
                          {relTime(item.notification.createdAt)}
                        </span>
                      </span>
                    </button>
                  </li>
                ) : (
                  <li key={item.id}>
                    <Link
                      href="/me"
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <AlarmClock className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                      <span className="min-w-0 flex-1 truncate text-xs text-gray-800 dark:text-gray-200">
                        {item.deadline.title}
                      </span>
                      <span
                        className={`shrink-0 text-[10px] uppercase tracking-wide ${
                          item.dayDiff < 0 ? "font-bold text-red-600" : "font-semibold text-amber-600"
                        }`}
                      >
                        {item.dayDiff < 0 ? `${Math.abs(item.dayDiff)}d overdue` : "Today"}
                      </span>
                    </Link>
                  </li>
                )
              )
            )}
          </ul>

          {canLoadMore && (
            <button
              onClick={() => loadNotifications(notifPage + 1)}
              className="w-full border-t border-gray-100 dark:border-gray-800 px-4 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Load more
            </button>
          )}

          <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-2">
            <Link
              href="/me"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
            >
              View all deadlines →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
