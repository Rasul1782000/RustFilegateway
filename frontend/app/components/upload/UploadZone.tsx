"use client";

import { useState, useRef, useCallback } from "react";

type UploadZoneProps = {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
};

export function UploadZone({ onFiles, disabled }: UploadZoneProps) {
  const [dragover, setDragover] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setDragover(true);
    }
  }, []);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setDragover(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragover(false);
      dragCounter.current = 0;
      if (disabled) return;
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) onFiles(files);
    },
    [onFiles, disabled]
  );

  const handleClick = () => {
    if (!disabled) inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) onFiles(files);
    e.target.value = "";
  };

  return (
    <div
      className={`upload-zone ${dragover ? "dragover" : ""} ${disabled ? "pointer-events-none opacity-50" : ""}`}
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleClick(); }}
      aria-label="Upload files"
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleChange}
      />
      <div
        className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl transition-all duration-200 ${dragover ? "scale-110" : ""}`}
        style={{ background: dragover ? "var(--primary)" : "var(--border-subtle)" }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke={dragover ? "white" : "var(--text-secondary)"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-transform duration-200"
          style={{ transform: dragover ? "translateY(-2px)" : "none" }}
        >
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      </div>
      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
        {dragover ? "Drop to upload" : "Drop files here"}
      </p>
      <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
        or <span className="font-medium" style={{ color: "var(--primary)" }}>browse</span> from your computer
      </p>
      <p className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
        Maximum 20 files
      </p>
    </div>
  );
}
