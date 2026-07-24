import type { UserRole } from "@/types/auth";
import type { PaymentMethod } from "@/types/payment";

export interface OwnerDashboardSummary {
  sales_total_today: string;
  completed_sales_count_today: number;
  average_sale_value_today: string;
  items_sold_today: string;
  cash_sales_total_today: string;
  card_sales_total_today: string;
  split_sales_total_today: string;
  low_stock_count: number;
  out_of_stock_count: number;
  inventory_not_initialized_count: number;
  active_product_count: number;
}

export interface CashierDashboardSummary {
  my_sales_total_today: string;
  my_completed_sales_count_today: number;
  my_average_sale_value_today: string;
  my_items_sold_today: string;
}

export type DashboardSummary =
  | OwnerDashboardSummary
  | CashierDashboardSummary;

export interface RecentSale {
  id: string;
  sale_number: string;
  completed_at: string;
  cashier_name: string;
  item_count: number;
  payment_methods: PaymentMethod[];
  grand_total: string;
}

export type InventoryStockStatus =
  | "LOW_STOCK"
  | "OUT_OF_STOCK"
  | "NOT_INITIALIZED";

export interface InventoryAlert {
  product_id: string;
  product_name: string;
  sku: string;
  category: string | null;
  unit: string;
  quantity_on_hand: string | null;
  low_stock_threshold: string | null;
  stock_status: InventoryStockStatus;
}

export interface InventoryAlerts {
  low_stock: InventoryAlert[];
  out_of_stock: InventoryAlert[];
  not_initialized: InventoryAlert[];
}

export interface TopProduct {
  rank: number;
  product_id: string;
  product_name: string;
  sku: string;
  quantity_sold: string;
  sales_total: string;
}

export interface SalesTrendPoint {
  date: string;
  sales_total: string;
  completed_sales_count: number;
}

export interface PaymentBreakdownItem {
  method: PaymentMethod;
  amount: string;
  percentage: string;
}

interface DashboardBase {
  role: UserRole;
  currency: string;
  timezone: string;
  generated_at: string;
  top_products_period: "today" | "7d";
  recent_sales: RecentSale[];
  inventory_alerts: InventoryAlerts;
  top_products: TopProduct[];
  sales_trend: SalesTrendPoint[];
  payment_breakdown: PaymentBreakdownItem[];
}

export interface OwnerDashboard extends DashboardBase {
  role: "OWNER";
  summary: OwnerDashboardSummary;
}

export interface CashierDashboard extends DashboardBase {
  role: "CASHIER";
  summary: CashierDashboardSummary;
}

export type DashboardData = OwnerDashboard | CashierDashboard;
