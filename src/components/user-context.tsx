"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

// Mirrors the SELECT in /api/me — the fields the client actually reads. Kept
// loose (optional extras) so adding a column server-side doesn't break here.
export interface MeUser {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl?: string | null;
  avatar?: string | null;
  department?: string | null;
  startDate?: string | null;
  holidayAllowance?: number | null;
  salary?: number | null;
  googleConnected?: boolean;
  googleEmail?: string | null;
  theme?: "light" | "dark";
  teams?: unknown;
  mustChangePassword?: boolean;
  hasSeenWelcome?: boolean;
  createdAt?: string;
}

interface UserContextValue {
  user: MeUser | null;
  loading: boolean;
  error: boolean;
  /** Re-fetch /api/me (e.g. after a profile update). */
  refetch: () => Promise<void>;
  /** Optimistically patch the cached user without a round-trip. */
  patchUser: (patch: Partial<MeUser>) => void;
}

const UserContext = createContext<UserContextValue | null>(null);

/**
 * Fetches /api/me exactly once per page load and shares it with every consumer
 * (ThemeProvider, PortalSwitcher, PersonalHeader, …). Previously each of those
 * fetched independently, firing three parallel /api/me requests on every load.
 */
export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<MeUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const refetch = useCallback(async () => {
    setError(false);
    try {
      const res = await fetch("/api/me");
      if (!res.ok) {
        // 401 (logged out) is not an error state — just no user.
        if (res.status === 401) setUser(null);
        else setError(true);
        return;
      }
      const data = await res.json();
      setUser(data?.user ?? null);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const patchUser = useCallback((patch: Partial<MeUser>) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return (
    <UserContext.Provider value={{ user, loading, error, refetch, patchUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) {
    // Fallback so a component rendered outside the provider doesn't crash.
    return {
      user: null,
      loading: false,
      error: false,
      refetch: async () => {},
      patchUser: () => {},
    };
  }
  return ctx;
}
