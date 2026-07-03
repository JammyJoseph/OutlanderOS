"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: "danger" | "primary";
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * Provides an imperative, promise-based confirm() — a styled, dark-mode-aware
 * replacement for window.confirm(). Mount once near the app root; call it from
 * anywhere via useConfirm():
 *
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: "Delete?", message: "…", confirmVariant: "danger" }))) return;
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    setOpts(options);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const settle = useCallback((value: boolean) => {
    setOpen(false);
    resolverRef.current?.(value);
    resolverRef.current = null;
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        open={open}
        title={opts?.title ?? ""}
        message={opts?.message ?? ""}
        confirmLabel={opts?.confirmLabel}
        cancelLabel={opts?.cancelLabel}
        confirmVariant={opts?.confirmVariant}
        onConfirm={() => settle(true)}
        onCancel={() => settle(false)}
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    // Fallback to the native dialog if the provider isn't mounted, so callers
    // never crash. (Should not happen — the provider is in the root layout.)
    return async ({ message }) =>
      typeof window !== "undefined" ? window.confirm(message) : true;
  }
  return ctx;
}
