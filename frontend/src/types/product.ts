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
