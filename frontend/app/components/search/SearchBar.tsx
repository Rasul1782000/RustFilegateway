"use client";

import { useEffect, useRef } from "react";

type SearchBarProps = {
  value: string;
  onChange: (value: string) => void;
  resultCount?: number;
  isLoading?: boolean;
};

export function SearchBar({ value, onChange, resultCount, isLoading }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape" && document.activeElement === inputRef.current) {
        onChange("");
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onChange]);

  return (
    <div className="relative">
      <svg
        className="absolute left-3.5 top-1/2 -translate-y-1/2"
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--text-muted)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        ref={inputRef}
        className="input py-2 pl-10 pr-24"
        placeholder="Search files..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Search files"
      />
      <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
        {isLoading && value.length > 0 && (
          <div className="h-4 w-4 animate-spin rounded-full border-2" style={{ borderColor: "var(--border)", borderTopColor: "var(--text-muted)" }} />
        )}
        {value.length > 0 && (
          <button
            onClick={() => onChange("")}
            className="rounded p-0.5 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
            style={{ color: "var(--text-muted)" }}
            aria-label="Clear search"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
        <kbd className="hidden rounded px-1.5 py-0.5 text-[10px] font-medium sm:inline-block" style={{ background: "var(--border-subtle)", color: "var(--text-muted)" }}>
          ⌘K
        </kbd>
      </div>
    </div>
  );
}
