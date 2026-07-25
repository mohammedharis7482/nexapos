import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { isDesignSystemShowcaseEnabled } from "./guard";
import { DesignSystemShowcase } from "./showcase";

describe("design-system showcase", () => {
  it("is limited to development and test environments", () => {
    expect(isDesignSystemShowcaseEnabled("development")).toBe(true);
    expect(isDesignSystemShowcaseEnabled("test")).toBe(true);
    expect(isDesignSystemShowcaseEnabled("production")).toBe(false);
  });

  it("renders all major foundation sections", () => {
    render(<DesignSystemShowcase />);
    expect(screen.getByRole("heading", { name: "NexaPOS Design System V2" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Buttons and interaction" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Form controls" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Responsive data presentation" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Feedback and states" })).toBeInTheDocument();
  });
});
