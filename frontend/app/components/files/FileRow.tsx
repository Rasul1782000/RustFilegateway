"use client";

import { useState, useRef, useEffect } from "react";
import type { FileRecord } from "@/lib/types";
import { humanSize, relativeTime, getFileExtension, getFileTypeLabel, getFileCategory } from "@/lib/utils";
import { FileIcon } from "./FileIcon";

type FileRowProps = {
  file: FileRecord;
  onDownload: (id: string, name: string) => void;
  onDelete: (file: FileRecord) => void;
  onViewDetails: (file: FileRecord) => void;
};

export function FileRow({ file, onDownload, onDelete, onViewDetails }: FileRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const ext = getFileExtension(file.name).toUpperCase();
  const category = getFileCategory(file.name);
  const typeLabel = getFileTypeLabel(category);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  return (
    <div className="file-row group" onClick={() => onViewDetails(file)} style={{ cursor: "pointer" }}>
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        <FileIcon name={file.name} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            {file.name}
          </p>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
            <span>{typeLabel}</span>
            <span style={{ color: "var(--text-muted)" }}>·</span>
            <span>{ext}</span>
            <span style={{ color: "var(--text-muted)" }}>·</span>
            <span>{humanSize(file.original_size)}</span>
            {file.dedup_saved > 0 && (
              <>
                <span style={{ color: "var(--text-muted)" }}>·</span>
                <span style={{ color: "var(--success)" }}>{((file.dedup_saved / file.original_size) * 100).toFixed(0)}% dedup</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <span className="hidden text-xs tabular-nums sm:block" style={{ color: "var(--text-muted)" }}>
          {relativeTime(file.created_at)}
        </span>
        <div className="relative" ref={menuRef}>
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
            className="rounded-md p-1.5 opacity-0 transition-all group-hover:opacity-100 hover:bg-gray-100 dark:hover:bg-gray-800"
            style={{ color: "var(--text-muted)" }}
            aria-label="File actions"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="5" r="1" />
              <circle cx="12" cy="12" r="1" />
              <circle cx="12" cy="19" r="1" />
            </svg>
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 top-full z-30 mt-1 w-44 overflow-hidden rounded-xl py-1"
              style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
                style={{ color: "var(--text-primary)" }}
                onClick={() => { onDownload(file.id, file.name); setMenuOpen(false); }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download
              </button>
              <button
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
                style={{ color: "var(--text-primary)" }}
                onClick={() => { onViewDetails(file); setMenuOpen(false); }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                View details
              </button>
              <div style={{ borderTop: "1px solid var(--border-subtle)", margin: "4px 0" }} />
              <button
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition-colors"
                style={{ color: "var(--danger)" }}
                onClick={() => { onDelete(file); setMenuOpen(false); }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
