"use client";

import { useState } from "react";
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

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export default function FileGateway() {
  const [query, setQuery] = useState("");
  const queryClient = useQueryClient();

  const stats = useQuery<Stats>({
    queryKey: ["stats"],
    queryFn: async () => (await fetch("/api/stats")).json(),
    refetchInterval: 5000,
  });

  const files = useQuery<{ files: FileRecord[] }>({
    queryKey: ["files"],
    queryFn: async () => (await fetch("/api/files")).json(),
    refetchInterval: 5000,
  });

  const search = useQuery<{ results: FileRecord[] }>({
    queryKey: ["search", query],
    enabled: query.length > 0,
    queryFn: async () => (await fetch(`/api/search?q=${encodeURIComponent(query)}`)).json(),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/files/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });

  const visible = query.length > 0 ? search.data?.results ?? [] : files.data?.files ?? [];

  return (
    <main className="mx-auto max-w-6xl p-8">
      <header className="mb-8">
        <h1 className="text-4xl font-bold">🚀 File Gateway</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Pure-Rust file management · deduplication · compression
        </p>
      </header>

      <section className="mb-8">
        <FilePond
          allowMultiple
          maxFiles={20}
          server={{
            process: (_field, file, _metadata, load, error) => {
              const formData = new FormData();
              formData.append("file", file as File);
              fetch("/api/upload", { method: "POST", body: formData })
                .then((r) => r.json())
                .then(() => {
                  load(file.name);
                  queryClient.invalidateQueries({ queryKey: ["files"] });
                  queryClient.invalidateQueries({ queryKey: ["stats"] });
                })
                .catch((e) => error(e));
            },
          }}
          labelIdle='Drag & drop your files or <span class="filepond--label-action">browse</span>'
        />
      </section>

      <section className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard title="Files" value={String(stats.data?.total_files ?? 0)} />
        <StatCard title="Original" value={humanSize(stats.data?.total_original ?? 0)} />
        <StatCard title="Stored" value={humanSize(stats.data?.total_compressed ?? 0)} />
        <StatCard
          title="Saved (dedup)"
          value={`${((stats.data?.dedup_ratio ?? 0)).toFixed(1)}%`}
        />
      </section>

      <section className="mb-6 flex gap-2">
        <input
          className="flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
          placeholder="Search files by name or hash…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query.length > 0 && (
          <button
            className="rounded bg-gray-200 px-3 py-2 text-sm dark:bg-gray-700"
            onClick={() => setQuery("")}
          >
            Clear
          </button>
        )}
      </section>

      <section className="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800">
        <div className="border-b p-4 dark:border-gray-700">
          <h2 className="text-xl font-semibold">📁 Files</h2>
        </div>
        <div className="divide-y dark:divide-gray-700">
          {visible.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No files yet.</div>
          ) : (
            visible.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{f.name}</div>
                  <div className="text-sm text-gray-500">
                    {humanSize(f.original_size)} → {humanSize(f.compressed_size)} ·{" "}
                    {f.chunk_count} chunks ({f.unique_chunks} unique)
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-green-600 dark:text-green-400">
                    {f.dedup_saved > 0
                      ? `${((f.dedup_saved / f.original_size) * 100).toFixed(0)}% dedup`
                      : "stored"}
                  </span>
                  <button
                    className="rounded bg-red-500 px-3 py-1 text-sm text-white hover:bg-red-600"
                    onClick={() => deleteMutation.mutate(f.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
