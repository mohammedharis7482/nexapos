"use client";

import {
  useEffect,
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
          "absolute top-[calc(100%+8px)] z-50 min-w-64 rounded-2xl border border-border bg-surface p-2 shadow-[0_12px_28px_rgb(16_24_40_/_0.14)]",
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
      className="m-0 ml-auto h-dvh max-h-none w-[min(88vw,360px)] max-w-none translate-x-0 rounded-l-[20px] border-0 bg-surface p-0 text-text-primary backdrop:bg-slate-950/45"
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
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
      aria-labelledby="dialog-title"
      aria-describedby={description ? "dialog-description" : undefined}
      onClose={() => onOpenChange(false)}
      onCancel={() => onOpenChange(false)}
      className="m-auto w-[calc(100%-32px)] max-w-lg rounded-[20px] border-0 bg-surface p-0 text-text-primary shadow-xl backdrop:bg-slate-950/45"
    >
      <header className="flex items-start justify-between gap-4 border-b border-border p-5">
        <div>
          <h2 id="dialog-title" className="text-lg font-bold">
            {title}
          </h2>
          {description ? (
            <p id="dialog-description" className="mt-1 text-sm text-text-muted">
              {description}
            </p>
          ) : null}
        </div>
        <IconButton aria-label="Close dialog" onClick={() => onOpenChange(false)}>
          <X className="size-5" />
        </IconButton>
      </header>
      <div className="p-5">{children}</div>
    </dialog>
  );
}
