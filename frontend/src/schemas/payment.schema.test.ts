import { describe, expect, it } from "vitest";

import {
  formatCents,
  moneyToCents,
  paymentFormSchema,
} from "./payment.schema";

describe("payment schema", () => {
  it("validates cash, card, and split input foundations", () => {
    expect(
      paymentFormSchema.safeParse({
        mode: "CASH",
        amount_received: "25.00",
        cash_amount: "0.00",
        card_amount: "0.00",
        card_reference: "",
      }).success,
    ).toBe(true);
    expect(
      paymentFormSchema.safeParse({
        mode: "SPLIT",
        amount_received: "10.00",
        cash_amount: "0.00",
        card_amount: "25.00",
        card_reference: "",
      }).success,
    ).toBe(false);
  });

  it("uses integer cents for frontend previews", () => {
    expect(moneyToCents("12.60")).toBe(1260);
    expect(moneyToCents("12.601")).toBeNull();
    expect(formatCents(840)).toBe("8.40");
  });
});
