"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, ShieldCheck } from "lucide-react";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/me/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Couldn't update your password.");
        setSaving(false);
        return;
      }
      // Onboarding users go through the one-time welcome screen.
      router.push(data.onboarding ? "/welcome" : "/me");
      router.refresh();
    } catch {
      setError("Connection error. Please try again.");
      setSaving(false);
    }
  }

  const inputCls =
    "w-full px-3 py-2.5 rounded-lg border border-[#2a2a2a] bg-[#161922] text-white text-sm placeholder:text-[#666666] focus:outline-none focus:ring-2 focus:ring-[#ffd700] focus:border-transparent transition-all";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#05060a] p-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_70%_20%,#10131f_0%,#05060a_55%,#020308_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 right-1/4 h-[420px] w-[420px] rounded-full bg-[#ffd700]/8 blur-3xl"
      />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#ffd700]/15 ring-1 ring-[#ffd700]/30">
            <ShieldCheck className="h-6 w-6 text-[#ffd700]" />
          </span>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-gray-400">
            Outlander Magazine
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            Welcome to Outlander<span className="text-[#ffd700]">OS</span>
          </h1>
          <p className="mt-2 text-sm text-gray-400">Please set your new password to get started.</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-[#2a2a2a] bg-[#0e1018]/80 p-6 shadow-2xl shadow-black/50 backdrop-blur-md"
        >
          {error && (
            <div className="rounded-lg border border-[#ff6b6b]/20 bg-[#ff6b6b]/10 px-3 py-2 text-sm text-[#ff6b6b]">
              {error}
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300">Current password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              placeholder="The temporary password you were given"
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300">New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              placeholder="At least 8 characters"
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300">Confirm new password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className={inputCls}
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#ffd700] py-2.5 text-sm font-semibold text-black transition-all duration-200 hover:brightness-110 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            {saving ? "Setting password…" : "Set Password & Enter"}
          </button>
        </form>

        <p className="mt-6 text-center text-[11px] text-gray-500">
          Internal operating system · Outlander Magazine
        </p>
      </div>
    </div>
  );
}
