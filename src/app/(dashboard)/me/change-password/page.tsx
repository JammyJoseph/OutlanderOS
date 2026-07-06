"use client";

import { useState } from "react";
import { Loader2, Lock, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { passwordStrength } from "@/lib/validation";

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const strength = passwordStrength(newPassword);

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
      // Use a hard navigation (not router.push): the API response just cleared
      // the `must_change_pw` cookie, and a soft client-side navigation can race
      // the proxy (which reads the cookie jar / serves a cached RSC payload) and
      // bounce the user straight back here. A full-page load guarantees the
      // browser sends the updated cookies, so the proxy lets them through.
      window.location.assign(data.onboarding ? "/welcome" : "/me");
    } catch {
      setError("Connection error. Please try again.");
      setSaving(false);
    }
  }

  const inputCls =
    "w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#9C7C2E] dark:focus:ring-[#C9A44A] focus:border-transparent transition-all";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gray-50 dark:bg-gray-900 p-4">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 right-1/4 h-[420px] w-[420px] rounded-full bg-[#9C7C2E]/8 dark:bg-[#C9A44A]/8 blur-3xl"
      />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#9C7C2E]/15 dark:bg-[#C9A44A]/15 ring-1 ring-[#9C7C2E]/30 dark:ring-[#C9A44A]/30">
            <ShieldCheck className="h-6 w-6 text-[#9C7C2E] dark:text-[#C9A44A]" />
          </span>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
            Outlander Magazine
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            Welcome to Outlander<span className="text-[#9C7C2E] dark:text-[#C9A44A]">OS</span>
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Please set your new password to get started.</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 shadow-xl"
        >
          {error && (
            <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Current password</label>
            <div className="relative">
              <input
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                placeholder="The temporary password you were given"
                className={`${inputCls} pr-10`}
              />
              <PasswordToggle shown={showCurrent} onToggle={() => setShowCurrent((v) => !v)} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">New password</label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                placeholder="At least 8 characters"
                className={`${inputCls} pr-10`}
              />
              <PasswordToggle shown={showNew} onToggle={() => setShowNew((v) => !v)} />
            </div>
            {newPassword && <StrengthMeter strength={strength} />}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Confirm new password</label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                className={`${inputCls} pr-10`}
              />
              <PasswordToggle shown={showConfirm} onToggle={() => setShowConfirm((v) => !v)} />
            </div>
            {confirm && confirm !== newPassword && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">Passwords don&apos;t match.</p>
            )}
          </div>
          <button
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#111111] text-white dark:bg-white dark:text-black py-2.5 text-sm font-semibold transition-all duration-200 hover:brightness-110 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            {saving ? "Setting password…" : "Set Password & Enter"}
          </button>
        </form>

        <p className="mt-6 text-center text-[11px] text-gray-500 dark:text-gray-400">
          Internal operating system · Outlander Magazine
        </p>
      </div>
    </div>
  );
}

function PasswordToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={shown ? "Hide password" : "Show password"}
      className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
    >
      {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );
}

function StrengthMeter({ strength }: { strength: ReturnType<typeof passwordStrength> }) {
  const { score, label } = strength;
  const barColor =
    label === "weak" ? "bg-red-500" : label === "medium" ? "bg-amber-500" : "bg-emerald-500";
  const textColor =
    label === "weak"
      ? "text-red-600 dark:text-red-400"
      : label === "medium"
        ? "text-amber-600 dark:text-amber-400"
        : "text-emerald-600 dark:text-emerald-400";
  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i <= score ? barColor : "bg-gray-200 dark:bg-gray-700"
            }`}
          />
        ))}
      </div>
      <p className={`mt-1 text-xs font-medium capitalize ${textColor}`}>{label} password</p>
    </div>
  );
}
