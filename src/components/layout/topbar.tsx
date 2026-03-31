"use client";

import { Bell, Search } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";

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
    <header className="flex h-14 items-center justify-between border-b border-neutral-800 bg-neutral-950 px-6">
      {/* Search */}
      <div className="relative w-72">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
        <Input
          placeholder="Search..."
          className="h-8 border-neutral-700 bg-neutral-900 pl-9 text-sm text-neutral-200 placeholder:text-neutral-500 focus-visible:ring-neutral-600"
        />
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Notifications */}
        <button className="relative flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-800 hover:text-white">
          <Bell className="h-4 w-4" />
          <Badge className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#D4A853] p-0 text-[10px] font-bold text-black">
            3
          </Badge>
        </button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-neutral-800 outline-none">
            <Avatar className="h-7 w-7">
              <AvatarImage src={session?.user?.image ?? undefined} />
              <AvatarFallback className="bg-[#D4A853] text-xs font-bold text-black">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-neutral-200">
              {session?.user?.name ?? "Guest"}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-48 border-neutral-700 bg-neutral-900"
          >
            <DropdownMenuLabel className="text-neutral-400">
              {session?.user?.email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-neutral-700" />
            <DropdownMenuItem
              className="text-neutral-200 focus:bg-neutral-800 focus:text-white"
              onClick={() => (window.location.href = "/settings")}
            >
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-neutral-700" />
            <DropdownMenuItem
              className="text-red-400 focus:bg-neutral-800 focus:text-red-400"
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
