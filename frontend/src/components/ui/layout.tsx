import type { HTMLAttributes, ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function FilterBar({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <Card
      className={cn("p-3 sm:p-4", className)}
      {...props}
    />
  );
}

export function TableFrame({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <Card
      className={cn("hidden overflow-hidden md:block [&_table]:data-table", className)}
      {...props}
    />
  );
}

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div>
          <h2 className="font-bold tracking-[-0.01em]">{title}</h2>
          {description ? <p className="mt-0.5 text-sm text-text-muted">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      {children}
    </Card>
  );
}

export function MobileDataCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <Card className={cn("p-4 transition-colors hover:border-border-strong", className)}>{children}</Card>;
}
