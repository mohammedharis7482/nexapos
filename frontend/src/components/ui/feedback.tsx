import { AlertCircle, Inbox, LoaderCircle, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return (
    <LoaderCircle
      className={cn("size-5 animate-spin text-primary", className)}
      aria-label="Loading"
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-lg bg-slate-200", className)}
      aria-hidden="true"
    />
  );
}

export function Alert({
  title,
  children,
  tone = "danger",
}: {
  title: string;
  children?: ReactNode;
  tone?: "danger" | "success" | "warning";
}) {
  const toneStyles = {
    danger: "border-red-200 bg-danger-soft text-danger",
    success: "border-emerald-200 bg-success-soft text-success",
    warning: "border-orange-200 bg-warning-soft text-warning",
  };
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("rounded-xl border p-3 text-sm", toneStyles[tone])}
    >
      <p className="font-semibold">{title}</p>
      {children ? <div className="mt-1 text-text-secondary">{children}</div> : null}
    </div>
  );
}

export function AppLoading({ message = "Loading NexaPOS…" }: { message?: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-background p-6">
      <div className="text-center">
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-primary-soft">
          <Spinner />
        </div>
        <p className="text-sm font-medium text-text-secondary">{message}</p>
      </div>
    </main>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border-strong p-8 text-center">
      <Inbox className="mx-auto mb-3 size-8 text-text-muted" aria-hidden="true" />
      <h2 className="font-semibold text-text-primary">{title}</h2>
      <p className="mt-1 text-sm text-text-muted">{description}</p>
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
}: {
  title?: string;
  description: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-red-200 bg-danger-soft p-6 text-center">
      <AlertCircle className="mx-auto mb-3 size-8 text-danger" />
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-text-secondary">{description}</p>
      {onRetry ? (
        <Button
          variant="secondary"
          className="mt-4"
          leadingIcon={<RefreshCw className="size-4" />}
          onClick={onRetry}
        >
          Try again
        </Button>
      ) : null}
    </div>
  );
}
