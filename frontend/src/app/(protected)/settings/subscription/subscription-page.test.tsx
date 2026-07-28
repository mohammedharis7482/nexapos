import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SubscriptionPage from "./page";

const subscription = vi.fn();
const plans = vi.fn();
vi.mock("@/services/saas.service", () => ({
  saasService: {
    subscription: (...args: unknown[]) => subscription(...args),
    plans: (...args: unknown[]) => plans(...args),
  },
}));

describe("subscription foundation page", () => {
  beforeEach(() => {
    subscription.mockResolvedValue({
      data: {
        status: "TRIAL",
        trial_started_at: "2026-07-01T00:00:00Z",
        trial_ends_at: "2026-07-15T00:00:00Z",
        current_period_start: null,
        current_period_end: null,
        grace_period_ends_at: null,
        is_primary_owner: true,
        usage: { active_users: 1, max_users: 3, active_products: 10, max_products: 500 },
        plan: {
          code: "STARTER",
          name: "Starter",
          description: "Example plan",
          monthly_price: "0.00",
          yearly_price: "0.00",
          currency: "QAR",
          trial_days: 14,
          max_users: 3,
          max_products: 500,
          reports_enabled: true,
          advanced_reports_enabled: false,
        },
      },
    });
    plans.mockResolvedValue({ data: [] });
  });

  it("shows real usage and explicitly avoids fake payment collection", async () => {
    render(<SubscriptionPage />);
    expect(await screen.findByText("Starter")).toBeInTheDocument();
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    expect(screen.getByText("10 / 500")).toBeInTheDocument();
    expect(screen.getByText("Online subscription payment is not connected.")).toBeInTheDocument();
    expect(screen.queryByLabelText(/card number/i)).not.toBeInTheDocument();
  });
});
