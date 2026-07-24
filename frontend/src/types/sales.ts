import type { DraftCreator, DraftSale } from "@/types/billing";
import type { PaymentMethod, PaymentSummary } from "@/types/payment";

export interface CompletedSale extends DraftSale {
  status: "COMPLETED";
  sale_number: string;
  completed_by: DraftCreator;
  payments: PaymentSummary[];
  amount_received: string;
  change_due: string;
  completed_at: string;
}

export interface ReceiptData {
  shop: {
    name: string;
    legal_name: string;
    address: string;
    phone: string;
    tax_registration_number: string;
    receipt_footer: string;
  };
  sale: CompletedSale;
}

export interface SaleHistoryItem {
  id: string;
  sale_number: string;
  status: "COMPLETED";
  currency: "QAR";
  cashier: DraftCreator;
  item_count: number;
  payment_methods: PaymentMethod[];
  grand_total: string;
  completed_at: string;
}

export interface SalesListFilters {
  search?: string;
  date_from?: string;
  date_to?: string;
  created_by?: string;
  payment_method?: PaymentMethod | "";
  ordering?: string;
  page?: number;
  page_size?: number;
}
