export type FileRecord = {
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

export type Stats = {
  total_files: number;
  total_original: number;
  total_compressed: number;
  total_dedup_saved: number;
  compression_ratio: number;
  dedup_ratio: number;
};

export type ApiError = {
  message: string;
  code?: number;
};

export type FileTypeCategory =
  | "document"
  | "image"
  | "video"
  | "audio"
  | "archive"
  | "code"
  | "data"
  | "other";

export type SortOption = "newest" | "oldest" | "name-asc" | "desc" | "largest" | "smallest";

export type FilterType = "all" | "documents" | "images" | "videos" | "archives" | "other";

export type ViewMode = "list" | "grid";

export type UploadItem = {
  id: string;
  file: File;
  name: string;
  size: number;
  progress: number;
  status: "uploading" | "complete" | "error" | "queued";
  error?: string;
};

export type ToastItem = {
  id: string;
  type: "success" | "error" | "info";
  title: string;
  description?: string;
};
