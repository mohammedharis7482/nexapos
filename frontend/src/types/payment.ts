export type PaymentMethod = "CASH" | "CARD";

export interface PaymentInput {
  method: PaymentMethod;
  amount: string;
  reference?: string;
}

export interface CompleteSaleRequest {
  payments: PaymentInput[];
  amount_received?: string;
}

export interface PaymentSummary {
  id: string;
  method: PaymentMethod;
  amount: string;
  reference: string;
  created_at: string;
}
