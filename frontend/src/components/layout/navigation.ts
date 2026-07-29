import {
  Boxes,
  FileBarChart,
  Home,
  PackageSearch,
  ReceiptText,
  Settings,
  ShoppingCart,
  Clock3,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { UserRole } from "@/types/auth";

export interface NavigationItem {
  label: string;
  shortLabel?: string;
  href: string;
  icon: LucideIcon;
  roles: UserRole[];
  prominent?: boolean;
}

export const navigationItems: NavigationItem[] = [
  { label: "Dashboard", shortLabel: "Home", href: "/dashboard", icon: Home, roles: ["OWNER", "CASHIER"] },
  { label: "New Bill", shortLabel: "Billing", href: "/billing", icon: ShoppingCart, roles: ["OWNER", "CASHIER"], prominent: true },
  { label: "Current Shift", shortLabel: "Shift", href: "/shift", icon: Clock3, roles: ["OWNER", "CASHIER"] },
  { label: "Shifts", href: "/shifts", icon: Clock3, roles: ["OWNER"] },
  { label: "Products", href: "/products", icon: PackageSearch, roles: ["OWNER", "CASHIER"] },
  { label: "Inventory", href: "/inventory", icon: Boxes, roles: ["OWNER"] },
  { label: "Sales", href: "/sales", icon: ReceiptText, roles: ["OWNER", "CASHIER"] },
  { label: "Reports", href: "/reports", icon: FileBarChart, roles: ["OWNER"] },
  { label: "Team", href: "/team", icon: Users, roles: ["OWNER"] },
  { label: "Settings", href: "/settings", icon: Settings, roles: ["OWNER"] },
];

export function getNavigationForRole(role: UserRole) {
  return navigationItems.filter((item) => item.roles.includes(role));
}
