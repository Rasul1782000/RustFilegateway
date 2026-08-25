"use client";

import { type ReactNode } from "react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  confirmDanger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Delete",
  confirmDanger = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="dialog-backdrop" onClick={onCancel} role="dialog" aria-modal="true" aria-label={title}>
      <div className="dialog-panel" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h3>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{description}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onCancel} className="btn-outline text-sm">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={confirmDanger ? "btn-danger text-sm" : "btn-primary text-sm"}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
