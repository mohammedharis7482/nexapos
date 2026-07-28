import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Button, IconButton } from "@/components/ui/button";
import { EmptyState, Toast } from "@/components/ui/feedback";
import { Dialog, DropdownMenu, ConfirmDialog } from "@/components/ui/overlay";

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

  it("prevents a critical dialog from being cancelled while busy", () => {
    const onOpenChange = vi.fn();
    render(<Dialog open dismissible={false} onOpenChange={onOpenChange} title="Completing payment">Processing</Dialog>);
    const dialog = screen.getByRole("dialog", { name: "Completing payment" });
    const event = new Event("cancel", { cancelable: true });
    fireEvent(dialog, event);
    expect(event.defaultPrevented).toBe(true);
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Close dialog" })).toBeDisabled();
  });

  it("closes a dropdown with Escape and returns focus to its trigger", () => {
    render(
      <DropdownMenu label="Actions" trigger={<span>Open actions</span>}>
        <button type="button">Edit</button>
        <button type="button">Deactivate</button>
      </DropdownMenu>,
    );
    const trigger = screen.getByLabelText("Actions");
    const details = trigger.closest("details")!;
    details.setAttribute("open", "");
    fireEvent.keyDown(details, { key: "Escape" });
    expect(details).not.toHaveAttribute("open");
    expect(trigger).toHaveFocus();
  });

  it("announces and dismisses actionable toast feedback", () => {
    const close = vi.fn();
    render(<Toast title="Product saved" description="Catalogue details were updated." tone="success" onClose={close} />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    fireEvent.click(screen.getByRole("button", { name: "Dismiss notification" }));
    expect(close).toHaveBeenCalledOnce();
  });

  it("supports a relevant empty-state action", () => {
    render(<EmptyState title="No products" description="Add the first product." action={<Button>Add product</Button>} />);
    expect(screen.getByRole("button", { name: "Add product" })).toBeInTheDocument();
  });
});
