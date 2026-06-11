"use client";

import { ExternalLink, FileText } from "lucide-react";
import type { Attachment, DocType } from "./types";
import { DOC_TYPE_LABELS } from "./types";
import { AddButton, DeleteButton, smallInputCls } from "./shared";

const DOC_TYPES = Object.keys(DOC_TYPE_LABELS) as DocType[];

export function DocumentsEditor({
  documents,
  setDocuments,
}: {
  documents: Attachment[];
  setDocuments: (v: Attachment[]) => void;
}) {
  function update(i: number, patch: Partial<Attachment>) {
    setDocuments(documents.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  }

  return (
    <div className="space-y-2">
      {documents.map((doc, i) => (
        <div key={i} className="grid grid-cols-[130px_1fr_1.4fr_32px] gap-2 items-center">
          <select
            value={doc.type}
            onChange={(e) => update(i, { type: e.target.value as DocType })}
            className={smallInputCls}
          >
            {DOC_TYPES.map((t) => (
              <option key={t} value={t}>
                {DOC_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={doc.title}
            onChange={(e) => update(i, { title: e.target.value })}
            placeholder="Title"
            className={smallInputCls}
          />
          <input
            type="url"
            value={doc.url}
            onChange={(e) => update(i, { url: e.target.value })}
            placeholder="https://drive.google.com/..."
            className={smallInputCls}
          />
          <DeleteButton onClick={() => setDocuments(documents.filter((_, j) => j !== i))} />
        </div>
      ))}
      <AddButton
        label="Add Document"
        onClick={() => setDocuments([...documents, { type: "other", title: "", url: "" }])}
      />
    </div>
  );
}

export function DocumentsDoc({ documents }: { documents: Attachment[] }) {
  const valid = documents.filter((d) => d.title || d.url);
  if (valid.length === 0) return null;
  return (
    <div className="space-y-1.5">
      {valid.map((doc, i) => {
        const inner = (
          <>
            <FileText size={15} className="text-gray-400 flex-shrink-0" />
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#E24B4A]/10 text-[#C93D3C] flex-shrink-0">
              {DOC_TYPE_LABELS[doc.type]}
            </span>
            <span className="text-sm text-gray-800 flex-1 truncate">
              {doc.title || doc.url}
            </span>
            {doc.url && <ExternalLink size={13} className="text-gray-400 flex-shrink-0" />}
          </>
        );
        return doc.url ? (
          <a
            key={i}
            href={doc.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 rounded-xl border border-gray-100 px-3 py-2 hover:border-[#E24B4A]/50 hover:bg-[#E24B4A]/5 transition-colors"
          >
            {inner}
          </a>
        ) : (
          <div
            key={i}
            className="flex items-center gap-2.5 rounded-xl border border-gray-100 px-3 py-2"
          >
            {inner}
          </div>
        );
      })}
    </div>
  );
}
