"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "outlanderos-theme";

// Inline script injected into <head> so the correct theme class is on <html>
// before first paint — avoids a flash of the wrong theme. Light is the default,
// so we only ever ADD the `dark` class (never assume dark). The DB preference is
// reconciled afterwards by ThemeProvider.
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t==='dark'){document.documentElement.classList.add('dark');}else{document.documentElement.classList.remove('dark');}}catch(e){}})();`;

// Applies the theme to the <html> element and persists it to localStorage.
export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* storage may be unavailable */
  }
}

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Start from whatever the no-flash script already put on <html>; fall back to
  // light. This keeps the very first client render in sync with the DOM.
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof document !== "undefined" && document.documentElement.classList.contains("dark")) {
      return "dark";
    }
    return "light";
  });

  // Persist + apply, and write the preference back to the database so it follows
  // the user across devices.
  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    applyTheme(next);
    fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: next }),
    }).catch(() => {});
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  // On load, reconcile with the DB preference (source of truth across devices).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        const dbTheme: Theme | undefined = d?.user?.theme;
        if (cancelled || (dbTheme !== "light" && dbTheme !== "dark")) return;
        setThemeState(dbTheme);
        applyTheme(dbTheme);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Fallback so components don't crash if rendered outside the provider.
    return {
      theme: "light",
      setTheme: applyTheme,
      toggleTheme: () => {},
    };
  }
  return ctx;
}
