"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Bell, ChevronDown, MessageCircle, Lock, LayoutGrid } from "lucide-react";
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
  { name: "Finance", href: "/finance", restricted: true },
  { name: "Admin", href: "/admin", restricted: true },
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
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-5">
      {/* Left: Logo + breadcrumb */}
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="text-sm font-bold text-gray-900 hover:text-[#D4A853] transition-colors"
        >
          Outlander<span className="text-[#D4A853]">OS</span>
        </Link>
        <span className="text-gray-300">/</span>

        {/* Quick-switch dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-1 rounded-md px-2 py-1 text-sm font-semibold text-gray-800 hover:bg-gray-100 outline-none transition-colors">
            {portalName}
            <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52 border-gray-200 bg-white">
            <DropdownMenuItem
              className="text-sm cursor-pointer text-gray-500 focus:bg-gray-50"
              onClick={() => router.push("/hub")}
            >
              <LayoutGrid className="h-3.5 w-3.5 mr-2 text-gray-400" />
              ← Back to Hub
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-gray-100" />
            <DropdownMenuLabel className="text-xs text-gray-400">Switch Portal</DropdownMenuLabel>
            {PORTALS.map((p) => (
              <DropdownMenuItem
                key={p.href}
                className={`text-sm cursor-pointer ${
                  pathname.startsWith(p.href)
                    ? "bg-amber-50 text-amber-700 font-medium"
                    : "text-gray-700 focus:bg-gray-50"
                }`}
                onClick={() => router.push(p.href)}
              >
                <span className="flex-1">{p.name}</span>
                {p.restricted && <Lock className="h-3 w-3 text-gray-400 ml-1.5" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Sub-breadcrumb */}
        {breadcrumb.length > 1 && (
          <>
            <span className="text-gray-300">/</span>
            <span className="text-sm text-gray-500">
              {breadcrumb[breadcrumb.length - 1]}
            </span>
          </>
        )}
      </div>

      {/* Right: actions + user */}
      <div className="flex items-center gap-2">
        {/* Ask OS */}
        <Link
          href="/ask-os"
          className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-amber-50 hover:text-[#D4A853] transition-colors"
          title="Ask OS"
        >
          <MessageCircle className="h-4 w-4" />
        </Link>

        {/* Notifications */}
        <button className="relative flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 transition-colors">
          <Bell className="h-4 w-4" />
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#D4A853] text-[10px] font-bold text-black">
            3
          </span>
        </button>

        {/* User */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-gray-100 outline-none transition-colors">
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
          <DropdownMenuContent align="end" className="w-48 border-gray-200 bg-white">
            <DropdownMenuLabel className="text-gray-500 text-xs">
              {session?.user?.email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-gray-200" />
            <DropdownMenuItem
              className="text-gray-700 focus:bg-gray-100 cursor-pointer"
              onClick={() => router.push("/admin/settings")}
            >
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-gray-700 focus:bg-gray-100 cursor-pointer"
              onClick={() => router.push("/")}
            >
              Hub
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-gray-200" />
            <DropdownMenuItem
              className="text-red-500 focus:bg-gray-100 focus:text-red-500 cursor-pointer"
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
