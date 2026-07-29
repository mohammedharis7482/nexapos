import type { ApiSuccess } from "@/types/auth";
import type { DraftCreator } from "@/types/billing";

export interface ShiftSummary {
  opening_cash: string;
  completed_bills: number;
  gross_sales: string;
  cash_sales: string;
  card_sales: string;
  split_payment_count: number;
  expected_closing_cash: string;
  counted_closing_cash: string | null;
  cash_difference: string | null;
  items_sold: string;
  opened_at: string;
  closed_at: string | null;
}

export interface CashierShift {
  id: string;
  status: "OPEN" | "CLOSED";
  cashier: DraftCreator;
  opened_at: string;
  closed_at: string | null;
  opening_cash: string;
  expected_closing_cash: string;
  counted_closing_cash: string | null;
  cash_difference: string | null;
  opening_note: string;
  closing_note: string;
  summary: ShiftSummary;
}

export type CurrentShiftResponse = ApiSuccess<CashierShift | null>;
