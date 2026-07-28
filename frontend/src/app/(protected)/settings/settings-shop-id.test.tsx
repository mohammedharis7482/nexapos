import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SettingsPage from "./page";

const getSettings = vi.fn();

vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({ user: { role: "OWNER" } }),
}));

vi.mock("@/services/shop.service", () => ({
  shopService: {
    getSettings: (...args: unknown[]) => getSettings(...args),
    updateSettings: vi.fn(),
  },
}));

describe("Shop Settings identifier", () => {
  beforeEach(() => {
    getSettings.mockReset();
    getSettings.mockResolvedValue({
      success: true,
      message: "Shop settings retrieved.",
      data: {
        id: "02dccdd7-8182-4554-b1db-60bcaa610002",
        name: "Test Grocery",
        legal_name: "",
        phone: "+97450000000",
        email: "owner@example.test",
        address: "Doha",
        city: "",
        country: "Qatar",
        currency: "QAR",
        timezone: "Asia/Qatar",
        tax_registration_number: "",
        default_tax_rate: "0.00",
        receipt_footer: "",
        logo: null,
        is_active: true,
      },
    });
  });

  it("shows the immutable Shop ID and copy action", async () => {
    render(<SettingsPage />);

    expect(await screen.findByText("02dccdd7-8182-4554-b1db-60bcaa610002")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy Shop ID" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Shop ID" })).not.toBeInTheDocument();
  });
});
