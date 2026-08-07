import type { PaginatedResponse } from "@/types/api";
import type { UserRole } from "@/types/auth";
import type { ProductUnit } from "@/types/product";

export type SaleStatus = "DRAFT" | "HELD" | "COMPLETED" | "CANCELLED";

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
    image_url: string | null;
  };
  pricing_mode: SalePricingMode;
  /** The packet's size at sale time; null for standard and loose lines. */
  packet_size: string | null;
  /** Packets for a PACKET line, units otherwise. */
  quantity: string;
  /** What inventory deducted, always in the product's own unit. */
  stock_quantity: string;
  unit_price: string;
  tax_rate: string;
  is_tax_inclusive: boolean;
  tax_amount: string;
  line_subtotal: string;
  line_total: string;
}

export type DiscountType = "NONE" | "PERCENTAGE" | "FIXED";

export interface DraftSale {
  id: string;
  status: SaleStatus;
  currency: "QAR";
  created_by: DraftCreator;
  items: SaleItem[];
  subtotal: string;
  tax_total: string;
  discount_type: DiscountType;
  discount_value: string;
  discount_total: string;
  grand_total: string;
  notes: string;
  cancelled_at: string | null;
  cancelled_by: DraftCreator | null;
  created_at: string;
  updated_at: string;
  held_at: string | null;
  shift: string | null;
}

export type SalePricingMode = "STANDARD" | "PACKET" | "LOOSE";

export interface AddItemRequest {
  product_id?: string;
  barcode?: string;
  quantity: string;
  /** Omitted for standard products, so barcode scans stay unchanged. */
  pricing_mode?: SalePricingMode;
  packet_id?: string;
}

export interface UpdateItemRequest {
  quantity: string;
}

export interface UpdateDiscountRequest {
  discount_type: DiscountType;
  discount_value: string;
}

export type DraftListResponse = PaginatedResponse<DraftSale>;
