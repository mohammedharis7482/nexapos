import type { HTMLAttributes, ReactNode } from "react";

import { Button } from "@/components/ui/button";
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

export function FilterToolbar({
  children,
  result,
  status,
  className,
}: {
  children: ReactNode;
  result?: ReactNode;
  status?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("overflow-hidden", className)} data-slot="filter-toolbar">
      <div className="p-3 sm:p-4">{children}</div>
      {result || status ? (
        <div className="flex min-h-11 flex-wrap items-center justify-between gap-2 border-t border-border bg-surface-subtle px-4 py-2.5">
          <div className="text-sm text-foreground-muted">{result}</div>
          {status ? <div>{status}</div> : null}
        </div>
      ) : null}
    </Card>
  );
}

export function Pagination({
  count,
  noun,
  page,
  hasNext,
  onPrevious,
  onNext,
  className,
}: {
  count: number;
  noun: string;
  page: number;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between", className)} aria-label={`${noun} pagination`}>
      <p className="text-sm text-foreground-muted"><span className="font-semibold tabular-nums text-foreground">{count}</span> {count === 1 ? noun : `${noun}s`} · Page {page}</p>
      <div className="grid grid-cols-2 gap-2 sm:flex">
        <Button variant="secondary" disabled={page === 1} onClick={onPrevious}>Previous</Button>
        <Button variant="secondary" disabled={!hasNext} onClick={onNext}>Next</Button>
      </div>
    </div>
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

export function AppPage({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mx-auto flex w-full max-w-[var(--content-max)] flex-col gap-6", className)} {...props} />;
}

export function PageContainer({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mx-auto w-full max-w-[var(--content-max)]", className)} {...props} />;
}

export function WidePageContainer({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mx-auto w-full max-w-[var(--content-wide)]", className)} {...props} />;
}

export function FocusedWorkspace({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mx-auto min-h-[calc(100dvh-var(--header-height)-2rem)] w-full max-w-[var(--content-wide)]", className)} {...props} />;
}

export function Section({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cn("space-y-4", className)} {...props} />;
}

export function ResponsiveGrid({
  min = "240px",
  className,
  style,
  ...props
}: HTMLAttributes<HTMLDivElement> & { min?: string }) {
  return (
    <div
      className={cn("grid gap-4", className)}
      style={{ gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${min}), 1fr))`, ...style }}
      {...props}
    />
  );
}

export function SplitPane({
  primary,
  secondary,
  className,
}: {
  primary: ReactNode;
  secondary: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.42fr)]", className)}>
      <div className="min-w-0">{primary}</div>
      <aside className="min-w-0 lg:sticky lg:top-[calc(var(--header-height)+1rem)]">{secondary}</aside>
    </div>
  );
}

export function StickyActionBar({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "sticky bottom-[calc(var(--mobile-nav-height)+env(safe-area-inset-bottom))] z-10 flex flex-wrap items-center justify-end gap-2 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur-sm lg:bottom-0",
        className,
      )}
      {...props}
    />
  );
}
