import type { PaginatedResponse } from "@/types/api";
import type { UserRole } from "@/types/auth";
import type { ProductUnit } from "@/types/product";

export type SaleStatus = "DRAFT" | "CANCELLED";

export interface DraftCreator {
  id: string;
  full_name: string;
  role: UserRole;
}

export interface SaleItem {
  id: string;
  product: {
    id: string;
    name: string;
    sku: string;
    barcode: string | null;
    unit: ProductUnit;
  };
  quantity: string;
  unit_price: string;
  tax_rate: string;
  is_tax_inclusive: boolean;
  tax_amount: string;
  line_subtotal: string;
  line_total: string;
}

export interface DraftSale {
  id: string;
  status: SaleStatus;
  currency: "QAR";
  created_by: DraftCreator;
  items: SaleItem[];
  subtotal: string;
  tax_total: string;
  discount_total: string;
  grand_total: string;
  notes: string;
  cancelled_at: string | null;
  cancelled_by: DraftCreator | null;
  created_at: string;
  updated_at: string;
}

export interface AddItemRequest {
  product_id?: string;
  barcode?: string;
  quantity: string;
}

export interface UpdateItemRequest {
  quantity: string;
}

export type DraftListResponse = PaginatedResponse<DraftSale>;
