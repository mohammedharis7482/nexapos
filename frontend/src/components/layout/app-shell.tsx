"use client";

import {
  ChevronDown,
  CircleUserRound,
  KeyRound,
  LogOut,
  MoreHorizontal,
  ShoppingCart,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";

import { ChangePasswordDialog } from "@/components/auth/change-password-dialog";
import { Button } from "@/components/ui/button";
import { Avatar, Badge, StatusBadge } from "@/components/ui/display";
import { DropdownMenu, Sheet } from "@/components/ui/overlay";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

import { getNavigationForRole, navigationItems } from "./navigation";

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/dashboard" className="flex min-h-11 items-center gap-3 rounded-xl">
      <span className="grid size-10 place-items-center rounded-xl bg-primary text-white">
        <ShoppingCart className="size-5" aria-hidden="true" />
      </span>
      {!compact ? (
        <span>
          <span className="block text-base font-extrabold tracking-tight">NexaPOS</span>
          <span className="block text-xs text-text-muted">Retail operations</span>
        </span>
      ) : null}
    </Link>
  );
}

function NavigationLink({
  item,
  active,
  onNavigate,
}: {
  item: (typeof navigationItems)[number];
  active: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
        active
          ? "bg-primary-soft text-primary"
          : "text-text-secondary hover:bg-surface-secondary hover:text-text-primary",
        item.prominent && !active && "border border-blue-200 bg-primary-soft/60 text-primary",
      )}
    >
      <Icon className="size-5 shrink-0" aria-hidden="true" />
      {item.label}
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, isLoggingOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  const items = useMemo(
    () => (user ? getNavigationForRole(user.role) : []),
    [user],
  );
  if (!user) return null;

  const current =
    navigationItems.find((item) => pathname.startsWith(item.href))?.label ??
    "NexaPOS";
  const mobilePrimary = items.filter((item) =>
    ["/dashboard", "/billing", "/products", "/sales"].includes(item.href),
  );
  const moreItems = items.filter(
    (item) => !mobilePrimary.some((primary) => primary.href === item.href),
  );

  async function handleLogout() {
    try {
      await logout();
    } finally {
      router.replace("/login");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-border bg-surface p-4 lg:flex lg:flex-col md:landscape:flex">
        <Brand />
        <nav className="mt-8 flex flex-1 flex-col gap-1" aria-label="Primary navigation">
          {items.map((item) => (
            <NavigationLink
              key={item.href}
              item={item}
              active={pathname.startsWith(item.href)}
            />
          ))}
        </nav>
        <div className="border-t border-border pt-4">
          <div className="flex items-center gap-3">
            <Avatar name={user.full_name} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user.full_name}</p>
              <p className="text-xs text-text-muted">{user.role === "OWNER" ? "Owner" : "Cashier"}</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="min-h-screen lg:pl-60 md:landscape:pl-60">
        <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between border-b border-border bg-surface/95 px-4 backdrop-blur-sm sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="lg:hidden md:landscape:hidden">
              <Brand compact />
            </div>
            <div className="min-w-0">
              <p className="hidden text-xs text-text-muted sm:block">{user.shop.name}</p>
              <h1 className="truncate text-base font-bold">{current}</h1>
            </div>
            <StatusBadge label="Online" />
          </div>

          <DropdownMenu
            trigger={
              <span className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-1.5 hover:bg-surface-secondary">
                <Avatar name={user.full_name} />
                <span className="hidden text-left sm:block">
                  <span className="block max-w-36 truncate text-sm font-semibold">
                    {user.full_name}
                  </span>
                  <span className="block text-xs text-text-muted">
                    {user.role === "OWNER" ? "Owner" : "Cashier"}
                  </span>
                </span>
                <ChevronDown className="hidden size-4 text-text-muted sm:block" />
              </span>
            }
          >
            <div className="border-b border-border px-3 py-2">
              <p className="font-semibold">{user.full_name}</p>
              <p className="mt-0.5 text-xs text-text-muted">{user.shop.name}</p>
              <Badge tone="primary" className="mt-2">
                {user.role === "OWNER" ? "Owner" : "Cashier"}
              </Badge>
            </div>
            <button className="mt-1 flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm text-text-secondary hover:bg-surface-secondary">
              <CircleUserRound className="size-5" /> Profile
            </button>
            <button
              onClick={() => setPasswordOpen(true)}
              className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm text-text-secondary hover:bg-surface-secondary"
            >
              <KeyRound className="size-5" /> Change password
            </button>
            <button
              onClick={() => void handleLogout()}
              disabled={isLoggingOut}
              className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-danger hover:bg-danger-soft disabled:opacity-50"
            >
              <LogOut className="size-5" /> {isLoggingOut ? "Logging out…" : "Logout"}
            </button>
          </DropdownMenu>
        </header>

        <main className="mx-auto w-full max-w-[1440px] p-4 pb-28 sm:p-6 sm:pb-28 lg:p-8 lg:pb-8">
          {children}
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 lg:hidden md:landscape:hidden"
        aria-label="Mobile navigation"
      >
        <div className="grid grid-cols-5">
          {mobilePrimary.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold",
                  active ? "text-primary" : "text-text-muted",
                )}
              >
                <Icon className="size-5" />
                {item.shortLabel ?? item.label}
              </Link>
            );
          })}
          <button
            onClick={() => setMobileOpen(true)}
            className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold text-text-muted"
          >
            <MoreHorizontal className="size-5" />
            More
          </button>
        </div>
      </nav>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen} title="More">
        <div className="space-y-1">
          {moreItems.map((item) => (
            <NavigationLink
              key={item.href}
              item={item}
              active={pathname.startsWith(item.href)}
              onNavigate={() => setMobileOpen(false)}
            />
          ))}
          <button className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-text-secondary hover:bg-surface-secondary">
            <CircleUserRound className="size-5" /> Profile
          </button>
          <button
            onClick={() => {
              setMobileOpen(false);
              setPasswordOpen(true);
            }}
            className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-text-secondary hover:bg-surface-secondary"
          >
            <KeyRound className="size-5" /> Change password
          </button>
          <Button
            variant="danger"
            className="mt-4 w-full"
            loading={isLoggingOut}
            leadingIcon={<LogOut className="size-5" />}
            onClick={() => void handleLogout()}
          >
            Logout
          </Button>
        </div>
      </Sheet>
      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </div>
  );
}
