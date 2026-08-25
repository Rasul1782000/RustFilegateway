"use client";

import type { Stats } from "@/lib/types";
import { humanSize } from "@/lib/utils";

type StorageOverviewProps = {
  stats: Stats | undefined;
  isLoading: boolean;
};

export function StorageOverview({ stats, isLoading }: StorageOverviewProps) {
  if (isLoading) {
    return (
      <div className="card p-5">
        <div className="flex gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex-1">
              <div className="skeleton mb-2 h-3 w-16" />
              <div className="skeleton h-5 w-24" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const totalFiles = stats?.total_files ?? 0;
  const totalOriginal = stats?.total_original ?? 0;
  const totalCompressed = stats?.total_compressed ?? 0;
  const dedupRatio = stats?.dedup_ratio ?? 0;
  const compressionRatio = stats?.compression_ratio ?? 0;

  return (
    <div className="card p-5">
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Files</p>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
            {totalFiles.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Original</p>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
            {humanSize(totalOriginal)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Stored</p>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
            {humanSize(totalCompressed)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Deduplication</p>
          <div className="mt-2 flex items-baseline gap-1.5">
            <p className="text-2xl font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
              {dedupRatio.toFixed(1)}%
            </p>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--border-subtle)" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(dedupRatio, 100)}%`, background: "var(--success)" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
