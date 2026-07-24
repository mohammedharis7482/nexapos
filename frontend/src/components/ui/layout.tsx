import type { HTMLAttributes } from "react";

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
