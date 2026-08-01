import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/settings/data",
}));

import { ModuleNavigation, settingsNavigation } from "./module-navigation";

describe("ModuleNavigation", () => {
  it("gives the active tab a distinct style from an inactive tab's hover style", () => {
    render(<ModuleNavigation label="Settings sections" items={settingsNavigation} />);
    const active = screen.getByRole("link", { name: "Data Management" });
    const inactive = screen.getByRole("link", { name: "Team & Access" });
    expect(active.className).toContain("bg-surface");
    expect(active.className).toContain("text-primary");
    // Regression guard: the inactive-tab hover color must differ from the
    // segmented control's own resting background (surface-subtle), or the
    // hover state is visually imperceptible against its container.
    expect(inactive.className).toContain("hover:bg-surface-active");
    expect(inactive.className).not.toContain("hover:bg-surface-hover");
  });
});
