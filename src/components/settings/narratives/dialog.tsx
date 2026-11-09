"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

// Small modal on the native <dialog> element: the browser handles focus,
// Escape and the backdrop, so no extra dependency is needed.
export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label={title}
      className={cn(
        "m-auto w-[min(30rem,calc(100vw-2rem))] border border-strong bg-card p-5 text-foreground",
        "backdrop:bg-black/70",
      )}
    >
      {open && (
        <>
          <h2 className="text-sm font-medium text-foreground">{title}</h2>
          <div className="mt-3">{children}</div>
        </>
      )}
    </dialog>
  );
}

export function DialogButtons({
  confirmLabel,
  pendingLabel,
  pending,
  disabled,
  onCancel,
  onConfirm,
}: {
  confirmLabel: string;
  pendingLabel: string;
  pending: boolean;
  disabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const off = pending || disabled;
  return (
    <div className="mt-5 flex items-center justify-end gap-2">
      <button
        type="button"
        onClick={onCancel}
        className="cursor-pointer border border-border bg-card px-3 py-1 font-mono text-[11px] text-text-tertiary hover:border-strong hover:text-foreground"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={off}
        className={cn(
          "border px-3 py-1 font-mono text-[11px] transition-colors",
          off
            ? "cursor-not-allowed border-border bg-card text-text-tertiary"
            : "cursor-pointer border-strong bg-foreground text-primary-foreground hover:bg-text-secondary",
        )}
      >
        {pending ? pendingLabel : confirmLabel}
      </button>
    </div>
  );
}
