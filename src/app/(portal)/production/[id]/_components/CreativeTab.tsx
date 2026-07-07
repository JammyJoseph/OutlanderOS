"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Cloud,
  FolderPlus,
  RefreshCw,
  UploadCloud,
  Loader2,
  User as UserIcon,
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
      <DrivePanel productionId={productionId} refresh={refresh} />

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

// ── Google Drive panel ──
// Connects the Creative tab to the production's Google Drive folder: prompts to
// connect when the user has no Drive token, sets up the folder structure on
// demand, uploads files (with progress) into "Assets", and syncs files that
// were added to Drive directly back into the approval grid.

interface DriveFolder {
  id: string;
  name: string;
  subfolders?: Record<string, string>;
}

interface DriveState {
  loading: boolean;
  connected: boolean;
  folder: DriveFolder | null;
  fileCount: number;
  accessible: boolean;
  error: string | null;
}

function DrivePanel({ productionId, refresh }: { productionId: string; refresh: () => void }) {
  const [state, setState] = useState<DriveState>({
    loading: true,
    connected: false,
    folder: null,
    fileCount: 0,
    accessible: true,
    error: null,
  });
  const [busy, setBusy] = useState<null | "setup" | "sync">(null);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const loadFiles = useCallback(async () => {
    try {
      const r = await fetch(`/api/productions/${productionId}/drive/files`);
      const d = await r.json();
      setState({
        loading: false,
        connected: !!d.connected,
        folder: d.folder ?? null,
        fileCount: Array.isArray(d.files) ? d.files.length : 0,
        accessible: d.accessible !== false,
        error: d.error ?? null,
      });
    } catch {
      setState((s) => ({ ...s, loading: false, error: "Could not reach Google Drive" }));
    }
  }, [productionId]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  function showFlash(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash(null), 2500);
  }

  async function setup() {
    setBusy("setup");
    try {
      const r = await fetch(`/api/productions/${productionId}/drive/setup`, { method: "POST" });
      const d = await r.json();
      if (d.connected === false) {
        setState((s) => ({ ...s, connected: false }));
      } else if (d.accessible === false) {
        setState((s) => ({ ...s, accessible: false, error: d.error ?? null }));
        showFlash("Folder not shared with you");
      } else if (d.folderId) {
        showFlash("Drive folder ready");
        await loadFiles();
      } else {
        showFlash(d.error || "Setup failed");
      }
    } finally {
      setBusy(null);
    }
  }

  async function sync() {
    setBusy("sync");
    try {
      const r = await fetch(`/api/productions/${productionId}/drive/sync`, { method: "POST" });
      const d = await r.json();
      if (d.connected === false) {
        setState((s) => ({ ...s, connected: false }));
      } else if (d.accessible === false) {
        setState((s) => ({ ...s, accessible: false, error: d.error ?? null }));
        showFlash("Folder not shared with you");
      } else if (d.error) {
        showFlash(d.error);
      } else {
        showFlash(`Synced — ${d.created} new, ${d.updated} updated`);
        await loadFiles();
        refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  // Upload via XHR so we can report progress. Falls back to a spinner-less bar
  // if the browser can't report progress events.
  function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    e.target.value = ""; // allow re-selecting the same file later
    void uploadSequential(files);
  }

  async function uploadSequential(files: File[]) {
    for (let i = 0; i < files.length; i++) {
      await uploadOne(files[i], i + 1, files.length);
    }
    setUploadPct(null);
    showFlash(files.length === 1 ? "Uploaded to Drive" : `Uploaded ${files.length} files`);
    await loadFiles();
    refresh();
  }

  function uploadOne(file: File, index: number, total: number): Promise<void> {
    return new Promise((resolve) => {
      const form = new FormData();
      form.append("file", file);
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `/api/productions/${productionId}/drive/upload`);
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) {
          const pctThisFile = ev.loaded / ev.total;
          const overall = ((index - 1 + pctThisFile) / total) * 100;
          setUploadPct(Math.min(99, Math.round(overall)));
        }
      };
      xhr.onload = () => {
        try {
          const d = JSON.parse(xhr.responseText || "{}");
          if (d.connected === false) setState((s) => ({ ...s, connected: false }));
        } catch {
          /* ignore parse errors */
        }
        setUploadPct(Math.round((index / total) * 100));
        resolve();
      };
      xhr.onerror = () => resolve();
      setUploadPct(Math.round(((index - 1) / total) * 100));
      xhr.send(form);
    });
  }

  const uploading = uploadPct !== null;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
      <div className="px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
            <Cloud size={16} className="text-blue-500 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Google Drive</h2>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
              {state.loading
                ? "Checking connection…"
                : !state.connected
                ? "Not connected"
                : !state.accessible
                ? "Folder set up by another team member"
                : !state.folder
                ? "No project folder yet"
                : `${state.folder.name ?? "Project folder"} · ${state.fileCount} file${state.fileCount === 1 ? "" : "s"}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {flash && (
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">{flash}</span>
          )}

          {!state.loading && !state.connected && (
            <a
              href="/me/settings"
              className="inline-flex items-center gap-1.5 bg-[#111111] dark:bg-white text-white dark:text-black text-xs font-medium px-3 py-2 rounded-xl hover:opacity-90 transition-opacity"
            >
              <Cloud size={13} /> Connect Google Drive
            </a>
          )}

          {!state.loading && state.connected && !state.folder && state.accessible && (
            <button
              onClick={setup}
              disabled={busy === "setup"}
              className="inline-flex items-center gap-1.5 bg-[#111111] dark:bg-white text-white dark:text-black text-xs font-medium px-3 py-2 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {busy === "setup" ? <Loader2 size={13} className="animate-spin" /> : <FolderPlus size={13} />}
              Set up Drive folder
            </button>
          )}

          {!state.loading && state.connected && state.folder && state.accessible && (
            <>
              <a
                href={`https://drive.google.com/drive/folders/${state.folder.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-2 py-2"
              >
                Open in Drive <ExternalLink size={11} />
              </a>
              <button
                onClick={sync}
                disabled={busy === "sync" || uploading}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 px-3 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {busy === "sync" ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <RefreshCw size={13} />
                )}
                Sync from Drive
              </button>
              <button
                onClick={() => fileInput.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-1.5 bg-[#111111] dark:bg-white text-white dark:text-black text-xs font-medium px-3 py-2 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <UploadCloud size={13} /> Upload to Drive
              </button>
              <input
                ref={fileInput}
                type="file"
                multiple
                className="hidden"
                onChange={onFilePicked}
              />
            </>
          )}
        </div>
      </div>

      {uploading && (
        <div className="px-5 pb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-gray-500 dark:text-gray-400">Uploading to Drive…</span>
            <span className="text-[11px] font-medium text-gray-600 dark:text-gray-300">{uploadPct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div
              className="h-full bg-blue-500 dark:bg-blue-400 transition-all duration-200"
              style={{ width: `${uploadPct}%` }}
            />
          </div>
        </div>
      )}

      {!state.loading && !state.connected && (
        <div className="px-5 pb-4 -mt-1">
          <p className="text-[11px] text-gray-400 dark:text-gray-500">
            Connect your Google account under Settings to create a project folder, upload files, and
            pull previews straight from Drive.
          </p>
        </div>
      )}

      {!state.loading && state.connected && !state.accessible && (
        <div className="px-5 pb-4 -mt-1">
          <p className="text-[11px] text-amber-600 dark:text-amber-400">
            {state.error ||
              "This project's Drive folder was set up by another team member. Ask them to share it with your Google account to manage files here."}
          </p>
        </div>
      )}
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
  const status = statusOf(asset);
  const statusStyle = STATUS_STYLES[status];
  const isDrive = !!asset.driveFileId;

  // Prefer the Drive thumbnail; otherwise fall back to a directly-linked image
  // URL. Drive thumbnail links can 403 for viewers without a Google session, so
  // we drop to the type icon on error.
  const [imgError, setImgError] = useState(false);
  const imageSrc = !embeddable && !imgError
    ? asset.driveThumbnail || (isImageUrl(asset.url) ? asset.url : null)
    : null;

  const uploadedAt = asset.createdAt ? new Date(asset.createdAt) : null;
  const uploadedLabel = uploadedAt && !isNaN(uploadedAt.getTime())
    ? uploadedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
    : null;

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
        ) : imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageSrc}
            alt={asset.title}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <Icon size={36} className="text-[#9C7C2E]/60" />
        )}
        {isDrive && (
          <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 bg-white/90 dark:bg-gray-900/90 backdrop-blur text-[10px] font-medium text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-md">
            <Cloud size={10} /> Drive
          </span>
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
        {(asset.uploadedByName || uploadedLabel) && (
          <p className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500 mt-2">
            <UserIcon size={11} />
            {asset.uploadedByName || "Unknown"}
            {uploadedLabel && <span className="text-gray-300 dark:text-gray-600">· {uploadedLabel}</span>}
          </p>
        )}
        {asset.url && (
          <a
            href={asset.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-3 text-xs font-medium text-[#9C7C2E] hover:underline"
          >
            {isDrive ? "Open in Drive" : "Open"} <ExternalLink size={11} />
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
