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
  "CUP",
  "JAR",
  "ROLL",
  "TRAY",
  "TUBE",
] as const;

export type ProductUnit = (typeof PRODUCT_UNITS)[number];

/** Units genuinely sold by fractional weight/volume (e.g. 0.750 kg of produce). */
export const DECIMAL_PRODUCT_UNITS: ProductUnit[] = ["KG", "GRAM", "LITRE", "MILLILITRE"];

export function isDecimalUnit(unit: ProductUnit): boolean {
  return DECIMAL_PRODUCT_UNITS.includes(unit);
}

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
  image_url: string | null;
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
  invalid_rows: number;
  warning_rows: number;
  duplicate_rows: number;
  duplicate_summary: {
    existing_rows: number;
    strategy_required: boolean;
  };
  products_created: number;
  products_updated: number;
  products_skipped: number;
  categories_created: number;
  categories_to_create: string[];
  inventory_initialized: number;
  opening_movements_created: number;
  error_message: string;
  failure_code: string;
  created_by_name: string;
  started_at: string | null;
  completed_at: string | null;
  expires_at: string | null;
  duration_ms: number | null;
  created_at: string;
  can_import: boolean;
}

export interface ProductImportIssue {
  row_number: number;
  column: string;
  value: string;
  error_code: string;
  human_message: string;
  suggested_fix: string;
}

export interface ProductImportRow {
  id: string;
  row_number: number;
  raw_data: Record<string, string>;
  normalized_data: {
    name: string;
    description: string;
    category: string;
    category_state: "EXISTING" | "NEW" | "NONE";
    sku: string;
    barcode: string | null;
    unit: string;
    purchase_price: string;
    selling_price: string | null;
    opening_stock: string | null;
    low_stock_alert: string;
    is_active: boolean | null;
    tax_rate: string;
    unit_display: string;
  };
  errors: ProductImportIssue[];
  warnings: ProductImportIssue[];
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
