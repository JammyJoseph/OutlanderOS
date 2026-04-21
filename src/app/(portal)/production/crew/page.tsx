"use client";

import { useState, useEffect } from "react";
import { Users, ExternalLink } from "lucide-react";
import Link from "next/link";

interface Contact {
  id: string;
  name: string;
  category: string;
  role?: string;
  dayRate?: number;
  email?: string;
}

export default function CrewPage() {
  const [crew, setCrew] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/contacts?category=photographer,stylist,crew")
      .then((r) => r.json())
      .then((data) => setCrew(Array.isArray(data) ? data : []))
      .catch(() => setCrew([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Crew Database</h1>
          <p className="text-xs text-gray-500">Photographers, stylists, and production crew</p>
        </div>
        <Link
          href="/contacts"
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          View All Contacts
        </Link>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#D4A853] border-t-transparent" />
          </div>
        ) : crew.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
              <Users className="h-8 w-8 text-gray-400" />
            </div>
            <h2 className="text-sm font-semibold text-gray-700">No crew contacts yet</h2>
            <p className="mt-1 max-w-xs text-xs text-gray-400">
              Add photographers, stylists, and crew in Contacts with their category set accordingly.
            </p>
            <Link
              href="/contacts"
              className="mt-4 flex items-center gap-1.5 rounded-lg bg-[#D4A853] px-4 py-2 text-xs font-semibold text-white hover:bg-[#C49843]"
            >
              Go to Contacts
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {crew.map((person) => (
              <div key={person.id} className="card-apple p-4">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-sm font-bold text-amber-700">
                  {person.name.charAt(0)}
                </div>
                <h3 className="text-sm font-semibold text-gray-900">{person.name}</h3>
                <p className="text-xs text-gray-500 capitalize">{person.role || person.category}</p>
                {person.dayRate && (
                  <p className="mt-2 font-mono text-xs font-semibold text-gray-700">
                    ${person.dayRate.toLocaleString()} / day
                  </p>
                )}
                <span className="mt-2 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                  Available
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
