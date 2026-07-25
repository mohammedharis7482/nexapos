import {
  Banknote,
  CheckCircle2,
  CircleDashed,
  CreditCard,
  PackageCheck,
  PackageX,
  ShieldCheck,
  TriangleAlert,
  UserRound,
  XCircle,
} from "lucide-react";
import type { ElementType } from "react";

import { Badge } from "@/components/ui/display";
import type { UserRole } from "@/types/auth";
import type { StockStatus } from "@/types/inventory";
import type { PaymentMethod } from "@/types/payment";

function SemanticStatus({
  label,
  tone,
  icon: Icon,
}: {
  label: string;
  tone: "neutral" | "primary" | "success" | "warning" | "danger";
  icon: ElementType;
}) {
  return <Badge tone={tone}><Icon className="mr-1.5 size-3.5" aria-hidden="true" />{label}</Badge>;
}

export function StockStatusBadgeV2({ status }: { status: StockStatus }) {
  const values: Record<StockStatus, { label: string; tone: "neutral" | "success" | "warning" | "danger"; icon: ElementType }> = {
    IN_STOCK: { label: "In stock", tone: "success", icon: PackageCheck },
    LOW_STOCK: { label: "Low stock", tone: "warning", icon: TriangleAlert },
    OUT_OF_STOCK: { label: "Out of stock", tone: "danger", icon: PackageX },
    NOT_INITIALIZED: { label: "Not initialized", tone: "neutral", icon: CircleDashed },
  };
  return <SemanticStatus {...values[status]} />;
}

export function SaleStatusBadge({ status }: { status: "COMPLETED" | "DRAFT" | "CANCELLED" }) {
  const values = {
    COMPLETED: { label: "Completed", tone: "success" as const, icon: CheckCircle2 },
    DRAFT: { label: "Draft", tone: "primary" as const, icon: CircleDashed },
    CANCELLED: { label: "Cancelled", tone: "neutral" as const, icon: XCircle },
  };
  return <SemanticStatus {...values[status]} />;
}

export function PaymentMethodBadge({ method }: { method: PaymentMethod }) {
  return <SemanticStatus label={method === "CASH" ? "Cash" : "Card"} tone={method === "CASH" ? "success" : "primary"} icon={method === "CASH" ? Banknote : CreditCard} />;
}

export function RoleBadge({ role }: { role: UserRole }) {
  return <SemanticStatus label={role === "OWNER" ? "Owner" : "Cashier"} tone={role === "OWNER" ? "primary" : "neutral"} icon={role === "OWNER" ? ShieldCheck : UserRound} />;
}
