export const PRODUCT_UNITS = [
  "PIECE",
  "KG",
  "GRAM",
  "LITRE",
  "MILLILITRE",
  "PACK",
  "BOX",
  "CARTON",
  "BOTTLE",
  "CAN",
  "BAG",
] as const;

export type ProductUnit = (typeof PRODUCT_UNITS)[number];

export interface CategorySummary {
  id: string;
  name: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  sku: string;
  barcode: string | null;
  unit: ProductUnit;
  purchase_price: string;
  selling_price: string;
  tax_rate: string;
  is_tax_inclusive: boolean;
  is_active: boolean;
  category: CategorySummary | null;
  created_at: string;
  updated_at: string;
}

export interface ProductInput {
  name: string;
  description: string;
  sku: string;
  barcode: string;
  unit: ProductUnit;
  purchase_price: string;
  selling_price: string;
  tax_rate: string;
  is_tax_inclusive: boolean;
  is_active: boolean;
  category_id: string | null;
}

export interface ProductFilters {
  search?: string;
  category?: string;
  unit?: string;
  is_active?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
}

export type ProductImportStatus =
  | "VALIDATED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export type DuplicateStrategy = "SKIP" | "UPDATE" | "CANCEL";

export interface ProductImport {
  id: string;
  filename: string;
  status: ProductImportStatus;
  duplicate_strategy: DuplicateStrategy | "";
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  duplicate_rows: number;
  products_created: number;
  products_updated: number;
  products_skipped: number;
  categories_created: number;
  inventory_initialized: number;
  error_message: string;
  created_by_name: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface ProductImportRow {
  id: string;
  row_number: number;
  raw_data: Record<string, string>;
  normalized_data: {
    name: string;
    category: string;
    sku: string;
    barcode: string | null;
    unit: string;
    purchase_price: string;
    selling_price: string | null;
    opening_stock: string | null;
    low_stock_alert: string;
    is_active: boolean | null;
  };
  errors: Record<string, string[]>;
  duplicate_fields: string[];
}

export interface ProductImportDetail extends ProductImport {
  rows: {
    count: number;
    next: string | null;
    previous: string | null;
    results: ProductImportRow[];
  };
}
