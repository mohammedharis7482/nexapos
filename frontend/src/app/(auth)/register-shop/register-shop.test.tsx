import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import RegisterShopPage from "./page";

const register = vi.fn();
vi.mock("@/services/saas.service", () => ({
  saasService: { register: (...args: unknown[]) => register(...args) },
}));

describe("shop registration", () => {
  beforeEach(() => {
    register.mockReset();
    register.mockResolvedValue({ message: "Check your email." });
  });

  it("collects owner and shop data without a client-controlled role or plan", async () => {
    render(<RegisterShopPage />);
    expect(screen.getByRole("heading", { name: "Register your grocery shop" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/role/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/plan/i)).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Shop name"), "Test Grocery");
    await user.type(screen.getByLabelText("Owner full name"), "Test Owner");
    await user.type(screen.getByLabelText("Owner email"), "owner@example.test");
    await user.type(screen.getByLabelText("Owner username"), "owner");
    await user.type(screen.getByLabelText("Password"), "StrongPassword123!");
    await user.type(screen.getByLabelText("Confirm password"), "StrongPassword123!");
    await user.type(screen.getByLabelText("Shop address"), "Doha");
    await user.type(screen.getByLabelText("Phone"), "+97450000000");
    await user.click(screen.getByRole("button", { name: "Create shop" }));

    await waitFor(() => expect(register).toHaveBeenCalledOnce());
    expect(register.mock.calls[0][0]).toMatchObject({
      country: "Qatar",
      currency: "QAR",
      timezone: "Asia/Qatar",
    });
    expect(await screen.findByText("Check your email.")).toBeInTheDocument();
  });
});
