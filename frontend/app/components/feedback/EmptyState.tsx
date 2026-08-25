"use client";

import { type ReactNode } from "react";

type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center px-6 py-20 text-center">
      {icon && (
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: "var(--border-subtle)" }}>
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
