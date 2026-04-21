"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Bell, ChevronDown, MessageCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PORTALS = [
  { name: "Commercial", href: "/commercial" },
  { name: "Production", href: "/production" },
  { name: "Print", href: "/print" },
  { name: "Editorial", href: "/editorial" },
  { name: "Contacts", href: "/contacts" },
  { name: "Finance", href: "/finance" },
  { name: "Admin", href: "/admin" },
  { name: "Ask OS", href: "/ask-os" },
];

function getPortalName(pathname: string): string {
  for (const p of PORTALS) {
    if (pathname.startsWith(p.href)) return p.name;
  }
  return "Portal";
}

function buildBreadcrumb(pathname: string): string[] {
  const segments = pathname.split("/").filter(Boolean);
  return segments.map((s) =>
    s
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
  );
}

export function PortalHeader() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const portalName = getPortalName(pathname);
  const breadcrumb = buildBreadcrumb(pathname);

  const initials = session?.user?.name
    ? session.user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <header
      className="flex h-14 shrink-0 items-center justify-between px-5"
      style={{
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        background: "rgba(255,255,255,0.85)",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
        position: "sticky",
        top: 0,
        zIndex: 40,
      }}
    >
      {/* Left: Logo + breadcrumb */}
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="text-sm font-bold text-gray-900 hover:text-[#D4A853] transition-colors"
        >
          Outlander<span className="text-[#D4A853]">OS</span>
        </Link>
        <span className="text-gray-200">/</span>

        {/* Quick-switch dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-gray-800 hover:bg-gray-100/80 outline-none transition-colors">
            {portalName}
            <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-48 rounded-xl border-0 bg-white/90 shadow-xl"
            style={{ backdropFilter: "blur(20px)", border: "1px solid rgba(0,0,0,0.08)" }}
          >
            <DropdownMenuLabel className="text-xs text-gray-400">Switch Portal</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-gray-100" />
            {PORTALS.map((p) => (
              <DropdownMenuItem
                key={p.href}
                className={`text-sm cursor-pointer rounded-lg mx-1 ${
                  pathname.startsWith(p.href)
                    ? "bg-amber-50 text-amber-700 font-medium"
                    : "text-gray-700 focus:bg-gray-50"
                }`}
                onClick={() => router.push(p.href)}
              >
                {p.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Sub-breadcrumb */}
        {breadcrumb.length > 1 && (
          <>
            <span className="text-gray-200">/</span>
            <span className="text-sm text-gray-500">
              {breadcrumb[breadcrumb.length - 1]}
            </span>
          </>
        )}
      </div>

      {/* Right: actions + user */}
      <div className="flex items-center gap-1.5">
        {/* Ask OS */}
        <Link
          href="/ask-os"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-amber-50 hover:text-[#D4A853] transition-colors"
          title="Ask OS"
        >
          <MessageCircle className="h-4 w-4" />
        </Link>

        {/* Notifications */}
        <button className="relative flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100/80 transition-colors">
          <Bell className="h-4 w-4" />
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#D4A853] text-[10px] font-bold text-black">
            3
          </span>
        </button>

        {/* User */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-100/80 outline-none transition-colors">
            <Avatar className="h-7 w-7">
              <AvatarImage src={session?.user?.image ?? undefined} />
              <AvatarFallback className="bg-[#D4A853] text-xs font-bold text-black">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-gray-800">
              {session?.user?.name?.split(" ")[0] ?? "User"}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-48 rounded-xl border-0 bg-white/90 shadow-xl"
            style={{ backdropFilter: "blur(20px)", border: "1px solid rgba(0,0,0,0.08)" }}
          >
            <DropdownMenuLabel className="text-gray-500 text-xs">
              {session?.user?.email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-gray-100" />
            <DropdownMenuItem
              className="text-gray-700 focus:bg-gray-50 cursor-pointer rounded-lg mx-1"
              onClick={() => router.push("/admin/settings")}
            >
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-gray-700 focus:bg-gray-50 cursor-pointer rounded-lg mx-1"
              onClick={() => router.push("/")}
            >
              Calendar
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-gray-700 focus:bg-gray-50 cursor-pointer rounded-lg mx-1"
              onClick={() => router.push("/hub")}
            >
              Hub
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-gray-100" />
            <DropdownMenuItem
              className="text-red-500 focus:bg-gray-50 focus:text-red-500 cursor-pointer rounded-lg mx-1"
              onClick={() => signOut({ callbackUrl: "/auth/signin" })}
            >
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
