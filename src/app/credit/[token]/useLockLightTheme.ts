"use client";

import { useEffect } from "react";

// Pins the document to the light theme while a public page is mounted.
//
// The root layout applies the *viewer's* stored theme to <html> before paint,
// and globals.css remaps light utilities to dark equivalents under `.dark`.
// Right for the portal; wrong for a contributor-facing page with one designed
// look. Removing the class here beats fighting the remap rule by rule, because
// the safety net targets literal utility classes and any future edit to the
// page would have to remember the workaround.
//
// The class is restored on unmount so a staff member navigating back into the
// portal keeps their theme.
export function useLockLightTheme(): void {
  useEffect(() => {
    const root = document.documentElement;
    const hadDark = root.classList.contains("dark");
    root.classList.remove("dark");
    return () => {
      if (hadDark) root.classList.add("dark");
    };
  }, []);
}
