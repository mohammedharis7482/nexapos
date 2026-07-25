import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border border-border bg-surface shadow-[var(--shadow-card)]",
        className,
      )}
      {...props}
    />
  );
}

export function SurfaceCard({
  padding = "md",
  interactive = false,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  padding?: "none" | "sm" | "md" | "lg";
  interactive?: boolean;
}) {
  return (
    <Card
      className={cn(
        padding === "sm" && "p-4",
        padding === "md" && "p-5",
        padding === "lg" && "p-6",
        interactive && "transition-colors hover:border-border-strong hover:bg-surface-hover",
        className,
      )}
      {...props}
    />
  );
}

export function ActionCard({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <SurfaceCard className={cn("flex items-start gap-4", className)}>
      {icon ? <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">{icon}</span> : null}
      <div className="min-w-0 flex-1">
        <h3 className="type-section-title">{title}</h3>
        <p className="mt-1 type-body-sm text-foreground-muted">{description}</p>
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </SurfaceCard>
  );
}

export function SummaryCard({
  label,
  value,
  footer,
  className,
}: {
  label: string;
  value: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <SurfaceCard className={className}>
      <p className="type-body-sm font-semibold text-foreground-muted">{label}</p>
      <div className="mt-2 type-numeric text-2xl font-bold tracking-tight">{value}</div>
      {footer ? <div className="mt-3 border-t border-border-subtle pt-3 type-body-sm text-foreground-muted">{footer}</div> : null}
    </SurfaceCard>
  );
}

export function ListCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <Card className={cn("divide-y divide-border-subtle overflow-hidden", className)} {...props} />;
}

export const ChartCard = SurfaceCard;
export const AlertCard = SurfaceCard;
