"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface ModuleNavigationItem {
  href: string;
  label: string;
}

export function ModuleNavigation({ label, items }: { label: string; items: ModuleNavigationItem[] }) {
  const pathname = usePathname() ?? "";
  return (
    <nav aria-label={label} className="overflow-x-auto">
      <div className="flex min-w-max gap-1 rounded-[var(--radius-lg)] border border-border bg-surface-subtle p-1">
        {items.map((item) => {
          const active = pathname === item.href
            || (item.href !== "/sales" && pathname.startsWith(`${item.href}/`));
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-10 items-center rounded-[var(--radius-md)] px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]",
                active ? "bg-surface text-primary shadow-sm" : "text-foreground-secondary hover:bg-surface-active hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function Breadcrumbs({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav aria-label="Breadcrumb" className="min-w-0 overflow-hidden">
      <ol className="flex min-w-0 items-center gap-2 text-xs font-semibold text-foreground-muted">
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-2">
            {index ? <span aria-hidden="true">/</span> : null}
            {item.href ? <Link className="truncate hover:text-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]" href={item.href}>{item.label}</Link> : <span className="truncate text-foreground" aria-current="page">{item.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function ModulePage({ breadcrumbs, navigation, children }: { breadcrumbs: Array<{ label: string; href?: string }>; navigation: ReactNode; children: ReactNode }) {
  return <div className="page-stack"><Breadcrumbs items={breadcrumbs} />{navigation}{children}</div>;
}

export const salesNavigation: ModuleNavigationItem[] = [
  { href: "/sales", label: "Transactions" },
  { href: "/sales/shifts", label: "Shifts" },
];

export const settingsNavigation: ModuleNavigationItem[] = [
  { href: "/settings", label: "Shop Profile" },
  { href: "/settings/team", label: "Team & Access" },
  { href: "/settings/data", label: "Data Management" },
];
