"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Plus, RotateCcw, Trash2 } from "lucide-react";
import type { CrewMember, TalentMember } from "./types";
import { effectiveCallTime, hasCallOverride, sortRoster } from "./types";

export const ACCENT = "#A93B2E";
export const ACCENT_HOVER = "#A93B2E";

export const inputCls =
  "w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#A93B2E]/25 focus:border-[#A93B2E]";

export const smallInputCls =
  "px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#A93B2E]/25 focus:border-[#A93B2E]";

export const labelCls = "block text-xs font-medium text-gray-500 mb-1.5";

const COLLAPSE_PREFIX = "callsheet-section-collapsed:";

export function Section({
  title,
  icon,
  action,
  badge,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);

  // Collapsed state survives navigation within the session, keyed per section.
  useEffect(() => {
    try {
      setCollapsed(sessionStorage.getItem(COLLAPSE_PREFIX + title) === "1");
    } catch {}
  }, [title]);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        if (next) sessionStorage.setItem(COLLAPSE_PREFIX + title, "1");
        else sessionStorage.removeItem(COLLAPSE_PREFIX + title);
      } catch {}
      return next;
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div
        className={`flex items-center justify-between gap-2 px-5 py-3.5 ${
          collapsed ? "" : "border-b border-gray-50"
        }`}
      >
        <button
          type="button"
          onClick={toggle}
          className="flex flex-1 items-center gap-2 text-left group"
          aria-expanded={!collapsed}
        >
          <ChevronDown
            size={15}
            className={`text-[#A93B2E] transition-transform duration-150 ${
              collapsed ? "-rotate-90" : ""
            }`}
          />
          {icon}
          <h3 className="text-sm font-bold text-gray-800 group-hover:text-[#A93B2E] transition-colors">
            {title}
          </h3>
          {badge}
        </button>
        {action}
      </div>
      {!collapsed && <div className="px-5 py-4">{children}</div>}
    </div>
  );
}

export function DocSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="break-inside-avoid">
      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-[#A93B2E]">{icon}</span>
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 text-xs font-medium text-[#A93B2E] hover:text-[#A93B2E] transition-colors mt-1"
    >
      <Plus size={13} /> {label}
    </button>
  );
}

export function DeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors"
    >
      <Trash2 size={13} />
    </button>
  );
}

// Roster table. Each row's call time defaults to the sheet's unit call: the
// input is pre-filled with it, but the row only stores a `callTime` when the
// producer sets a *different* time (an override). Setting the input back to the
// unit call — or hitting the reset arrow — clears the override so the person
// tracks the unit call again if it later moves.
export function PeopleTable({
  people,
  setPeople,
  unitCallTime = "",
  readOnly = false,
  addLabel = "Add Person",
  rolePresets,
}: {
  people: (CrewMember | TalentMember)[];
  setPeople: (v: (CrewMember | TalentMember)[]) => void;
  unitCallTime?: string;
  readOnly?: boolean;
  addLabel?: string;
  rolePresets?: string[];
}) {
  const listId = rolePresets ? "crew-role-presets" : undefined;

  function setCallTime(i: number, value: string) {
    // Same as the unit call ⇒ not an override; store "" so they keep inheriting.
    const next = value === unitCallTime ? "" : value;
    setPeople(people.map((m, j) => (j === i ? { ...m, callTime: next } : m)));
  }

  if (readOnly) {
    if (people.length === 0) return null;
    const ordered = sortRoster(people, unitCallTime);
    return (
      <div className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_90px_1.2fr_1fr] gap-0 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide bg-gray-50 dark:bg-gray-800 px-4 py-2">
          <span>Role</span>
          <span>Name</span>
          <span>Call</span>
          <span>Email</span>
          <span>Phone</span>
        </div>
        {ordered.map((p, i) => {
          const custom = hasCallOverride(p, unitCallTime);
          return (
            <div
              key={i}
              className={`grid grid-cols-[1fr_1fr_90px_1.2fr_1fr] gap-0 px-4 py-2.5 text-sm ${
                i % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50/50 dark:bg-gray-800/40"
              }`}
            >
              <span className="text-gray-600 dark:text-gray-400 font-medium">{p.role}</span>
              <span className="text-gray-800 dark:text-gray-200">{p.name}</span>
              <span
                className={`font-mono text-xs ${
                  custom
                    ? "font-bold text-[#A93B2E]"
                    : "text-gray-500 dark:text-gray-400"
                }`}
                title={custom ? "Custom call time" : "Unit call"}
              >
                {effectiveCallTime(p, unitCallTime) || "—"}
                {custom ? " *" : ""}
              </span>
              <span className="text-gray-500 dark:text-gray-400 text-xs truncate">{p.email}</span>
              <span className="text-gray-500 dark:text-gray-400 text-xs">{p.phone}</span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rolePresets && (
        <datalist id={listId}>
          {rolePresets.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
      )}
      {people.map((p, i) => {
        const custom = hasCallOverride(p, unitCallTime);
        return (
          <div key={i} className="grid grid-cols-[1fr_1fr_142px_1fr_1fr_32px] gap-2 items-center">
            <input
              type="text"
              list={listId}
              value={p.role}
              onChange={(e) => setPeople(people.map((m, j) => (j === i ? { ...m, role: e.target.value } : m)))}
              placeholder="Role"
              className={smallInputCls}
            />
            <input
              type="text"
              value={p.name}
              onChange={(e) => setPeople(people.map((m, j) => (j === i ? { ...m, name: e.target.value } : m)))}
              placeholder="Name"
              className={smallInputCls}
            />
            <div className="flex items-center gap-1">
              <input
                type="time"
                value={effectiveCallTime(p, unitCallTime)}
                onChange={(e) => setCallTime(i, e.target.value)}
                // The roster re-sorts into call order once the row is left —
                // sorting on change would move the input out from under you.
                onBlur={() => setPeople(sortRoster(people, unitCallTime))}
                title={custom ? "Custom call time — overrides the unit call" : "Inheriting the unit call"}
                className={`${smallInputCls} flex-1 min-w-0 ${
                  custom
                    ? "font-bold text-[#A93B2E] border-[#A93B2E]/50 bg-[#A93B2E]/[0.04] dark:bg-[#A93B2E]/10"
                    : "text-gray-500 dark:text-gray-400"
                }`}
              />
              {custom ? (
                <button
                  type="button"
                  onClick={() => setCallTime(i, "")}
                  title="Reset to the unit call"
                  className="shrink-0 p-1 rounded text-[#A93B2E] hover:bg-[#A93B2E]/10"
                >
                  <RotateCcw size={12} />
                </button>
              ) : (
                <span
                  className="shrink-0 w-[22px] text-center text-[9px] font-semibold uppercase tracking-wide text-gray-300 dark:text-gray-600"
                  title="Inheriting the unit call"
                >
                  Unit
                </span>
              )}
            </div>
            <input
              type="email"
              value={p.email}
              onChange={(e) => setPeople(people.map((m, j) => (j === i ? { ...m, email: e.target.value } : m)))}
              placeholder="Email"
              className={smallInputCls}
            />
            <input
              type="tel"
              value={p.phone}
              onChange={(e) => setPeople(people.map((m, j) => (j === i ? { ...m, phone: e.target.value } : m)))}
              placeholder="Phone"
              className={smallInputCls}
            />
            <DeleteButton onClick={() => setPeople(people.filter((_, j) => j !== i))} />
          </div>
        );
      })}
      <AddButton
        label={addLabel}
        onClick={() => setPeople([...people, { role: "", name: "", callTime: "", email: "", phone: "" }])}
      />
    </div>
  );
}
