"use client";

import { Search, Mail } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { NotificationBell } from "@/components/layout/NotificationBell";

export function Topbar() {
  const { data: session } = useSession();

  const initials = session?.user?.name
    ? session.user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <header className="glass-header flex h-14 items-center justify-between px-6">
      {/* Search */}
      <div className="relative w-72">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Search..."
          className="h-8 border-gray-200 bg-gray-50 pl-9 text-sm text-gray-900 placeholder:text-gray-400 focus-visible:ring-gray-300"
        />
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Billing monitor pill */}
        <div className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-500">
          <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
          <Mail className="h-3 w-3" />
          <span className="font-mono text-gray-700">billing@</span>
        </div>

        {/* Notifications */}
        <NotificationBell />

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-gray-100 outline-none">
            <Avatar className="h-7 w-7">
              <AvatarImage src={session?.user?.image ?? undefined} />
              <AvatarFallback className="bg-[#D4A853] text-xs font-bold text-black">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-gray-800">
              {session?.user?.name ?? "Guest"}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-48 border-gray-200 bg-white"
          >
            <DropdownMenuLabel className="text-gray-500">
              {session?.user?.email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-gray-200" />
            <DropdownMenuItem
              className="text-gray-700 focus:bg-gray-100 focus:text-gray-900"
              onClick={() => (window.location.href = "/settings")}
            >
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-gray-200" />
            <DropdownMenuItem
              className="text-red-500 focus:bg-gray-100 focus:text-red-500"
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
