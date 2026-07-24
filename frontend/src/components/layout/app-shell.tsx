"use client";

import {
  CalendarDays,
  ChevronDown,
  KeyRound,
  LogOut,
  MoreHorizontal,
  ShoppingCart,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";

import { ChangePasswordDialog } from "@/components/auth/change-password-dialog";
import { Button } from "@/components/ui/button";
import { Avatar, Badge, StatusBadge } from "@/components/ui/display";
import { DropdownMenu, Sheet } from "@/components/ui/overlay";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

import { getNavigationForRole, navigationItems } from "./navigation";

function subscribeToNetwork(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/dashboard" className="flex min-h-10 items-center gap-2.5 rounded-xl">
      <span className="grid size-9 place-items-center rounded-[10px] bg-primary text-white shadow-sm">
        <ShoppingCart className="size-[1.1rem]" aria-hidden="true" />
      </span>
      {!compact ? (
        <span>
          <span className="block text-[15px] font-extrabold tracking-[-0.025em]">NexaPOS</span>
          <span className="block text-[10px] font-medium text-text-muted">Grocery operations</span>
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
        "relative flex min-h-10 items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13px] font-semibold transition-colors",
        active
          ? "bg-primary-soft text-primary before:absolute before:inset-y-2.5 before:left-0 before:w-[3px] before:rounded-full before:bg-primary"
          : "text-text-secondary hover:bg-surface-secondary hover:text-text-primary",
        item.prominent && !active && "border border-blue-200 bg-primary-soft/60 text-primary",
      )}
    >
      <Icon className="size-[1.1rem] shrink-0" aria-hidden="true" />
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
  const [now, setNow] = useState(() => new Date());
  const networkOnline = useSyncExternalStore(
    subscribeToNetwork,
    () => window.navigator.onLine,
    () => true,
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const items = useMemo(
    () => (user ? getNavigationForRole(user.role) : []),
    [user],
  );
  if (!user) return null;

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
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[var(--sidebar-width)] border-r border-border bg-surface px-3 py-4 lg:flex lg:flex-col">
        <Brand />
        <p className="mb-2 mt-7 px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">Workspace</p>
        <nav className="flex flex-1 flex-col gap-1" aria-label="Primary navigation">
          {items.map((item) => (
            <NavigationLink
              key={item.href}
              item={item}
              active={pathname.startsWith(item.href)}
            />
          ))}
        </nav>
        <div className="border-t border-border pt-3">
          <div className="flex items-center gap-2.5 rounded-xl p-2 hover:bg-surface-secondary">
            <Avatar name={user.full_name} className="size-9 rounded-[10px] text-xs" />
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">{user.full_name}</p>
              <p className="truncate text-[10px] text-text-muted">{user.role === "OWNER" ? "Owner" : "Cashier"} · {user.shop.name}</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="min-h-screen lg:pl-[var(--sidebar-width)]">
        <header className="sticky top-0 z-20 flex min-h-[var(--header-height)] items-center justify-between border-b border-border bg-surface/95 px-4 backdrop-blur-sm sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="lg:hidden">
              <Brand compact />
            </div>
            <div className="min-w-0">
              <p className="hidden text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted sm:block">Active shop</p>
              <p className="truncate text-sm font-bold">{user.shop.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-2 text-xs text-text-muted md:flex">
              <StatusBadge label={networkOnline ? "Network online" : "Network offline"} online={networkOnline} />
              <span className="mx-1 h-4 w-px bg-border" />
              <CalendarDays className="size-4" aria-hidden="true" />
              <time dateTime={now.toISOString()}>
                {new Intl.DateTimeFormat("en-QA", { dateStyle: "medium", timeStyle: "short" }).format(now)}
              </time>
            </div>
            <DropdownMenu
            trigger={
              <span className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-1.5 hover:bg-surface-secondary">
                <Avatar name={user.full_name} className="size-9 rounded-[10px] text-xs" />
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
          </div>
        </header>

        <main className="mx-auto w-full max-w-[var(--content-max)] p-[var(--content-padding)] pb-[calc(var(--mobile-nav-height)+env(safe-area-inset-bottom)+1.5rem)] sm:pb-28 lg:pb-8">
          {children}
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/98 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 shadow-[0_-6px_20px_rgb(16_42_86_/_0.06)] lg:hidden"
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
                  active ? "bg-primary-soft text-primary" : "text-text-muted",
                )}
              >
                <Icon className="size-5" />
                {item.shortLabel ?? item.label}
              </Link>
            );
          })}
          <button
            aria-label="Open more navigation"
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
