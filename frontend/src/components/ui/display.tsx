import type { ReactNode } from "react";

import { cn, initials } from "@/lib/utils";

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "primary" | "success" | "warning" | "danger";
  className?: string;
}) {
  const tones = {
    neutral: "bg-surface-secondary text-text-secondary",
    primary: "bg-primary-soft text-primary",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
  };
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center rounded-full px-2.5 text-xs font-semibold",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({
  label,
  online = true,
}: {
  label: string;
  online?: boolean;
}) {
  return (
    <Badge tone={online ? "success" : "warning"}>
      <span
        className={cn(
          "mr-1.5 size-1.5 rounded-full",
          online ? "bg-success" : "bg-warning",
        )}
        aria-hidden="true"
      />
      {label}
    </Badge>
  );
}

export function Avatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-sm font-bold text-primary",
        className,
      )}
      aria-label={`${name} avatar`}
    >
      {initials(name)}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-text-muted">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
