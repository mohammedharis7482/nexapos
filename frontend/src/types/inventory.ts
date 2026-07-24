import type { PaginatedResponse } from "@/types/api";
import type { CategorySummary, ProductUnit } from "@/types/product";

export const STOCK_STATUSES = [
  "NOT_INITIALIZED",
  "IN_STOCK",
  "LOW_STOCK",
  "OUT_OF_STOCK",
] as const;
export type StockStatus = (typeof STOCK_STATUSES)[number];

export const MANUAL_MOVEMENT_TYPES = [
  "STOCK_IN",
  "STOCK_OUT",
  "DAMAGE",
  "EXPIRED",
  "CORRECTION_IN",
  "CORRECTION_OUT",
] as const;
export type ManualMovementType = (typeof MANUAL_MOVEMENT_TYPES)[number];
export type MovementType = "OPENING" | ManualMovementType;

export interface InventoryProduct {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  unit: ProductUnit;
  category: CategorySummary | null;
  is_active: boolean;
}

export interface InventoryItem {
  product: InventoryProduct;
  quantity_on_hand: string | null;
  low_stock_threshold: string | null;
  stock_status: StockStatus;
  last_movement_at: string | null;
  is_initialized: boolean;
}

export interface InventorySummary {
  total_products: number;
  initialized: number;
  low_stock: number;
  out_of_stock: number;
}

export interface StockMovement {
  id: string;
  movement_type: MovementType;
  quantity_delta: string;
  quantity_before: string;
  quantity_after: string;
  reason: string;
  reference: string;
  created_by: { id: string; full_name: string };
  created_at: string;
}

export interface OpeningStockRequest {
  quantity: string;
  low_stock_threshold: string;
  reason: string;
}

export interface AdjustmentRequest {
  movement_type: ManualMovementType;
  quantity: string;
  reason: string;
  reference: string;
}

export interface InventoryOperationResult {
  inventory: InventoryItem;
  movement: StockMovement;
}

export interface InventoryFilters {
  search?: string;
  category?: string;
  stock_status?: StockStatus | "";
  is_active?: "true" | "false" | "all" | "";
  page?: number;
  page_size?: number;
}

export type InventoryListResponse = PaginatedResponse<InventoryItem>;
