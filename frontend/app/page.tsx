"use client";

import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/utils";
import type { FileRecord, Stats, ApiError, UploadItem, FilterType, SortOption, ViewMode } from "@/lib/types";
import { getFileCategory } from "@/lib/utils";

import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { UploadZone } from "@/components/upload/UploadZone";
import { UploadQueue } from "@/components/upload/UploadQueue";
import { SearchBar } from "@/components/search/SearchBar";
import { SearchFilters } from "@/components/search/SearchFilters";
import { StorageOverview } from "@/components/dashboard/StorageOverview";
import { FileList } from "@/components/files/FileList";
import { FileDetails } from "@/components/files/FileDetails";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { useToast } from "@/components/feedback/Toast";

export default function FileGateway() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const [query, setQuery] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [sort, setSort] = useState<SortOption>("newest");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FileRecord | null>(null);
  const uploadZoneRef = useRef<HTMLDivElement>(null);

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
      addToast({ type: "success", title: "File deleted" });
    },
    onError: () => {
      addToast({ type: "error", title: "Unable to delete file", description: "The server could not complete the request." });
    },
  });

  const sortFiles = useCallback(
    (fileList: FileRecord[]): FileRecord[] => {
      const sorted = [...fileList];
      switch (sort) {
        case "newest":
          return sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        case "oldest":
          return sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        case "name-asc":
          return sorted.sort((a, b) => a.name.localeCompare(b.name));
        case "desc":
          return sorted.sort((a, b) => b.name.localeCompare(a.name));
        case "largest":
          return sorted.sort((a, b) => b.original_size - a.original_size);
        case "smallest":
          return sorted.sort((a, b) => a.original_size - b.original_size);
        default:
          return sorted;
      }
    },
    [sort]
  );

  const filterFiles = useCallback(
    (fileList: FileRecord[]): FileRecord[] => {
      if (filterType === "all") return fileList;
      const categoryMap: Record<string, string[]> = {
        documents: ["document"],
        images: ["image"],
        videos: ["video"],
        archives: ["archive"],
        other: ["audio", "code", "data", "other"],
      };
      const allowed = categoryMap[filterType] || [];
      return fileList.filter((f) => allowed.includes(getFileCategory(f.name)));
    },
    [filterType]
  );

  const rawFiles = query.length > 0 ? search.data?.results ?? [] : files.data?.files ?? [];
  const visible = sortFiles(filterFiles(rawFiles));
  const hasError = stats.isError || files.isError;

  const scrollToUpload = () => {
    uploadZoneRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const uploadFile = useCallback(
    (file: File) => {
      const id = Math.random().toString(36).slice(2, 9);
      const item: UploadItem = { id, file, name: file.name, size: file.size, progress: 0, status: "uploading" };
      setUploadItems((prev) => [...prev, item]);

      const formData = new FormData();
      formData.append("file", file);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/upload");

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          setUploadItems((prev) =>
            prev.map((i) => (i.id === id ? { ...i, progress } : i))
          );
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setUploadItems((prev) =>
            prev.map((i) => (i.id === id ? { ...i, status: "complete", progress: 100 } : i))
          );
          queryClient.invalidateQueries({ queryKey: ["files"] });
          queryClient.invalidateQueries({ queryKey: ["stats"] });
        } else {
          setUploadItems((prev) =>
            prev.map((i) => (i.id === id ? { ...i, status: "error", error: "Upload failed" } : i))
          );
        }
      };

      xhr.onerror = () => {
        setUploadItems((prev) =>
          prev.map((i) => (i.id === id ? { ...i, status: "error", error: "Network error" } : i))
        );
      };

      xhr.send(formData);
    },
    [queryClient]
  );

  const handleFiles = useCallback(
    (newFiles: File[]) => {
      const remaining = 20 - uploadItems.length;
      const toUpload = newFiles.slice(0, remaining);
      if (toUpload.length < newFiles.length) {
        addToast({ type: "info", title: "Upload limit reached", description: "Maximum 20 files at a time." });
      }
      toUpload.forEach((f) => uploadFile(f));
    },
    [uploadItems.length, uploadFile, addToast]
  );

  const retryUpload = useCallback(
    (id: string) => {
      const item = uploadItems.find((i) => i.id === id);
      if (item) {
        setUploadItems((prev) => prev.filter((i) => i.id !== id));
        uploadFile(item.file);
      }
    },
    [uploadItems, uploadFile]
  );

  const removeUploadItem = useCallback((id: string) => {
    setUploadItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const handleDownload = useCallback((id: string, name: string) => {
    const a = document.createElement("a");
    a.href = `/api/files/${id}/download`;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  const handleDelete = useCallback(() => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget.id);
      setDeleteTarget(null);
      if (selectedFile?.id === deleteTarget.id) {
        setSelectedFile(null);
      }
    }
  }, [deleteTarget, deleteMutation, selectedFile]);

  const hasActiveUploads = uploadItems.some((i) => i.status === "uploading" || i.status === "queued");

  return (
    <div className="min-h-screen">
      <Header onUploadClick={scrollToUpload} />

      <PageContainer>
        {hasError && (
          <div
            className="mb-6 flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm"
            style={{ background: "var(--danger-subtle)", border: "1px solid rgba(220,38,38,0.2)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div>
              <p className="font-medium" style={{ color: "var(--danger)" }}>Unable to connect to the backend server.</p>
              <p className="mt-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>Make sure the Rust server is running on port 3000.</p>
            </div>
          </div>
        )}

        <section className="mb-2">
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Manage your files effortlessly
          </h1>
          <p className="mt-1.5 text-sm" style={{ color: "var(--text-secondary)" }}>
            Upload, search and organize your files from one clean workspace.
          </p>
          <div className="mt-3 flex items-center gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
            <span>{(stats.data?.total_files ?? 0).toLocaleString()} files</span>
            <span>·</span>
            <span>{stats.data ? `${(stats.data.total_compressed / (1024 * 1024 * 1024)).toFixed(1)} GB stored` : "Loading..."}</span>
          </div>
        </section>

        <section ref={uploadZoneRef} className="mb-8 mt-6">
          <UploadZone onFiles={handleFiles} disabled={hasActiveUploads} />
        </section>

        <section className="mb-6">
          <UploadQueue items={uploadItems} onRemove={removeUploadItem} onRetry={retryUpload} />
        </section>

        <section className="mb-8">
          <StorageOverview stats={stats.data} isLoading={stats.isLoading} />
        </section>

        <section className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
              Files
            </h2>
            <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
              {visible.length} item{visible.length !== 1 ? "s" : ""}
              {query.length > 0 && ` matching "${query}"`}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="w-full sm:w-64">
              <SearchBar
                value={query}
                onChange={setQuery}
                isLoading={search.isLoading}
              />
            </div>
            <SearchFilters
              filterType={filterType}
              sort={sort}
              viewMode={viewMode}
              onFilterTypeChange={setFilterType}
              onSortChange={setSort}
              onViewModeChange={setViewMode}
            />
          </div>
        </section>

        <section className="mb-12">
          <FileList
            files={visible}
            viewMode={viewMode}
            isLoading={files.isLoading}
            isSearching={query.length > 0}
            searchQuery={query}
            onDownload={handleDownload}
            onDelete={setDeleteTarget}
            onViewDetails={setSelectedFile}
          />
        </section>

        <footer className="border-t py-6 text-center text-xs" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
          File Gateway v2.0 — Built with Rust, Axum, Next.js & Tailwind
        </footer>
      </PageContainer>

      <FileDetails
        file={selectedFile}
        onClose={() => setSelectedFile(null)}
        onDownload={handleDownload}
        onDelete={(f) => { setSelectedFile(null); setDeleteTarget(f); }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title={`Delete "${deleteTarget?.name ?? ""}"?`}
        description="This file will be permanently removed. This action cannot be undone."
        confirmLabel="Delete file"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
