"use client";

import { useEffect, useState } from "react";
import { Search, X, Loader2, Check, Contact as ContactIcon } from "lucide-react";
import type { CrewMember } from "./types";

interface DirectoryContact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  category: string;
  company: string | null;
}

// Modal that searches the Directory (/api/contacts) and lets the user pick
// contacts to add to the call sheet's Unit List.
export function DirectoryPicker({
  onClose,
  onAdd,
  defaultCallTime,
}: {
  onClose: () => void;
  onAdd: (people: CrewMember[]) => void;
  defaultCallTime: string;
}) {
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<DirectoryContact[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      fetch(`/api/contacts?search=${encodeURIComponent(search)}`)
        .then((r) => r.json())
        .then((d) => setContacts(Array.isArray(d) ? d : []))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  function confirm() {
    const picked = contacts
      .filter((c) => selected[c.id])
      .map<CrewMember>((c) => ({
        role: c.role || c.category || "",
        name: c.name,
        callTime: defaultCallTime || "",
        email: c.email || "",
        phone: c.phone || "",
      }));
    onAdd(picked);
    onClose();
  }

  const count = Object.values(selected).filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <ContactIcon size={15} className="text-[#ff4444]" /> Import from Directory
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 dark:text-gray-500">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search the directory…"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff4444]/25 focus:border-[#ff4444]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 size={20} className="animate-spin text-gray-400 dark:text-gray-500" />
            </div>
          ) : contacts.length === 0 ? (
            <p className="text-center text-sm text-gray-400 dark:text-gray-500 py-10">No contacts found.</p>
          ) : (
            contacts.map((c) => {
              const isSel = !!selected[c.id];
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelected((s) => ({ ...s, [c.id]: !s[c.id] }))}
                  className="flex items-center justify-between gap-3 w-full text-left px-5 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-50 dark:border-gray-800"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                      {c.name}
                      {(c.role || c.category) && (
                        <span className="text-gray-400 dark:text-gray-500 font-normal"> · {c.role || c.category}</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                      {[c.email, c.phone].filter(Boolean).join(" · ") || "No contact details"}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 w-5 h-5 rounded-md border flex items-center justify-center ${
                      isSel ? "bg-[#ff4444] border-[#ff4444]" : "border-gray-300 dark:border-gray-600"
                    }`}
                  >
                    {isSel && <Check size={13} className="text-white" />}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-gray-800">
          <span className="text-xs text-gray-500 dark:text-gray-400">{count} selected</span>
          <button
            onClick={confirm}
            disabled={count === 0}
            className="bg-[#ff4444] text-white px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-40"
          >
            Add {count > 0 ? count : ""} to Unit List
          </button>
        </div>
      </div>
    </div>
  );
}
