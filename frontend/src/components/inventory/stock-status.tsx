import { StockStatusBadgeV2 } from "@/components/ui/status";
import type { StockStatus } from "@/types/inventory";

export const stockStatusLabels: Record<StockStatus, string> = {
  NOT_INITIALIZED: "Not initialized",
  IN_STOCK: "In stock",
  LOW_STOCK: "Low stock",
  OUT_OF_STOCK: "Out of stock",
};

/** @deprecated Import StockStatusBadgeV2 from the V2 status module in migrated pages. */
export function StockStatusBadge({ status }: { status: StockStatus }) {
  return <StockStatusBadgeV2 status={status} />;
}
