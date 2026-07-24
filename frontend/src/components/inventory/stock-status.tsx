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

  const Icon = {
    NOT_INITIALIZED: HelpCircle,
    IN_STOCK: CheckCircle2,
    LOW_STOCK: AlertTriangle,
    OUT_OF_STOCK: CircleSlash2,
  }[status];

  return (
    <Badge tone={tone}>
      <Icon className="mr-1.5 size-3.5" aria-hidden="true" />
      {stockStatusLabels[status]}
    </Badge>
  );
}
import { AlertTriangle, CheckCircle2, CircleSlash2, HelpCircle } from "lucide-react";
