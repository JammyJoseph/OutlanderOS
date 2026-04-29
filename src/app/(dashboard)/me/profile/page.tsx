"use client";

import { useEffect, useState } from "react";
import { User as UserIcon } from "lucide-react";

interface MeUser {
  id: string;
  email: string;
  name: string;
  role: string;
  department?: string | null;
  startDate?: string | null;
  holidayAllowance?: number;
  avatar?: string | null;
}

export default function MyProfilePage() {
  const [me, setMe] = useState<MeUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setMe(d.user ?? null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading…</div>;
  if (!me) return <div className="p-8 text-sm text-gray-400">Not signed in.</div>;

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <p className="text-sm text-gray-500 mt-1">Your details and team information</p>
      </div>

      <div className="card-apple p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <UserIcon className="h-8 w-8 text-amber-700" />
          </div>
          <div>
            <div className="text-lg font-bold text-gray-900">{me.name}</div>
            <div className="text-sm text-gray-500">{me.email}</div>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">Role</dt>
            <dd className="text-gray-900">{me.role}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">Department</dt>
            <dd className="text-gray-900">{me.department ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">Start Date</dt>
            <dd className="text-gray-900">
              {me.startDate ? new Date(me.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">Holiday Allowance</dt>
            <dd className="text-gray-900">{me.holidayAllowance ?? 25} days</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
