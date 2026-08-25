"use client";

import type { FilterType, SortOption, ViewMode } from "@/lib/types";

type SearchFiltersProps = {
  filterType: FilterType;
  sort: SortOption;
  viewMode: ViewMode;
  onFilterTypeChange: (f: FilterType) => void;
  onSortChange: (s: SortOption) => void;
  onViewModeChange: (v: ViewMode) => void;
};

const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "documents", label: "Documents" },
  { value: "images", label: "Images" },
  { value: "videos", label: "Videos" },
  { value: "archives", label: "Archives" },
  { value: "other", label: "Other" },
];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "name-asc", label: "Name A–Z" },
  { value: "desc", label: "Name Z–A" },
  { value: "largest", label: "Largest" },
  { value: "smallest", label: "Smallest" },
];

export function SearchFilters({
  filterType,
  sort,
  viewMode,
  onFilterTypeChange,
  onSortChange,
  onViewModeChange,
}: SearchFiltersProps) {
  return (
    <div className="flex items-center gap-2">
      <select
        className="input py-2 pr-8 text-xs"
        value={filterType}
        onChange={(e) => onFilterTypeChange(e.target.value as FilterType)}
        aria-label="Filter by type"
      >
        {FILTER_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <select
        className="input py-2 pr-8 text-xs"
        value={sort}
        onChange={(e) => onSortChange(e.target.value as SortOption)}
        aria-label="Sort files"
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <div className="flex items-center rounded-md" style={{ border: "1px solid var(--border)" }}>
        <button
          onClick={() => onViewModeChange("list")}
          className="p-1.5 transition-colors"
          style={{
            background: viewMode === "list" ? "var(--border-subtle)" : "transparent",
            color: viewMode === "list" ? "var(--text-primary)" : "var(--text-muted)",
          }}
          aria-label="List view"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
        </button>
        <button
          onClick={() => onViewModeChange("grid")}
          className="p-1.5 transition-colors"
          style={{
            background: viewMode === "grid" ? "var(--border-subtle)" : "transparent",
            color: viewMode === "grid" ? "var(--text-primary)" : "var(--text-muted)",
          }}
          aria-label="Grid view"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
