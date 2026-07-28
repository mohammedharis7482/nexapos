"use client";

import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

export function UnexpectedError({
  retry,
  fullPage = false,
}: {
  retry: () => void;
  fullPage?: boolean;
}) {
  return (
    <main className={fullPage ? "grid min-h-screen place-items-center bg-background p-6" : "grid min-h-[50vh] place-items-center p-6"}>
      <section className="w-full max-w-md rounded-[var(--radius-card)] border border-danger-border bg-surface p-6 text-center shadow-[var(--shadow-xs)]" aria-labelledby="unexpected-error-title">
        <h1 id="unexpected-error-title" className="text-xl font-bold">This screen could not be displayed</h1>
        <p className="mt-2 text-sm leading-6 text-foreground-muted">
          Your saved data has not been intentionally changed. Try loading this screen again.
        </p>
        <Button className="mt-5" leadingIcon={<RefreshCw className="size-4" />} onClick={retry}>
          Try again
        </Button>
      </section>
    </main>
  );
}
