"use client";

import { ThemeProvider } from "@/components/theme-context";
import { UserProvider } from "@/components/user-context";
import { ConfirmProvider } from "@/components/ui/confirm-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <ThemeProvider>
        <ConfirmProvider>{children}</ConfirmProvider>
      </ThemeProvider>
    </UserProvider>
  );
}
