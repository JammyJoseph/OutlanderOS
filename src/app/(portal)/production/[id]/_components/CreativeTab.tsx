"use client";

import { useState } from "react";
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
} from "lucide-react";
import { CreativeAsset, CREATIVE_TYPES } from "./types";
import { useConfirm } from "@/components/ui/confirm-provider";

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

export default function CreativeTab({ productionId, assets, refresh }: Props) {
  const confirm = useConfirm();
  const [showAdd, setShowAdd] = useState(false);

  async function add(form: Partial<CreativeAsset>) {
    await fetch(`/api/productions/${productionId}/creative`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setShowAdd(false);
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
        <div className="px-5 py-4 border-b border-gray-50 dark:border-gray-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Creative & References</h2>
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#9C7C2E] hover:text-[#9C7C2E]"
          >
            <Plus size={13} /> Add asset
          </button>
        </div>

        {showAdd && <AddAssetForm onAdd={add} onCancel={() => setShowAdd(false)} />}

        {assets.length === 0 && !showAdd ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No creative assets yet. Add briefs, moodboards, Figma links, and references here.
            </p>
            <button
              onClick={() => setShowAdd(true)}
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#9C7C2E] hover:text-[#9C7C2E]"
            >
              <Plus size={12} /> Add your first asset
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
            {(assets ?? []).map((a) => (
              <AssetCard key={a.id} asset={a} onRemove={() => remove(a.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AssetCard({
  asset,
  onRemove,
}: {
  asset: CreativeAsset;
  onRemove: () => void;
}) {
  const meta = getTypeMeta(asset.type);
  const Icon = TYPE_ICONS[asset.type] || File;
  const embeddable = asset.type === "figma" && asset.url && isFigmaUrl(asset.url);

  return (
    <div className="group bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
      <div className="aspect-video bg-gradient-to-br from-amber-50 dark:from-amber-900/30 to-gray-50 dark:to-gray-800 flex items-center justify-center relative overflow-hidden">
        {embeddable ? (
          <iframe
            src={getFigmaEmbedUrl(asset.url!)}
            className="w-full h-full"
            allowFullScreen
            title={asset.title}
          />
        ) : (
          <Icon size={36} className="text-[#9C7C2E]/60" />
        )}
        <button
          onClick={onRemove}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 bg-white/90 dark:bg-gray-900/90 backdrop-blur text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 p-1.5 rounded-lg transition-opacity"
        >
          <Trash2 size={13} />
        </button>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span
            className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${meta.color}`}
          >
            {meta.label}
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
        placeholder="Title"
        className="md:col-span-3 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-[#9C7C2E]/30 focus:border-[#9C7C2E]"
      />
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://…"
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
