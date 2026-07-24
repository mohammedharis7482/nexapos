import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Button, IconButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { ConfirmDialog, Dialog } from "@/components/ui/overlay";

describe("shared UI foundation", () => {
  it("exposes disabled and loading button state accessibly", () => {
    render(<><Button disabled>Save</Button><Button loading>Loading</Button></>);
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Loading" })).toHaveAttribute("aria-busy", "true");
  });

  it("requires an accessible name for icon-only controls", () => {
    render(<IconButton aria-label="Edit product">✎</IconButton>);
    expect(screen.getByRole("button", { name: "Edit product" })).toBeInTheDocument();
  });

  it("associates dialog headings and supports Escape cancellation", () => {
    const onOpenChange = vi.fn();
    render(<Dialog open onOpenChange={onOpenChange} title="Edit product" description="Update catalogue details.">Content</Dialog>);
    const dialog = screen.getByRole("dialog", { name: "Edit product" });
    expect(dialog).toHaveAttribute("aria-describedby");
    fireEvent(dialog, new Event("cancel"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("keeps the safe confirmation action first and confirms explicitly", () => {
    const confirm = vi.fn();
    render(<ConfirmDialog open onOpenChange={vi.fn()} title="Cancel draft?" description="The audit record is retained." confirmLabel="Cancel draft" onConfirm={confirm} />);
    expect(screen.getByRole("button", { name: "Keep working" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel draft" }));
    expect(confirm).toHaveBeenCalledOnce();
  });

  it("supports a relevant empty-state action", () => {
    render(<EmptyState title="No products" description="Add the first product." action={<Button>Add product</Button>} />);
    expect(screen.getByRole("button", { name: "Add product" })).toBeInTheDocument();
  });
});
