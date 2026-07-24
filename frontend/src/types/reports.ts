import type { PaymentMethod } from "@/types/payment";

export interface ReportFilters {
  date_from: string;
  date_to: string;
  cashier?: string;
  category?: string;
  payment_method?: PaymentMethod | "";
}

export interface SalesReport {
  gross_sales: string;
  completed_sales_count: number;
  average_sale_value: string;
  items_sold: string;
  tax_total: string;
  discount_total: string;
  daily: Array<{ date: string; sales_total: string; sales_count: number }>;
}

export interface ProductReportRow {
  rank: number;
  product_id: string;
  product_name: string;
  sku: string;
  unit: string;
  quantity_sold: string;
  sales_total: string;
  sales_count: number;
}

export interface InventoryReportRow {
  product_id: string;
  product_name: string;
  sku: string;
  category: string | null;
  unit: string;
  quantity_on_hand: string | null;
  low_stock_threshold: string | null;
  stock_status: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "NOT_INITIALIZED";
}

export interface InventoryReport {
  active_products: number;
  in_stock: number;
  low_stock: number;
  out_of_stock: number;
  not_initialized: number;
  quantity_on_hand: string;
  items: InventoryReportRow[];
}

export interface PaymentReportRow {
  method: PaymentMethod;
  amount: string;
  payment_count: number;
  sale_count: number;
  percentage: string;
}

export interface CashierReportRow {
  cashier_id: string;
  cashier_name: string;
  sales_total: string;
  completed_sales_count: number;
  average_sale_value: string;
  items_sold: string;
}

export interface ReportsData {
  currency: string;
  timezone: string;
  generated_at: string;
  filters: {
    date_from: string;
    date_to: string;
    cashier: string | null;
    category: string | null;
    payment_method: PaymentMethod | null;
  };
  sales: SalesReport;
  products: ProductReportRow[];
  inventory: InventoryReport;
  payments: PaymentReportRow[];
  cashiers: CashierReportRow[];
}
