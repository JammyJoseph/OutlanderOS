"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "@/components/theme-context";
import { UserProvider } from "@/components/user-context";
import { ConfirmProvider } from "@/components/ui/confirm-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <UserProvider>
        <ThemeProvider>
          <ConfirmProvider>{children}</ConfirmProvider>
        </ThemeProvider>
      </UserProvider>
    </SessionProvider>
  );
}
