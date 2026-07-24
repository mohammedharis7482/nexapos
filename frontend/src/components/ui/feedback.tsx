import {
  AlertCircle,
  CheckCircle2,
  Inbox,
  Info,
  LoaderCircle,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
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
      className={cn("animate-pulse rounded-lg bg-slate-200/80", className)}
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
  tone?: "danger" | "success" | "warning" | "info";
}) {
  const toneStyles = {
    danger: "border-red-200 bg-danger-soft text-danger",
    success: "border-emerald-200 bg-success-soft text-success",
    warning: "border-orange-200 bg-warning-soft text-warning",
    info: "border-blue-200 bg-info-soft text-info",
  };
  const Icon = {
    danger: AlertCircle,
    success: CheckCircle2,
    warning: TriangleAlert,
    info: Info,
  }[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-3 rounded-[var(--radius-control)] border p-3 text-sm",
        toneStyles[tone],
      )}
    >
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-semibold">{title}</p>
        {children ? <div className="mt-1 text-text-secondary">{children}</div> : null}
      </div>
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
  action,
  compact = false,
  tone = "neutral",
}: {
  title: string;
  description: string;
  action?: ReactNode;
  compact?: boolean;
  tone?: "neutral" | "success";
}) {
  return (
    <div className={cn("rounded-[var(--radius-card)] border border-dashed text-center", compact ? "p-5" : "p-8", tone === "success" ? "border-emerald-200 bg-success-soft/50" : "border-border-strong")}>
      {tone === "success" ? <CheckCircle2 className="mx-auto mb-2.5 size-7 text-success" aria-hidden="true" /> : <Inbox className="mx-auto mb-2.5 size-7 text-text-muted" aria-hidden="true" />}
      <h2 className="font-semibold text-text-primary">{title}</h2>
      <p className="mt-1 text-sm text-text-muted">{description}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
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
