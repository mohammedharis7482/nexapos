import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import type {
  HTMLAttributes,
  ReactNode,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";

import { Card } from "@/components/ui/card";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { cn } from "@/lib/utils";

export function DataTable({
  className,
  ...props
}: TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cn("premium-table", className)} {...props} />;
}

export function DataTableHeader(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead {...props} />;
}

export function DataTableBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />;
}

export function DataTableRow({
  interactive = false,
  className,
  ...props
}: HTMLAttributes<HTMLTableRowElement> & { interactive?: boolean }) {
  return <tr className={cn(interactive && "cursor-pointer focus-within:bg-surface-hover", className)} {...props} />;
}

export function DataTableCell({
  align = "left",
  numeric = false,
  className,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & {
  align?: "left" | "center" | "right";
  numeric?: boolean;
}) {
  return (
    <td
      className={cn(
        align === "center" && "text-center",
        align === "right" && "text-right",
        numeric && "tabular-nums whitespace-nowrap",
        className,
      )}
      {...props}
    />
  );
}

export function DataTableHeading({
  align = "left",
  className,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "center" | "right" }) {
  return <th scope="col" className={cn(align === "center" && "text-center", align === "right" && "text-right", className)} {...props} />;
}

export function SortableHeader({
  children,
  direction,
  onSort,
}: {
  children: ReactNode;
  direction?: "ascending" | "descending";
  onSort: () => void;
}) {
  const Icon = direction === "ascending" ? ArrowUp : direction === "descending" ? ArrowDown : ChevronsUpDown;
  return (
    <button type="button" onClick={onSort} className="inline-flex min-h-9 items-center gap-1.5 rounded-md hover:text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]">
      {children}<Icon className="size-3.5" aria-hidden="true" />
    </button>
  );
}

export function TableEmptyState({
  title,
  description,
  colSpan,
}: {
  title: string;
  description: string;
  colSpan: number;
}) {
  return <tr><td colSpan={colSpan} className="p-4"><EmptyState title={title} description={description} compact /></td></tr>;
}

export function TableSkeleton({ columns = 5, rows = 4 }: { columns?: number; rows?: number }) {
  return (
    <div aria-label="Loading table" className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface">
      <div className="grid h-11 items-center gap-4 border-b border-border bg-surface-subtle px-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {Array.from({ length: columns }, (_, index) => <Skeleton key={index} className="h-3 w-16" />)}
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="grid h-14 items-center gap-4 border-b border-border-subtle px-4 last:border-b-0" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }, (_, column) => <Skeleton key={column} className="h-4 w-3/4" />)}
        </div>
      ))}
    </div>
  );
}

export function ResponsiveDataList({
  table,
  cards,
  breakpoint = "md",
}: {
  table: ReactNode;
  cards: ReactNode;
  breakpoint?: "sm" | "md" | "lg";
}) {
  const visibility = {
    sm: { table: "hidden sm:block", cards: "sm:hidden" },
    md: { table: "hidden md:block", cards: "md:hidden" },
    lg: { table: "hidden lg:block", cards: "lg:hidden" },
  }[breakpoint];
  return (
    <>
      <Card className={cn("overflow-hidden", visibility.table)}>{table}</Card>
      <div className={cn("space-y-3", visibility.cards)}>{cards}</div>
    </>
  );
}
