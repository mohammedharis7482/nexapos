"use client";

import {
  cloneElement,
  useEffect,
  useId,
  useRef,
  useState,
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
  label = "Open menu",
}: {
  trigger: ReactElement<{ onClick?: () => void; "aria-expanded"?: boolean }>;
  children: ReactNode;
  align?: "left" | "right";
  label?: string;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function closeOutside(event: PointerEvent) {
      if (!detailsRef.current?.contains(event.target as Node)) {
        detailsRef.current?.removeAttribute("open");
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  return (
    <details
      ref={detailsRef}
      className="group relative"
      onToggle={(event) => setOpen(event.currentTarget.open)}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          detailsRef.current?.removeAttribute("open");
          setOpen(false);
          detailsRef.current?.querySelector("summary")?.focus();
        }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          const items = Array.from(
            detailsRef.current?.querySelectorAll<HTMLElement>(
              '[role="menuitem"]:not([disabled]), button:not([disabled]), a[href]',
            ) ?? [],
          ).filter((item) => item.closest("summary") === null);
          if (!items.length) return;
          event.preventDefault();
          const current = items.indexOf(document.activeElement as HTMLElement);
          const offset = event.key === "ArrowDown" ? 1 : -1;
          items[(current + offset + items.length) % items.length]?.focus();
        }
      }}
    >
      <summary aria-label={label} aria-haspopup="menu" className="list-none cursor-pointer rounded-[var(--radius-md)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)] [&::-webkit-details-marker]:hidden">
        {trigger}
      </summary>
      <div
        role="menu"
        className={cn(
          "absolute top-[calc(100%+8px)] z-50 max-h-[min(24rem,calc(100dvh-6rem))] min-w-[max(100%,16rem)] overflow-y-auto overscroll-contain rounded-[var(--radius-card)] border border-border bg-surface-elevated p-2 shadow-[var(--shadow-elevated)]",
          align === "right" ? "right-0" : "left-0",
        )}
        onClick={() => {
          detailsRef.current?.removeAttribute("open");
          setOpen(false);
        }}
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
  description,
  children,
  footer,
  dismissible = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  dismissible?: boolean;
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
      onCancel={(event) => {
        if (!dismissible) {
          event.preventDefault();
          return;
        }
        onOpenChange(false);
      }}
      className="m-0 ml-auto h-dvh max-h-none w-[min(92vw,400px)] max-w-none overflow-hidden rounded-l-[var(--radius-dialog)] border-0 bg-surface-elevated p-0 text-text-primary shadow-[var(--shadow-elevated)]"
    >
      <div className="flex h-full flex-col">
        <header className="flex min-h-16 items-start justify-between gap-3 border-b border-border px-4 py-3.5">
          <div><h2 id={titleId} className="font-semibold">{title}</h2>
          {description ? <p id={descriptionId} className="mt-0.5 text-sm text-foreground-muted">{description}</p> : null}</div>
          <IconButton aria-label="Close panel" disabled={!dismissible} onClick={() => onOpenChange(false)}>
            <X className="size-5" />
          </IconButton>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">{children}</div>
        {footer ? <footer className="shrink-0 border-t border-border bg-surface px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">{footer}</footer> : null}
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
  footer,
  size = "default",
  dismissible = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "small" | "default" | "large";
  dismissible?: boolean;
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
      onCancel={(event) => {
        if (!dismissible) {
          event.preventDefault();
          return;
        }
        onOpenChange(false);
      }}
      onClick={(event) => {
        if (dismissible && event.target === event.currentTarget) onOpenChange(false);
      }}
      className={cn(
        "m-auto max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] overflow-hidden rounded-[var(--radius-dialog)] border-0 bg-surface-elevated p-0 text-text-primary shadow-[var(--shadow-elevated)]",
        size === "small" ? "max-w-md" : size === "large" ? "max-w-3xl" : "max-w-lg",
      )}
    >
      <div className="flex max-h-[calc(100dvh-1.5rem)] flex-col">
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border p-4 sm:p-5">
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
        <IconButton aria-label="Close dialog" disabled={!dismissible} onClick={() => onOpenChange(false)}>
          <X className="size-5" />
        </IconButton>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">{children}</div>
      {footer ? <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-border bg-surface px-4 py-3 sm:flex-row sm:justify-end sm:px-5">{footer}</footer> : null}
      </div>
    </dialog>
  );
}

export const Drawer = Sheet;
export const AlertDialog = ConfirmDialog;

export function Tooltip({
  label,
  children,
}: {
  label: string;
  children: ReactElement<{ "aria-describedby"?: string }>;
}) {
  const id = useId();
  return (
    <span className="group relative inline-flex">
      {cloneElement(children, { "aria-describedby": id })}
      <span id={id} role="tooltip" className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-50 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs text-foreground-inverse shadow-[var(--shadow-sm)] group-hover:block group-focus-within:block">
        {label}
      </span>
    </span>
  );
}

export function Popover({
  trigger,
  children,
  align = "left",
}: {
  trigger: ReactElement<{ onClick?: () => void; "aria-expanded"?: boolean }>;
  children: ReactNode;
  align?: "left" | "right";
}) {
  return <DropdownMenu trigger={trigger} align={align} label="Open popover">{children}</DropdownMenu>;
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
      dismissible={!loading}
      size="small"
      footer={
        <>
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
            className="min-h-11 rounded-[var(--radius-control)] border border-danger bg-danger px-4 text-sm font-semibold text-white hover:bg-danger-hover disabled:opacity-50"
          >
            {loading ? "Working…" : confirmLabel}
          </button>
        </>
      }
    >
      <span className="sr-only">Choose whether to keep working or continue with this destructive action.</span>
    </Dialog>
  );
}
