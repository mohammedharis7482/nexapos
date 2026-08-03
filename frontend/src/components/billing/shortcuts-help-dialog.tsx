"use client";

import { Dialog } from "@/components/ui/overlay";
import type { ShortcutBinding } from "@/hooks/use-shortcuts";

export function ShortcutsHelpDialog({
  open,
  onOpenChange,
  bindings,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bindings: ShortcutBinding[];
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Keyboard shortcuts"
      description="Available on this screen. Press Esc to close."
      size="small"
    >
      <dl className="space-y-3">
        {bindings.map((binding) => (
          <div key={binding.key} className="flex items-center justify-between gap-4">
            <dt className="text-sm text-foreground-secondary">{binding.description}</dt>
            <dd>
              <kbd className="rounded-md border border-border-strong bg-surface-subtle px-2 py-1 font-mono text-xs font-semibold text-foreground shadow-[var(--shadow-xs)]">
                {binding.key}
              </kbd>
            </dd>
          </div>
        ))}
        <div className="flex items-center justify-between gap-4 border-t border-border pt-3">
          <dt className="text-sm text-foreground-secondary">Move between products</dt>
          <dd className="flex gap-1">
            <kbd className="rounded-md border border-border-strong bg-surface-subtle px-2 py-1 font-mono text-xs font-semibold text-foreground shadow-[var(--shadow-xs)]">←↑↓→</kbd>
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-sm text-foreground-secondary">Close this dialog / any open dialog</dt>
          <dd>
            <kbd className="rounded-md border border-border-strong bg-surface-subtle px-2 py-1 font-mono text-xs font-semibold text-foreground shadow-[var(--shadow-xs)]">Esc</kbd>
          </dd>
        </div>
      </dl>
    </Dialog>
  );
}
