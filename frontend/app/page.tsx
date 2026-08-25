"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FilePond, registerPlugin } from "react-filepond";
import FilePondPluginFileValidateSize from "filepond-plugin-file-validate-size";
import "filepond/dist/filepond.min.css";

registerPlugin(FilePondPluginFileValidateSize);

type FileRecord = {
  id: string;
  name: string;
  hash: string;
  original_size: number;
  compressed_size: number;
  dedup_saved: number;
  chunk_count: number;
  unique_chunks: number;
  created_at: string;
};

type Stats = {
  total_files: number;
  total_original: number;
  total_compressed: number;
  total_dedup_saved: number;
  compression_ratio: number;
  dedup_ratio: number;
};

type ApiError = {
  message: string;
  code?: number;
};

function humanSize(bytes: number): string {
  if (bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function useDarkMode() {
  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem("fg-dark-mode");
    if (stored !== null) return stored === "true";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("fg-dark-mode", String(dark));
  }, [dark]);

  return { dark, toggle: () => setDark((d) => !d) };
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export default function FileGateway() {
  const [query, setQuery] = useState("");
  const { dark, toggle } = useDarkMode();
  const queryClient = useQueryClient();

  const stats = useQuery<Stats, ApiError>({
    queryKey: ["stats"],
    queryFn: () => apiFetch("/api/stats"),
    refetchInterval: 5000,
  });

  const files = useQuery<{ files: FileRecord[] }, ApiError>({
    queryKey: ["files"],
    queryFn: () => apiFetch("/api/files"),
    refetchInterval: 5000,
  });

  const search = useQuery<{ results: FileRecord[] }, ApiError>({
    queryKey: ["search", query],
    enabled: query.length > 0,
    queryFn: () => apiFetch(`/api/search?q=${encodeURIComponent(query)}`),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/files/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });

  const handleDownload = useCallback((id: string, name: string) => {
    const a = document.createElement("a");
    a.href = `/api/files/${id}/download`;
    a.download = name;
    a.click();
  }, []);

  const visible =
    query.length > 0 ? search.data?.results ?? [] : files.data?.files ?? [];

  const hasError = stats.isError || files.isError;
  const isLoading = stats.isLoading || files.isLoading;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-10 flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">
            File Gateway
          </h1>
          <p className="mt-2 text-lg text-gray-500 dark:text-gray-400">
            Pure-Rust file management with content-defined chunking,
            deduplication &amp; intelligent compression
          </p>
        </div>
        <button
          onClick={toggle}
          className="btn-ghost mt-1"
          title={dark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {dark ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>
      </header>

      {hasError && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <div className="flex items-center gap-3">
            <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-red-800 dark:text-red-400">
                Unable to connect to the backend server.
              </p>
              <p className="mt-1 text-xs text-red-600 dark:text-red-500">
                Make sure the Rust server is running on port 3000.
              </p>
            </div>
          </div>
        </div>
      )}

      <section className="mb-8">
        <FilePond
          allowMultiple
          maxFiles={20}
          server={{
            process: (_field, file, _metadata, load, error) => {
              const formData = new FormData();
              formData.append("file", file as File);
              fetch("/api/upload", { method: "POST", body: formData })
                .then((r) => {
                  if (!r.ok) throw new Error("Upload failed");
                  return r.json();
                })
                .then(() => {
                  load(file.name);
                  queryClient.invalidateQueries({ queryKey: ["files"] });
                  queryClient.invalidateQueries({ queryKey: ["stats"] });
                })
                .catch((e) => error(e));
            },
          }}
          labelIdle='Drag &amp; drop files here or <span class="filepond--label-action">browse</span>'
          labelFileLoadError="Error loading file"
          labelFileProcessing="Processing..."
          labelFileProcessingComplete="Upload complete"
          labelTapToCancel="Tap to cancel"
          labelTapToRetry="Tap to retry"
          labelButtonRemoveItem="Remove"
          labelButtonAbortItemLoad="Abort"
          labelButtonRetryItemLoad="Retry"
        />
      </section>

      <section className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {isLoading ? (
          <>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="stat-card">
                <div className="skeleton mb-2 h-4 w-16" />
                <div className="skeleton h-8 w-24" />
              </div>
            ))}
          </>
        ) : (
          <>
            <StatCard
              title="Files"
              value={String(stats.data?.total_files ?? 0)}
              icon={
                <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              }
            />
            <StatCard
              title="Original"
              value={humanSize(stats.data?.total_original ?? 0)}
              icon={
                <svg className="h-5 w-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                </svg>
              }
            />
            <StatCard
              title="Stored"
              value={humanSize(stats.data?.total_compressed ?? 0)}
              icon={
                <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
              }
            />
            <StatCard
              title="Saved (dedup)"
              value={`${(stats.data?.dedup_ratio ?? 0).toFixed(1)}%`}
              icon={
                <svg className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              }
            />
          </>
        )}
      </section>

      <section className="mb-6">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            className="input pl-10"
            placeholder="Search files by name or hash..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query.length > 0 && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              onClick={() => setQuery("")}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </section>

      <section className="card">
        <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-700">
          <h2 className="text-lg font-semibold">Files</h2>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {files.isLoading ? (
            <div className="space-y-4 p-5">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="skeleton h-10 w-10 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-4 w-48" />
                    <div className="skeleton h-3 w-32" />
                  </div>
                </div>
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <p className="mt-3 text-gray-500 dark:text-gray-400">
                {query.length > 0
                  ? `No files match "${query}"`
                  : "No files uploaded yet. Drag and drop to get started."}
              </p>
            </div>
          ) : (
            visible.map((f) => (
              <div key={f.id} className="file-row">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <div className="truncate font-medium text-gray-900 dark:text-gray-100">
                        {f.name}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <span>{humanSize(f.original_size)}</span>
                        <span>→</span>
                        <span>{humanSize(f.compressed_size)}</span>
                        <span className="text-gray-300 dark:text-gray-600">·</span>
                        <span>
                          {f.chunk_count} chunks ({f.unique_chunks} unique)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="ml-4 flex items-center gap-3">
                  {f.dedup_saved > 0 ? (
                    <span className="badge-green">
                      {((f.dedup_saved / f.original_size) * 100).toFixed(0)}% dedup
                    </span>
                  ) : (
                    <span className="badge-gray">stored</span>
                  )}
                  <button
                    className="btn-ghost px-2 py-1.5"
                    title="Download file"
                    onClick={() => handleDownload(f.id, f.name)}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                  <button
                    className="btn-ghost px-2 py-1.5 text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                    title="Delete file"
                    onClick={() => deleteMutation.mutate(f.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <footer className="mt-12 border-t border-gray-200 pt-6 text-center text-sm text-gray-400 dark:border-gray-800 dark:text-gray-600">
        File Gateway v2.0 — Built with Rust, Axum, Next.js &amp; Tailwind
      </footer>
    </main>
  );
}

function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
          {title}
        </span>
        {icon}
      </div>
      <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
        {value}
      </div>
    </div>
  );
}
