"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ShopIdDisplay({
  shopId,
  className,
}: {
  shopId: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copyShopId() {
    await navigator.clipboard.writeText(shopId);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className={cn("rounded-[var(--radius-control)] border border-border bg-surface p-3", className)}>
      <p className="text-xs font-bold uppercase tracking-wide text-foreground-muted">Shop ID</p>
      <code className="mt-1 block break-all font-mono text-sm font-semibold text-foreground">
        {shopId}
      </code>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-3 w-full sm:w-auto"
        leadingIcon={copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        onClick={() => void copyShopId()}
      >
        {copied ? "Shop ID copied" : "Copy Shop ID"}
      </Button>
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? "Shop ID copied to clipboard." : ""}
      </span>
    </div>
  );
}
