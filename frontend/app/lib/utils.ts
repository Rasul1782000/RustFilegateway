import { FileTypeCategory } from "./types";

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export function humanSize(bytes: number): string {
  if (bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function relativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function getFileExtension(name: string): string {
  const parts = name.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

export function getFileCategory(name: string): FileTypeCategory {
  const ext = getFileExtension(name);
  const map: Record<string, FileTypeCategory> = {
    pdf: "document",
    doc: "document",
    docx: "document",
    rtf: "document",
    odt: "document",
    txt: "document",
    md: "document",
    png: "image",
    jpg: "image",
    jpeg: "image",
    gif: "image",
    webp: "image",
    svg: "image",
    bmp: "image",
    ico: "image",
    mp4: "video",
    mkv: "video",
    avi: "video",
    mov: "video",
    webm: "video",
    mp3: "audio",
    wav: "audio",
    ogg: "audio",
    flac: "audio",
    aac: "audio",
    zip: "archive",
    rar: "archive",
    "7z": "archive",
    tar: "archive",
    gz: "archive",
    bz2: "archive",
    js: "code",
    ts: "code",
    jsx: "code",
    tsx: "code",
    py: "code",
    rs: "code",
    go: "code",
    java: "code",
    cpp: "code",
    c: "code",
    html: "code",
    css: "code",
    json: "code",
    yaml: "code",
    yml: "code",
    toml: "code",
    xml: "code",
    csv: "data",
    xls: "data",
    xlsx: "data",
    sql: "data",
    db: "data",
  };
  return map[ext] || "other";
}

export function getFileTypeLabel(category: FileTypeCategory): string {
  const labels: Record<FileTypeCategory, string> = {
    document: "Document",
    image: "Image",
    video: "Video",
    audio: "Audio",
    archive: "Archive",
    code: "Code",
    data: "Data",
    other: "File",
  };
  return labels[category];
}

export function getFileTypeColor(category: FileTypeCategory): { bg: string; text: string } {
  const colors: Record<FileTypeCategory, { bg: string; text: string }> = {
    document: { bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-600 dark:text-blue-400" },
    image: { bg: "bg-purple-50 dark:bg-purple-950/30", text: "text-purple-600 dark:text-purple-400" },
    video: { bg: "bg-pink-50 dark:bg-pink-950/30", text: "text-pink-600 dark:text-pink-400" },
    audio: { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-600 dark:text-amber-400" },
    archive: { bg: "bg-orange-50 dark:bg-orange-950/30", text: "text-orange-600 dark:text-orange-400" },
    code: { bg: "bg-green-50 dark:bg-green-950/30", text: "text-green-600 dark:text-green-400" },
    data: { bg: "bg-cyan-50 dark:bg-cyan-950/30", text: "text-cyan-600 dark:text-cyan-400" },
    other: { bg: "bg-gray-50 dark:bg-gray-800", text: "text-gray-500 dark:text-gray-400" },
  };
  return colors[category];
}
