import { Badge } from "@/components/ui/display";
import type { StockStatus } from "@/types/inventory";

export const stockStatusLabels: Record<StockStatus, string> = {
  NOT_INITIALIZED: "Not initialized",
  IN_STOCK: "In stock",
  LOW_STOCK: "Low stock",
  OUT_OF_STOCK: "Out of stock",
};

export function StockStatusBadge({ status }: { status: StockStatus }) {
  const tone = {
    NOT_INITIALIZED: "neutral",
    IN_STOCK: "success",
    LOW_STOCK: "warning",
    OUT_OF_STOCK: "danger",
  }[status] as "neutral" | "success" | "warning" | "danger";

  return <Badge tone={tone}>{stockStatusLabels[status]}</Badge>;
}
