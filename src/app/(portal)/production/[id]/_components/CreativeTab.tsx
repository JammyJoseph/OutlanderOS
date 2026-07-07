"use client";

import { useMemo, useState } from "react";
import {
  Plus,
  Trash2,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Layers,
  PaintBucket,
  Frame as FigmaIcon,
  File,
  Check,
  X,
} from "lucide-react";
import { CreativeAsset, CREATIVE_TYPES, ApprovalStatus } from "./types";
import { useConfirm } from "@/components/ui/confirm-provider";
import { useUser } from "@/components/user-context";

interface Props {
  productionId: string;
  assets: CreativeAsset[];
  refresh: () => void;
}

const TYPE_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  brief: FileText,
  moodboard: ImageIcon,
  reference: Layers,
  treatment: PaintBucket,
  figma: FigmaIcon,
  other: File,
};

function getTypeMeta(type: string) {
  return (
    CREATIVE_TYPES.find((t) => t.key === type) ||
    CREATIVE_TYPES[CREATIVE_TYPES.length - 1]
  );
}

function isFigmaUrl(url: string | null): boolean {
  if (!url) return false;
  return /(?:^|\/\/)(?:www\.)?figma\.com\//.test(url);
}

function getFigmaEmbedUrl(url: string): string {
  return `https://www.figma.com/embed?embed_host=outlanderos&url=${encodeURIComponent(url)}`;
}

function isImageUrl(url: string | null): boolean {
  if (!url) return false;
  return /\.(png|jpe?g|gif|webp|avif|svg)(\?|#|$)/i.test(url);
}

// Normalise the stored status (older rows may be null → treated as PENDING).
function statusOf(a: CreativeAsset): ApprovalStatus {
  const s = a.approvalStatus;
  return s === "APPROVED" || s === "DENIED" ? s : "PENDING";
}

type FilterKey = "ALL" | ApprovalStatus;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "APPROVED", label: "Approved" },
  { key: "DENIED", label: "Denied" },
];

// Status → border + chip styling. Pending is neutral; approved green; denied red.
const STATUS_STYLES: Record<ApprovalStatus, { border: string; chip: string; label: string }> = {
  PENDING: {
    border: "border-gray-200 dark:border-gray-700",
    chip: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400",
    label: "Pending",
  },
  APPROVED: {
    border: "border-emerald-400 dark:border-emerald-600",
    chip: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",
    label: "Approved",
  },
  DENIED: {
    border: "border-red-400 dark:border-red-600",
    chip: "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400",
    label: "Denied",
  },
};

export default function CreativeTab({ productionId, assets, refresh }: Props) {
  const confirm = useConfirm();
  const { user } = useUser();
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("ALL");

  const counts = useMemo(() => {
    let approved = 0;
    let denied = 0;
    let pending = 0;
    for (const a of assets ?? []) {
      const s = statusOf(a);
      if (s === "APPROVED") approved++;
      else if (s === "DENIED") denied++;
      else pending++;
    }
    return { total: (assets ?? []).length, approved, denied, pending };
  }, [assets]);

  const visible = (assets ?? []).filter((a) => filter === "ALL" || statusOf(a) === filter);

  async function add(form: Partial<CreativeAsset>) {
    await fetch(`/api/productions/${productionId}/creative`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setShowAdd(false);
    refresh();
  }

  async function setStatus(assetId: string, status: ApprovalStatus) {
    await fetch(`/api/productions/${productionId}/creative?assetId=${assetId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approvalStatus: status, approvedBy: user?.id ?? null }),
    });
    refresh();
  }

  async function remove(assetId: string) {
    const ok = await confirm({
      title: "Delete creative asset?",
      message: "This permanently removes the asset. This cannot be undone.",
      confirmLabel: "Delete",
      confirmVariant: "danger",
    });
    if (!ok) return;
    await fetch(`/api/productions/${productionId}/creative?assetId=${assetId}`, {
      method: "DELETE",
    });
    refresh();
  }

  return (
    <div className="space-y-5">
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 dark:border-gray-800 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Creative & References</h2>
            {counts.total > 0 && (
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                {counts.total} asset{counts.total === 1 ? "" : "s"} · {counts.approved} approved ·{" "}
                {counts.denied} denied · {counts.pending} pending
              </p>
            )}
          </div>
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#9C7C2E] hover:text-[#9C7C2E]"
          >
            <Plus size={13} /> Add asset
          </button>
        </div>

        {/* Status filter */}
        {counts.total > 0 && (
          <div className="px-5 py-3 border-b border-gray-50 dark:border-gray-800 flex items-center gap-1.5 flex-wrap">
            {FILTERS.map((f) => {
              const active = filter === f.key;
              const n =
                f.key === "ALL"
                  ? counts.total
                  : f.key === "APPROVED"
                  ? counts.approved
                  : f.key === "DENIED"
                  ? counts.denied
                  : counts.pending;
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    active
                      ? "bg-[#111111] dark:bg-white text-white dark:text-black"
                      : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  {f.label}
                  <span className={active ? "opacity-70" : "text-gray-400 dark:text-gray-500"}>{n}</span>
                </button>
              );
            })}
          </div>
        )}

        {showAdd && <AddAssetForm onAdd={add} onCancel={() => setShowAdd(false)} />}

        {(assets ?? []).length === 0 && !showAdd ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No creative assets yet. Add briefs, moodboards, Figma links, and reference images here.
            </p>
            <button
              onClick={() => setShowAdd(true)}
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#9C7C2E] hover:text-[#9C7C2E]"
            >
              <Plus size={12} /> Add your first asset
            </button>
          </div>
        ) : visible.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No {filter.toLowerCase()} assets.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
            {visible.map((a) => (
              <AssetCard
                key={a.id}
                asset={a}
                onApprove={() => setStatus(a.id, "APPROVED")}
                onDeny={() => setStatus(a.id, "DENIED")}
                onResetPending={() => setStatus(a.id, "PENDING")}
                onRemove={() => remove(a.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AssetCard({
  asset,
  onApprove,
  onDeny,
  onResetPending,
  onRemove,
}: {
  asset: CreativeAsset;
  onApprove: () => void;
  onDeny: () => void;
  onResetPending: () => void;
  onRemove: () => void;
}) {
  const meta = getTypeMeta(asset.type);
  const Icon = TYPE_ICONS[asset.type] || File;
  const embeddable = asset.type === "figma" && asset.url && isFigmaUrl(asset.url);
  const showImage = !embeddable && isImageUrl(asset.url);
  const status = statusOf(asset);
  const statusStyle = STATUS_STYLES[status];

  return (
    <div
      className={`group bg-white dark:bg-gray-900 border-2 rounded-xl overflow-hidden hover:shadow-md transition-shadow ${statusStyle.border}`}
    >
      <div className="aspect-video bg-gradient-to-br from-amber-50 dark:from-amber-900/30 to-gray-50 dark:to-gray-800 flex items-center justify-center relative overflow-hidden">
        {embeddable ? (
          <iframe
            src={getFigmaEmbedUrl(asset.url!)}
            className="w-full h-full"
            allowFullScreen
            title={asset.title}
          />
        ) : showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={asset.url!} alt={asset.title} className="w-full h-full object-cover" />
        ) : (
          <Icon size={36} className="text-[#9C7C2E]/60" />
        )}
        <button
          onClick={onRemove}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 bg-white/90 dark:bg-gray-900/90 backdrop-blur text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 p-1.5 rounded-lg transition-opacity"
        >
          <Trash2 size={13} />
        </button>
        {/* Quick approve / deny */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5">
          <button
            onClick={status === "APPROVED" ? onResetPending : onApprove}
            title={status === "APPROVED" ? "Approved — click to reset" : "Approve"}
            className={`p-1.5 rounded-lg backdrop-blur transition-colors ${
              status === "APPROVED"
                ? "bg-emerald-500 text-white"
                : "bg-white/90 dark:bg-gray-900/90 text-gray-400 dark:text-gray-500 hover:text-emerald-600 dark:hover:text-emerald-400"
            }`}
          >
            <Check size={13} />
          </button>
          <button
            onClick={status === "DENIED" ? onResetPending : onDeny}
            title={status === "DENIED" ? "Denied — click to reset" : "Deny"}
            className={`p-1.5 rounded-lg backdrop-blur transition-colors ${
              status === "DENIED"
                ? "bg-red-500 text-white"
                : "bg-white/90 dark:bg-gray-900/90 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400"
            }`}
          >
            <X size={13} />
          </button>
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span
            className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${meta.color}`}
          >
            {meta.label}
          </span>
          <span
            className={`ml-auto text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${statusStyle.chip}`}
          >
            {statusStyle.label}
          </span>
        </div>
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{asset.title}</p>
        {asset.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{asset.description}</p>
        )}
        {asset.url && (
          <a
            href={asset.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-3 text-xs font-medium text-[#9C7C2E] hover:underline"
          >
            Open <ExternalLink size={11} />
          </a>
        )}
      </div>
    </div>
  );
}

function AddAssetForm({
  onAdd,
  onCancel,
}: {
  onAdd: (a: Partial<CreativeAsset>) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState("reference");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");

  function submit() {
    if (!title.trim()) return;
    onAdd({
      type,
      title: title.trim(),
      url: url.trim() || null,
      description: description.trim() || null,
    });
  }

  return (
    <div className="px-5 py-4 bg-amber-50/30 dark:bg-amber-900/30 border-b border-gray-50 dark:border-gray-800 grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
      <select
        value={type}
        onChange={(e) => setType(e.target.value)}
        className="md:col-span-2 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-[#9C7C2E]/30 focus:border-[#9C7C2E]"
      >
        {(CREATIVE_TYPES ?? []).map((t) => (
          <option key={t.key} value={t.key}>
            {t.label}
          </option>
        ))}
      </select>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Filename / title"
        className="md:col-span-3 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-[#9C7C2E]/30 focus:border-[#9C7C2E]"
      />
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Image or file URL — https://…"
        className="md:col-span-3 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-[#9C7C2E]/30 focus:border-[#9C7C2E]"
      />
      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Notes"
        className="md:col-span-3 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-[#9C7C2E]/30 focus:border-[#9C7C2E]"
      />
      <div className="md:col-span-1 flex items-center gap-1 justify-end">
        <button
          onClick={submit}
          className="bg-[#111111] dark:bg-white text-white dark:text-black text-xs font-medium px-3 py-2 rounded-xl hover:opacity-90 transition-colors"
        >
          Add
        </button>
        <button
          onClick={onCancel}
          className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 px-2 py-2"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
