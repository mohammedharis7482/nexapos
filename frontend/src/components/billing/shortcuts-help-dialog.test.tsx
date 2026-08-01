import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ShortcutBinding } from "@/hooks/use-shortcuts";

import { ShortcutsHelpDialog } from "./shortcuts-help-dialog";

const bindings: ShortcutBinding[] = [
  { key: "/", description: "Focus barcode / product search", handler: vi.fn() },
  { key: "F9", description: "Continue to payment", handler: vi.fn() },
];

describe("ShortcutsHelpDialog", () => {
  it("lists every binding's key and description when open", () => {
    render(<ShortcutsHelpDialog open onOpenChange={vi.fn()} bindings={bindings} />);
    expect(screen.getByText("Focus barcode / product search")).toBeInTheDocument();
    expect(screen.getByText("/")).toBeInTheDocument();
    expect(screen.getByText("Continue to payment")).toBeInTheDocument();
    expect(screen.getByText("F9")).toBeInTheDocument();
  });

  it("does not present as an open dialog when closed", () => {
    const { container } = render(<ShortcutsHelpDialog open={false} onOpenChange={vi.fn()} bindings={bindings} />);
    expect(container.querySelector("dialog[open]")).not.toBeInTheDocument();
  });
});
