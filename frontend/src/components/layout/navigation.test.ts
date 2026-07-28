import { describe, expect, it } from "vitest";

import { getNavigationForRole } from "./navigation";

describe("role-aware navigation", () => {
  it("shows owner navigation", () => {
    const labels = getNavigationForRole("OWNER").map((item) => item.label);
    expect(labels).toContain("Inventory");
    expect(labels).toContain("Reports");
    expect(labels).toContain("Team");
    expect(labels).toContain("Settings");
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
});
