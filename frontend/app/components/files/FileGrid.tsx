"use client";

import type { FileRecord } from "@/lib/types";
import { humanSize, getFileExtension, getFileCategory, getFileTypeColor } from "@/lib/utils";
import { FileIcon } from "./FileIcon";

type FileGridItemProps = {
  file: FileRecord;
  onViewDetails: (file: FileRecord) => void;
};

export function FileGridItem({ file, onViewDetails }: FileGridItemProps) {
  const ext = getFileExtension(file.name).toUpperCase();
  const category = getFileCategory(file.name);
  const colors = getFileTypeColor(category);

  return (
    <button
      className="file-grid-item text-left"
      onClick={() => onViewDetails(file)}
    >
      <div className="mb-3 flex items-center justify-center rounded-xl" style={{ background: "var(--border-subtle)", height: 80 }}>
        <FileIcon name={file.name} size={48} />
      </div>
      <p className="truncate text-sm font-medium" style={{ color: "var(--text-primary)" }}>
        {file.name}
      </p>
      <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
        {ext} · {humanSize(file.original_size)}
      </p>
    </button>
  );
}
