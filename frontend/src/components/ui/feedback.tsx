import {
  AlertCircle,
  CheckCircle2,
  Inbox,
  Info,
  LoaderCircle,
  RefreshCw,
  TriangleAlert,
  X,
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
      className={cn("animate-pulse rounded-lg bg-surface-muted", className)}
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
    danger: "border-danger-border bg-danger-soft text-danger",
    success: "border-success-border bg-success-soft text-success",
    warning: "border-warning-border bg-warning-soft text-warning",
    info: "border-info-border bg-info-soft text-info",
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
  secondaryAction,
  icon: Icon,
  compact = false,
  tone = "neutral",
}: {
  title: string;
  description: string;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  icon?: typeof Inbox;
  compact?: boolean;
  tone?: "neutral" | "success";
}) {
  return (
    <div className={cn("rounded-[var(--radius-card)] border border-dashed text-center", compact ? "p-5" : "p-8", tone === "success" ? "border-success-border bg-success-soft/50" : "border-border-strong")}>
      {tone === "success" ? <CheckCircle2 className="mx-auto mb-2.5 size-7 text-success" aria-hidden="true" /> : Icon ? <Icon className="mx-auto mb-2.5 size-7 text-text-muted" aria-hidden="true" /> : <Inbox className="mx-auto mb-2.5 size-7 text-text-muted" aria-hidden="true" />}
      <h2 className="font-semibold text-text-primary">{title}</h2>
      <p className="mt-1 text-sm text-text-muted">{description}</p>
      {action || secondaryAction ? <div className="mt-4 flex flex-wrap justify-center gap-2">{secondaryAction}{action}</div> : null}
    </div>
  );
}

export function ConnectionStatus({ online }: { online: boolean }) {
  return (
    <span role="status" className={cn("inline-flex items-center gap-1.5 text-xs font-semibold", online ? "text-success" : "text-warning")}>
      <span className={cn("size-1.5 rounded-full", online ? "bg-success" : "bg-warning")} aria-hidden="true" />
      {online ? "Network online" : "Network offline"}
    </span>
  );
}

export function Toast({
  title,
  description,
  tone = "info",
  onClose,
}: {
  title: string;
  description?: string;
  tone?: "success" | "info" | "warning" | "danger";
  onClose?: () => void;
}) {
  const Icon = {
    success: CheckCircle2,
    info: Info,
    warning: TriangleAlert,
    danger: AlertCircle,
  }[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} aria-live={tone === "danger" ? "assertive" : "polite"} className="flex w-[min(calc(100vw-2rem),24rem)] items-start gap-3 rounded-[var(--radius-lg)] border border-border bg-surface p-4 shadow-[var(--shadow-md)]">
      <Icon className={cn("mt-0.5 size-5 shrink-0", tone === "success" && "text-success", tone === "info" && "text-info", tone === "warning" && "text-warning", tone === "danger" && "text-danger")} aria-hidden="true" />
      <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{title}</p>{description ? <p className="mt-1 break-words text-sm text-foreground-muted">{description}</p> : null}</div>
      {onClose ? <button type="button" aria-label="Dismiss notification" onClick={onClose} className="-mr-1 -mt-1 grid size-9 shrink-0 place-items-center rounded-[var(--radius-control)] text-foreground-muted hover:bg-surface-hover hover:text-foreground"><X className="size-4" /></button> : null}
    </div>
  );
}

export function CardSkeleton() {
  return <div aria-label="Loading card" className="rounded-[var(--radius-card)] border border-border bg-surface p-5"><Skeleton className="h-4 w-24" /><Skeleton className="mt-4 h-8 w-36" /><Skeleton className="mt-3 h-3 w-2/3" /></div>;
}

export function FormSkeleton() {
  return <div aria-label="Loading form" className="space-y-5 rounded-[var(--radius-card)] border border-border bg-surface p-5">{Array.from({ length: 3 }, (_, index) => <div key={index}><Skeleton className="h-3 w-24" /><Skeleton className="mt-2 h-11 w-full" /></div>)}</div>;
}

export function PageSkeleton() {
  return <div aria-label="Loading page" className="space-y-6"><div><Skeleton className="h-3 w-20" /><Skeleton className="mt-3 h-8 w-64" /><Skeleton className="mt-3 h-4 w-96 max-w-full" /></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton /></div></div>;
}

export const InlineSpinner = Spinner;

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
    <div className="rounded-2xl border border-danger-border bg-danger-soft p-6 text-center">
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
