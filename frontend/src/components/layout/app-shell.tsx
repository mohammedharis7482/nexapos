"use client";

import {
  CalendarDays,
  ChevronDown,
  Clock3,
  KeyRound,
  LogOut,
  MoreHorizontal,
  Settings,
  ShoppingCart,
  Users,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Avatar, Badge, StatusBadge } from "@/components/ui/display";
import { DropdownMenu, Sheet } from "@/components/ui/overlay";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

import { getNavigationForRole, isNavigationItemActive, navigationItems } from "./navigation";

// Pulls in react-hook-form/zod/resolvers, only needed for the rarely-opened
// "change password" action - loaded on demand instead of shipping in every
// protected page's initial bundle (AppShell wraps the whole app).
const ChangePasswordDialog = dynamic(
  () => import("@/components/auth/change-password-dialog").then((mod) => mod.ChangePasswordDialog),
  { ssr: false },
);

function subscribeToNetwork(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

export function NexaPOSBrand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/dashboard" className="flex min-h-11 items-center gap-2.5 rounded-[var(--radius-lg)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]">
      <span className="grid size-9 place-items-center rounded-[var(--radius-md)] bg-primary text-white shadow-[var(--shadow-xs)]">
        <ShoppingCart className="size-[1.1rem]" aria-hidden="true" />
      </span>
      {!compact ? (
        <span>
          <span className="block text-[15px] font-bold tracking-[-0.025em]">NexaPOS</span>
          <span className="block text-[11px] font-medium text-foreground-muted">Grocery operations</span>
        </span>
      ) : null}
    </Link>
  );
}

export function NavItem({
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
        "relative flex min-h-[var(--navigation-item-height)] items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]",
        active
          ? "bg-surface-active text-primary before:absolute before:inset-y-2.5 before:left-0 before:w-[3px] before:rounded-full before:bg-primary"
          : "text-foreground-secondary hover:bg-surface-hover hover:text-foreground",
        item.prominent && !active && "border border-brand-200 bg-primary-soft/60 text-primary",
      )}
    >
      <Icon className="size-[1.1rem] shrink-0" aria-hidden="true" />
      {item.label}
    </Link>
  );
}

export function NavSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 px-3 type-eyebrow text-foreground-muted">{label}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

export function MobileNavItem({
  item,
  active,
}: {
  item: (typeof navigationItems)[number];
  active: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-[var(--radius-md)] text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]",
        active ? "bg-primary-soft text-primary after:absolute after:bottom-1 after:h-0.5 after:w-5 after:rounded-full after:bg-primary" : "text-foreground-muted",
      )}
    >
      <Icon className="size-5" aria-hidden="true" />
      {item.shortLabel ?? item.label}
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, isLoggingOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
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

  const mobileHrefs = user.role === "OWNER"
    ? ["/dashboard", "/billing", "/products", "/inventory"]
    : ["/dashboard", "/billing", "/products", "/sales"];
  const mobilePrimary = items.filter((item) => mobileHrefs.includes(item.href));
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
      <aside data-testid="desktop-sidebar" className="fixed inset-y-0 left-0 z-30 hidden w-[var(--sidebar-width)] border-r border-border bg-surface px-3 py-4 lg:flex lg:flex-col">
        <NexaPOSBrand />
        <nav className="mt-7 flex flex-1 flex-col" aria-label="Primary navigation">
          <NavSection label="Workspace">
            {items.map((item) => (
            <NavItem
              key={item.href}
              item={item}
              active={isNavigationItemActive(pathname, item.href)}
            />
          ))}
          </NavSection>
        </nav>
        <div className="border-t border-border pt-3">
          <button type="button" aria-label="Open account menu" onClick={() => setAccountOpen(true)} className="flex min-h-11 w-full items-center gap-2.5 rounded-[var(--radius-lg)] p-2 text-left hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]">
            <Avatar name={user.full_name} className="size-9 rounded-[10px] text-xs" />
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">{user.full_name}</p>
              <p className="truncate text-[10px] text-text-muted">{user.role === "OWNER" ? "Owner" : "Cashier"} · {user.shop.name}</p>
            </div>
            <ChevronDown className="ml-auto size-3.5 shrink-0 text-foreground-muted" aria-hidden="true" />
          </button>
        </div>
      </aside>

      <div className="min-h-screen lg:pl-[var(--sidebar-width)]">
        <header className="sticky top-0 z-20 flex min-h-[var(--header-height)] items-center justify-between border-b border-border bg-surface/95 px-4 backdrop-blur-sm sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="lg:hidden">
              <NexaPOSBrand compact />
            </div>
            <div className="min-w-0">
              <p className="hidden text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted sm:block">Active shop</p>
              <p className="truncate text-sm font-bold">{user.shop.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-2 text-xs text-text-muted md:flex">
              <StatusBadge label={networkOnline ? "Device online" : "Device offline"} online={networkOnline} />
              <span className="mx-1 h-4 w-px bg-border" />
              <CalendarDays className="size-4" aria-hidden="true" />
              <time dateTime={now.toISOString()}>
                {new Intl.DateTimeFormat("en-QA", { dateStyle: "medium", timeStyle: "short" }).format(now)}
              </time>
            </div>
            <DropdownMenu
            label="Open user menu"
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
            <Link
              href="/account"
              role="menuitem"
              className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm text-text-secondary hover:bg-surface-secondary"
            >
              Account settings
            </Link>
            <Link
              href="/sales/shifts/current"
              role="menuitem"
              className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm text-text-secondary hover:bg-surface-secondary"
            >
              <Clock3 className="size-5" /> Current Shift
            </Link>
            {user.role === "OWNER" ? (
              <>
                <Link href="/settings/team" role="menuitem" className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm text-text-secondary hover:bg-surface-secondary">
                  <Users className="size-5" /> Team &amp; Access
                </Link>
                <Link href="/settings" role="menuitem" className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm text-text-secondary hover:bg-surface-secondary">
                  <Settings className="size-5" /> Settings
                </Link>
              </>
            ) : null}
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
        data-testid="mobile-navigation"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/98 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 shadow-[0_-4px_16px_rgb(15_23_42_/_0.05)] lg:hidden"
        aria-label="Mobile navigation"
      >
        <div className="grid grid-cols-5">
          {mobilePrimary.map((item) => {
            const active = isNavigationItemActive(pathname, item.href);
            return (
              <MobileNavItem key={item.href} item={item} active={active} />
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
            <NavItem
              key={item.href}
              item={item}
              active={isNavigationItemActive(pathname, item.href)}
              onNavigate={() => setMobileOpen(false)}
            />
          ))}
          <NavItem
            item={{ label: "Current Shift", href: "/sales/shifts/current", icon: Clock3, roles: ["OWNER", "CASHIER"] }}
            active={pathname === "/sales/shifts/current"}
            onNavigate={() => setMobileOpen(false)}
          />
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
      <Sheet open={accountOpen} onOpenChange={setAccountOpen} title="Account">
        <div className="mb-5 flex items-center gap-3 rounded-[var(--radius-lg)] bg-surface-subtle p-3">
          <Avatar name={user.full_name} />
          <div className="min-w-0"><p className="truncate font-semibold">{user.full_name}</p><p className="truncate text-sm text-foreground-muted">{user.role === "OWNER" ? "Owner" : "Cashier"} · {user.shop.name}</p></div>
        </div>
        <Button variant="secondary" className="w-full" leadingIcon={<KeyRound className="size-4" />} onClick={() => { setAccountOpen(false); setPasswordOpen(true); }}>Change password</Button>
        <Button variant="destructive" className="mt-3 w-full" loading={isLoggingOut} leadingIcon={<LogOut className="size-4" />} onClick={() => void handleLogout()}>Logout</Button>
      </Sheet>
      {passwordOpen ? (
        <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
      ) : null}
    </div>
  );
}
