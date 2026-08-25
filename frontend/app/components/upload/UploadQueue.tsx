"use client";

import type { UploadItem } from "@/lib/types";
import { humanSize, getFileExtension, getFileCategory, getFileTypeColor } from "@/lib/utils";

type UploadQueueProps = {
  items: UploadItem[];
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
};

export function UploadQueue({ items, onRemove, onRetry }: UploadQueueProps) {
  if (items.length === 0) return null;

  const active = items.filter((i) => i.status === "uploading" || i.status === "queued").length;
  const completed = items.filter((i) => i.status === "complete").length;
  const failed = items.filter((i) => i.status === "error").length;

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          Uploading {items.length} file{items.length !== 1 ? "s" : ""}
        </p>
        <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-secondary)" }}>
          {active > 0 && <span>{active} in progress</span>}
          {completed > 0 && <span style={{ color: "var(--success)" }}>{completed} done</span>}
          {failed > 0 && <span style={{ color: "var(--danger)" }}>{failed} failed</span>}
        </div>
      </div>
      <div className="max-h-60 divide-y" style={{ borderColor: "var(--border-subtle)" }}>
        {items.map((item) => {
          const ext = getFileExtension(item.name).toUpperCase();
          const category = getFileCategory(item.name);
          const colors = getFileTypeColor(category);
          const strokeColor = `var(--${category === "document" ? "primary" : "text-secondary"})`;

          return (
            <div key={item.id} className="flex items-center gap-3 px-5 py-3">
              <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${colors.bg}`}>
                <span className="text-[10px] font-bold uppercase" style={{ color: strokeColor }}>
                  {ext || "FILE"}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    {item.name}
                  </p>
                  <span className="flex-shrink-0 text-xs" style={{ color: "var(--text-muted)" }}>
                    {humanSize(item.size)}
                  </span>
                </div>
                {item.status === "uploading" && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1 flex-1 overflow-hidden rounded-full" style={{ background: "var(--border-subtle)" }}>
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${item.progress}%`, background: "var(--primary)" }}
                      />
                    </div>
                    <span className="text-xs tabular-nums" style={{ color: "var(--text-secondary)" }}>
                      {item.progress}%
                    </span>
                  </div>
                )}
                {item.status === "complete" && (
                  <p className="mt-0.5 text-xs" style={{ color: "var(--success)" }}>Uploaded</p>
                )}
                {item.status === "error" && (
                  <p className="mt-0.5 text-xs" style={{ color: "var(--danger)" }}>
                    {item.error || "Upload failed"}
                  </p>
                )}
                {item.status === "queued" && (
                  <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>Waiting</p>
                )}
              </div>
              <div className="flex flex-shrink-0 items-center gap-1">
                {item.status === "error" && (
                  <button
                    onClick={() => onRetry(item.id)}
                    className="rounded-md p-1.5 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                    style={{ color: "var(--text-secondary)" }}
                    aria-label="Retry upload"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="23 4 23 10 17 10" />
                      <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
                    </svg>
                  </button>
                )}
                {(item.status === "error" || item.status === "complete") && (
                  <button
                    onClick={() => onRemove(item.id)}
                    className="rounded-md p-1.5 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                    style={{ color: "var(--text-muted)" }}
                    aria-label="Remove"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
