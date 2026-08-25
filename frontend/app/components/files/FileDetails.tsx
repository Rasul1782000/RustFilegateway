"use client";

import type { FileRecord } from "@/lib/types";
import { humanSize, relativeTime, getFileExtension, getFileTypeLabel, getFileCategory } from "@/lib/utils";
import { FileIcon } from "./FileIcon";

type FileDetailsProps = {
  file: FileRecord | null;
  onClose: () => void;
  onDownload: (id: string, name: string) => void;
  onDelete: (file: FileRecord) => void;
};

export function FileDetails({ file, onClose, onDownload, onDelete }: FileDetailsProps) {
  if (!file) return null;

  const ext = getFileExtension(file.name).toUpperCase();
  const category = getFileCategory(file.name);
  const typeLabel = getFileTypeLabel(category);
  const dedupPercent = file.original_size > 0 ? ((file.dedup_saved / file.original_size) * 100).toFixed(1) : "0";

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="drawer-panel">
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>File details</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
            style={{ color: "var(--text-secondary)" }}
            aria-label="Close details"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-6">
          <div className="mb-6 flex flex-col items-center">
            <div className="mb-4">
              <FileIcon name={file.name} size={72} />
            </div>
            <p className="max-w-full truncate text-center text-base font-semibold" style={{ color: "var(--text-primary)" }}>
              {file.name}
            </p>
          </div>

          <div className="space-y-4">
            <DetailRow label="Size" value={humanSize(file.original_size)} />
            <DetailRow label="Compressed" value={humanSize(file.compressed_size)} />
            <DetailRow label="Type" value={`${typeLabel} (${ext})`} />
            <DetailRow label="Chunks" value={`${file.chunk_count} total, ${file.unique_chunks} unique`} />
            <DetailRow label="Uploaded" value={relativeTime(file.created_at)} />
            <DetailRow
              label="Deduplication"
              value={`${dedupPercent}% saved`}
              valueColor={parseFloat(dedupPercent) > 0 ? "var(--success)" : undefined}
            />
            <DetailRow label="Hash" value={file.hash} mono />
          </div>

          <div className="mt-8 space-y-2.5">
            <button
              className="btn-primary w-full justify-center text-sm"
              onClick={() => onDownload(file.id, file.name)}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download
            </button>
            <button
              className="btn-outline w-full justify-center text-sm"
              style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
              onClick={() => onDelete(file)}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
              Delete file
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function DetailRow({
  label,
  value,
  valueColor,
  mono,
}: {
  label: string;
  value: string;
  valueColor?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{label}</span>
      <span
        className={`text-right text-xs ${mono ? "break-all font-mono" : ""}`}
        style={{ color: valueColor || "var(--text-primary)" }}
      >
        {value}
      </span>
    </div>
  );
}
