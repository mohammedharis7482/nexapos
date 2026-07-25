import type { ElementType, HTMLAttributes, ReactNode } from "react";

import { cn, initials } from "@/lib/utils";
import { formatDateTime, formatMoney, formatPercentage, formatQuantity } from "@/lib/formatters";

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
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
      <div className="min-w-0">
        {eyebrow ? <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.13em] text-primary">{eyebrow}</p> : null}
        <h1 className="text-[1.625rem] font-bold leading-tight tracking-[-0.025em] text-text-primary sm:text-[1.75rem]">{title}</h1>
        {description ? (
          <p className="mt-1.5 max-w-3xl text-sm leading-6 text-text-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "primary",
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  icon: ElementType;
  tone?: "primary" | "success" | "warning" | "danger";
}) {
  const tones = {
    primary: "bg-primary-soft text-primary",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
  };
  return (
    <div className="relative min-w-0 rounded-[var(--radius-card)] border border-border bg-surface p-[var(--card-padding)] shadow-[var(--shadow-card)]">
      <div>
        <div className="min-w-0">
          <p className="pr-11 text-xs font-semibold text-text-muted">{label}</p>
          <p className="mt-2 tabular-nums whitespace-nowrap text-[1.55rem] font-bold leading-none tracking-[-0.035em] text-text-primary sm:text-[1.75rem]">{value}</p>
          {detail ? <p className="mt-2 text-xs leading-5 text-text-muted">{detail}</p> : null}
        </div>
        <span className={cn("absolute right-[var(--card-padding)] top-[var(--card-padding)] grid size-10 place-items-center rounded-xl", tones[tone])}>
          <Icon className="size-[1.15rem]" aria-hidden="true" />
        </span>
      </div>
    </div>
  );
}

export function PaymentBadge({ methods }: { methods: string[] | string }) {
  const label = Array.isArray(methods) ? methods.join(" + ") : methods;
  return <Badge tone="primary">{label.replaceAll("_", " ")}</Badge>;
}

export function PageContainer({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("page-stack", className)} {...props} />;
}

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-base font-bold text-text-primary">{title}</h2>
        {description ? <p className="mt-1 text-sm text-text-muted">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function MoneyDisplay({
  value,
  currency = "QAR",
  className,
}: {
  value: string | number;
  currency?: string;
  className?: string;
}) {
  return (
    <span className={cn("tabular-nums whitespace-nowrap", className)}>
      {formatMoney(value, currency)}
    </span>
  );
}

export function QuantityDisplay({
  value,
  unit,
  className,
}: {
  value: string | number;
  unit?: string;
  className?: string;
}) {
  return (
    <span className={cn("tabular-nums whitespace-nowrap", className)}>
      {formatQuantity(value)}{unit ? ` ${unit.toLowerCase()}` : ""}
    </span>
  );
}

export const Money = MoneyDisplay;
export const Quantity = QuantityDisplay;

export function Percentage({
  value,
  fractionDigits = 1,
  className,
}: {
  value: string | number;
  fractionDigits?: number;
  className?: string;
}) {
  return <span className={cn("tabular-nums whitespace-nowrap", className)}>{formatPercentage(value, fractionDigits)}</span>;
}

export function DateTime({
  value,
  className,
}: {
  value: string | number | Date;
  className?: string;
}) {
  const date = value instanceof Date ? value : new Date(value);
  return <time dateTime={Number.isNaN(date.getTime()) ? undefined : date.toISOString()} className={className}>{formatDateTime(value)}</time>;
}
