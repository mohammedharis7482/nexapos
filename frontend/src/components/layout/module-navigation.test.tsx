import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/settings/data",
}));

import { ModuleNavigation, salesNavigation, settingsNavigation } from "./module-navigation";

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

  it("hugs its tab content instead of stretching to fill the row", () => {
    const { container: settingsContainer } = render(
      <ModuleNavigation label="Settings sections" items={settingsNavigation} />,
    );
    const settingsPill = settingsContainer.querySelector("nav > div");
    // Regression guard: a plain `flex` block-level wrapper defaults to
    // filling its parent's width, which is what produced the oversized
    // white rectangle. inline-flex is required so the pill shrink-wraps to
    // its tabs; neither a block-filling `flex` nor a forced `w-full` may
    // return.
    expect(settingsPill?.className).toContain("inline-flex");
    expect(settingsPill?.className).not.toMatch(/(?:^|\s)flex(?:\s|$)/);
    expect(settingsPill?.className).not.toContain("w-full");

    const { container: salesContainer } = render(
      <ModuleNavigation label="Sales sections" items={salesNavigation} />,
    );
    const salesPill = salesContainer.querySelector("nav > div");
    expect(salesPill?.className).toContain("inline-flex");
    expect(salesPill?.className).not.toContain("w-full");
  });
});
