import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ReceiptData } from "@/types/sales";

import { Receipt } from "./receipt";

const receipt: ReceiptData = {
  shop: {
    name: "Nexa Grocery",
    legal_name: "",
    address: "Doha",
    phone: "+974 5555 0000",
    tax_registration_number: "TRN-1",
    receipt_footer: "Thank you",
  },
  sale: {
    id: "sale-id",
    status: "COMPLETED",
    sale_number: "NXP-ABC123-20260724-000001",
    currency: "QAR",
    created_by: { id: "user-id", full_name: "Cashier", role: "CASHIER" },
    completed_by: { id: "user-id", full_name: "Cashier", role: "CASHIER" },
    items: [{
      id: "item-id",
      product: { id: "product-id", name: "Milk", sku: "MILK", barcode: null, unit: "BOTTLE" },
      quantity: "2.000",
      unit_price: "6.00",
      tax_rate: "0.00",
      is_tax_inclusive: false,
      tax_amount: "0.00",
      line_subtotal: "12.00",
      line_total: "12.00",
    }],
    subtotal: "12.00",
    tax_total: "0.00",
    discount_total: "0.00",
    grand_total: "12.00",
    notes: "",
    cancelled_at: null,
    cancelled_by: null,
    payments: [{ id: "payment-id", method: "CASH", amount: "12.00", reference: "", created_at: "" }],
    amount_received: "20.00",
    change_due: "8.00",
    completed_at: "2026-07-24T10:00:00Z",
    created_at: "",
    updated_at: "",
  },
};

describe("Receipt", () => {
  it("renders printable shop, sale, item, payment, and total data", () => {
    const { container } = render(<Receipt data={receipt} />);
    expect(screen.getByText("Nexa Grocery")).toBeInTheDocument();
    expect(screen.getByText(/NXP-ABC123/)).toBeInTheDocument();
    expect(screen.getByText("Milk")).toBeInTheDocument();
    expect(screen.getByText("Thank you")).toBeInTheDocument();
    expect(container.querySelector(".print-receipt")).toBeInTheDocument();
    expect(container.textContent).not.toContain("purchase_price");
  });
});
