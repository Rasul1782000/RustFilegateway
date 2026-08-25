"use client";

import type { FileRecord } from "@/lib/types";
import { FileRow } from "./FileRow";
import { FileGridItem } from "./FileGrid";
import { EmptyState } from "@/components/feedback/EmptyState";
import type { ViewMode } from "@/lib/types";

type FileListProps = {
  files: FileRecord[];
  viewMode: ViewMode;
  isLoading: boolean;
  isSearching: boolean;
  searchQuery: string;
  onDownload: (id: string, name: string) => void;
  onDelete: (file: FileRecord) => void;
  onViewDetails: (file: FileRecord) => void;
};

export function FileList({
  files,
  viewMode,
  isLoading,
  isSearching,
  searchQuery,
  onDownload,
  onDelete,
  onViewDetails,
}: FileListProps) {
  if (isLoading) {
    return (
      <div className="card p-5">
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3.5">
              <div className="skeleton h-10 w-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-48" />
                <div className="skeleton h-3 w-32" />
              </div>
              <div className="skeleton h-3 w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (files.length === 0) {
    if (isSearching) {
      return (
        <div className="card">
          <EmptyState
            title="No files found"
            description={`We couldn't find anything matching "${searchQuery}".`}
            action={
              <button className="btn-outline text-sm">
                Clear search
              </button>
            }
          />
        </div>
      );
    }

    return (
      <div className="card">
        <EmptyState
          icon={
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" />
              <polyline points="13 2 13 9 20 9" />
            </svg>
          }
          title="Your workspace is empty"
          description="Upload your first file to get started."
        />
      </div>
    );
  }

  if (viewMode === "grid") {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {files.map((f) => (
          <FileGridItem key={f.id} file={f} onViewDetails={onViewDetails} />
        ))}
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
        {files.map((f) => (
          <FileRow
            key={f.id}
            file={f}
            onDownload={onDownload}
            onDelete={onDelete}
            onViewDetails={onViewDetails}
          />
        ))}
      </div>
    </div>
  );
}
