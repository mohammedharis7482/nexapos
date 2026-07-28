import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { UnexpectedError } from "@/components/ui/unexpected-error";

describe("UnexpectedError", () => {
  it("shows a production-safe recovery action", () => {
    const retry = vi.fn();
    render(<UnexpectedError retry={retry} />);

    expect(
      screen.getByRole("heading", { name: "This screen could not be displayed" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/stack|digest/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
