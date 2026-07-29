import { describe, expect, it } from "vitest";

import { getNavigationForRole, isNavigationItemActive } from "./navigation";

describe("role-aware navigation", () => {
  it("shows owner navigation", () => {
    const labels = getNavigationForRole("OWNER").map((item) => item.label);
    expect(labels).toContain("Inventory");
    expect(labels).toContain("Reports");
    expect(labels).toContain("Settings");
    expect(labels).toEqual([
      "Dashboard",
      "New Bill",
      "Products",
      "Inventory",
      "Sales",
      "Reports",
      "Settings",
    ]);
    expect(labels).not.toContain("Current Shift");
    expect(labels).not.toContain("Shifts");
    expect(labels).not.toContain("Team");
  });

  it("hides owner-only navigation from cashiers", () => {
    const labels = getNavigationForRole("CASHIER").map((item) => item.label);
    expect(labels).toContain("New Bill");
    expect(labels).toContain("Sales");
    expect(labels).not.toContain("Inventory");
    expect(labels).not.toContain("Reports");
    expect(labels).not.toContain("Team");
    expect(labels).not.toContain("Settings");
  });

  it("keeps parent navigation active for canonical inner routes", () => {
    expect(isNavigationItemActive("/sales/shifts", "/sales")).toBe(true);
    expect(isNavigationItemActive("/sales/shifts/current", "/sales")).toBe(true);
    expect(isNavigationItemActive("/settings/team", "/settings")).toBe(true);
    expect(isNavigationItemActive("/products/import", "/products")).toBe(true);
    expect(isNavigationItemActive("/inventory", "/sales")).toBe(false);
  });
});
