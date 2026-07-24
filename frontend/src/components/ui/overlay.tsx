"use client";

import {
  useEffect,
  useId,
  useRef,
  type ReactElement,
  type ReactNode,
} from "react";
import { X } from "lucide-react";

import { IconButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DropdownMenu({
  trigger,
  children,
  align = "right",
}: {
  trigger: ReactElement<{ onClick?: () => void; "aria-expanded"?: boolean }>;
  children: ReactNode;
  align?: "left" | "right";
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  return (
    <details ref={detailsRef} className="group relative">
      <summary className="list-none [&::-webkit-details-marker]:hidden">
        {trigger}
      </summary>
      <div
        className={cn(
          "absolute top-[calc(100%+8px)] z-50 min-w-64 rounded-[var(--radius-card)] border border-border bg-surface-elevated p-2 shadow-[var(--shadow-elevated)]",
          align === "right" ? "right-0" : "left-0",
        )}
        onClick={() => detailsRef.current?.removeAttribute("open")}
      >
        {children}
      </div>
    </details>
  );
}

export function Sheet({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="sheet-title"
      onClose={() => onOpenChange(false)}
      onCancel={() => onOpenChange(false)}
      className="m-0 ml-auto h-dvh max-h-none w-[min(90vw,360px)] max-w-none rounded-l-[var(--radius-dialog)] border-0 bg-surface-elevated p-0 text-text-primary shadow-[var(--shadow-elevated)]"
    >
      <div className="flex h-full flex-col">
        <header className="flex min-h-16 items-center justify-between border-b border-border px-4">
          <h2 id="sheet-title" className="font-semibold">
            {title}
          </h2>
          <IconButton aria-label="Close menu" onClick={() => onOpenChange(false)}>
            <X className="size-5" />
          </IconButton>
        </header>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </dialog>
  );
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  size = "default",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  size?: "default" | "large";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClose={() => onOpenChange(false)}
      onCancel={() => onOpenChange(false)}
      className={cn(
        "m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-1.5rem)] overflow-hidden rounded-[var(--radius-dialog)] border-0 bg-surface-elevated p-0 text-text-primary shadow-[var(--shadow-elevated)]",
        size === "large" ? "max-w-3xl" : "max-w-lg",
      )}
    >
      <header className="flex items-start justify-between gap-4 border-b border-border p-5">
        <div>
          <h2 id={titleId} className="text-lg font-bold">
            {title}
          </h2>
          {description ? (
            <p id={descriptionId} className="mt-1 text-sm leading-5 text-text-muted">
              {description}
            </p>
          ) : null}
        </div>
        <IconButton aria-label="Close dialog" onClick={() => onOpenChange(false)}>
          <X className="size-5" />
        </IconButton>
      </header>
      <div className="max-h-[calc(100dvh-7rem)] overflow-y-auto p-4 sm:p-5">{children}</div>
    </dialog>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  loading = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  loading?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
    >
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          autoFocus
          disabled={loading}
          onClick={() => onOpenChange(false)}
          className="min-h-11 rounded-[var(--radius-control)] border border-border-strong px-4 text-sm font-semibold hover:bg-surface-secondary disabled:opacity-50"
        >
          Keep working
        </button>
        <button
          type="button"
          disabled={loading}
          aria-busy={loading}
          onClick={onConfirm}
          className="min-h-11 rounded-[var(--radius-control)] border border-danger bg-danger px-4 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"
        >
          {loading ? "Working…" : confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
