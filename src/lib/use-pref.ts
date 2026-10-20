"use client";

import { useCallback, useSyncExternalStore } from "react";

// A per-browser preference in localStorage, read safely on both the server
// (always null, so the first paint matches) and the client, and updated
// everywhere in the tab when it changes. For conveniences only — a remembered
// workspace, a skipped screen — never for anything that must persist.

const EVENT = "os:pref";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

export function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writePref(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* private mode — the preference just won't stick */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function usePref(key: string): [string | null, (v: string | null) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => readPref(key),
    () => null,
  );
  const set = useCallback((v: string | null) => writePref(key, v), [key]);
  return [value, set];
}
