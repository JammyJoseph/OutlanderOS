"use client";

import { Users } from "lucide-react";
import type { CateringDetails, DietaryItem } from "./types";
import { AddButton, DeleteButton, inputCls, labelCls, smallInputCls } from "./shared";

export function resolveHeadcount(catering: CateringDetails, rosterCount: number): number {
  const override = parseInt(catering.headcountOverride, 10);
  return Number.isFinite(override) && catering.headcountOverride.trim() !== ""
    ? override
    : rosterCount;
}

export function CateringEditor({
  catering,
  setCatering,
  rosterCount,
}: {
  catering: CateringDetails;
  setCatering: (v: CateringDetails) => void;
  rosterCount: number;
}) {
  const headcount = resolveHeadcount(catering, rosterCount);

  function update(patch: Partial<CateringDetails>) {
    setCatering({ ...catering, ...patch });
  }

  function updateDietary(i: number, patch: Partial<DietaryItem>) {
    update({ dietary: catering.dietary.map((d, j) => (j === i ? { ...d, ...patch } : d)) });
  }

  return (
    <div className="space-y-4">
      {/* Headcount */}
      <div className="flex items-center gap-4 rounded-xl bg-gray-50/70 border border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-[#D4A853]" />
          <span className="text-2xl font-semibold text-gray-900">{headcount}</span>
          <span className="text-xs text-gray-500">meals</span>
        </div>
        <div className="ml-auto">
          <label className="block text-xs font-medium text-gray-400 mb-1">
            Override (auto: {rosterCount} from roster)
          </label>
          <input
            type="number"
            min={0}
            value={catering.headcountOverride}
            onChange={(e) => update({ headcountOverride: e.target.value })}
            placeholder="Auto"
            className={`${smallInputCls} w-24`}
          />
        </div>
      </div>

      {/* Meal schedule */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={labelCls}>Breakfast</label>
          <input
            type="time"
            value={catering.breakfast}
            onChange={(e) => update({ breakfast: e.target.value })}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Lunch</label>
          <input
            type="time"
            value={catering.lunch}
            onChange={(e) => update({ lunch: e.target.value })}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Snacks</label>
          <input
            type="text"
            value={catering.snacks}
            onChange={(e) => update({ snacks: e.target.value })}
            placeholder="e.g. 11:00 & 16:00"
            className={inputCls}
          />
        </div>
      </div>

      {/* Provider */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Catering Provider</label>
          <input
            type="text"
            value={catering.provider}
            onChange={(e) => update({ provider: e.target.value })}
            placeholder="Provider name"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Provider Contact</label>
          <input
            type="text"
            value={catering.providerContact}
            onChange={(e) => update({ providerContact: e.target.value })}
            placeholder="Phone or email"
            className={inputCls}
          />
        </div>
      </div>

      {/* Dietary requirements */}
      <div>
        <label className={labelCls}>Dietary Requirements</label>
        <div className="space-y-2">
          {catering.dietary.map((d, i) => (
            <div key={i} className="grid grid-cols-[1fr_1.4fr_32px] gap-2 items-center">
              <input
                type="text"
                value={d.name}
                onChange={(e) => updateDietary(i, { name: e.target.value })}
                placeholder="Name"
                className={smallInputCls}
              />
              <input
                type="text"
                value={d.requirement}
                onChange={(e) => updateDietary(i, { requirement: e.target.value })}
                placeholder="Requirement — e.g. vegetarian"
                className={smallInputCls}
              />
              <DeleteButton
                onClick={() => update({ dietary: catering.dietary.filter((_, j) => j !== i) })}
              />
            </div>
          ))}
          <AddButton
            label="Add Requirement"
            onClick={() => update({ dietary: [...catering.dietary, { name: "", requirement: "" }] })}
          />
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className={labelCls}>Notes</label>
        <textarea
          value={catering.notes}
          onChange={(e) => update({ notes: e.target.value })}
          placeholder="Catering notes..."
          rows={2}
          className={`${inputCls} resize-none`}
        />
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm text-gray-700">{value}</p>
    </div>
  );
}

export function CateringDoc({
  catering,
  rosterCount,
}: {
  catering: CateringDetails;
  rosterCount: number;
}) {
  const headcount = resolveHeadcount(catering, rosterCount);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Field label="Headcount" value={`${headcount} meals`} />
        <Field label="Breakfast" value={catering.breakfast} />
        <Field label="Lunch" value={catering.lunch} />
        <Field label="Snacks" value={catering.snacks} />
        <Field label="Provider" value={catering.provider} />
        <Field label="Contact" value={catering.providerContact} />
      </div>
      {catering.dietary.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
            Dietary Requirements
          </p>
          <div className="flex flex-wrap gap-1.5">
            {catering.dietary.map((d, i) => (
              <span
                key={i}
                className="text-xs bg-gray-100 text-gray-700 rounded-full px-2.5 py-1"
              >
                <span className="font-medium">{d.name}</span>
                {d.requirement && <span className="text-gray-500"> — {d.requirement}</span>}
              </span>
            ))}
          </div>
        </div>
      )}
      <Field label="Notes" value={catering.notes} />
    </div>
  );
}
