"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { IconButton } from "@/components/ui/button";
import { MoneyDisplay } from "@/components/ui/display";
import { Input } from "@/components/ui/input";
import { billingQuantity } from "@/schemas/billing.schema";
import type { SaleItem } from "@/types/billing";

export function nextQuantity(
  quantity: string,
  direction: "increase" | "decrease",
  unit: SaleItem["product"]["unit"] = "PIECE",
) {
  const step = ["KG", "GRAM", "LITRE", "MILLILITRE"].includes(unit) ? 0.001 : 1;
  const next = Number(quantity) + (direction === "increase" ? step : -step);
  return Math.max(step, next).toFixed(3);
}

export function CartLine({
  item,
  busy,
  onQuantity,
  onRemove,
}: {
  item: SaleItem;
  busy: boolean;
  onQuantity: (quantity: string) => void;
  onRemove: () => void;
}) {
  const [quantity, setQuantity] = useState(item.quantity);
  const [confirmRemove, setConfirmRemove] = useState(false);

  function commit(value: string) {
    if (billingQuantity.safeParse(value).success && value !== item.quantity) {
      onQuantity(value);
    } else {
      setQuantity(item.quantity);
    }
  }

  return (
    <article className="border-b border-border py-3.5 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold">{item.product.name}</h3>
          <p className="mt-0.5 text-xs text-text-muted">
            {item.product.sku} · <MoneyDisplay value={item.unit_price} />/{item.product.unit.toLowerCase()}
          </p>
        </div>
        {confirmRemove ? (
          <div className="flex items-center gap-1">
            <button type="button" className="min-h-10 rounded-lg px-2 text-xs font-semibold text-text-secondary hover:bg-surface-secondary" onClick={() => setConfirmRemove(false)}>Keep</button>
            <button type="button" className="min-h-10 rounded-lg bg-danger-soft px-2 text-xs font-semibold text-danger hover:bg-red-100" onClick={onRemove}>Remove</button>
          </div>
        ) : (
          <IconButton aria-label={`Remove ${item.product.name}`} disabled={busy} onClick={() => setConfirmRemove(true)}>
            <Trash2 className="size-4 text-danger" />
          </IconButton>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <IconButton aria-label={`Decrease ${item.product.name}`} disabled={busy} onClick={() => onQuantity(nextQuantity(item.quantity, "decrease", item.product.unit))}>
            <Minus className="size-4" />
          </IconButton>
          <Input
            aria-label={`Quantity for ${item.product.name}`}
            className="w-24 text-center"
            inputMode="decimal"
            value={quantity}
            disabled={busy}
            onChange={(event) => setQuantity(event.target.value)}
            onBlur={() => commit(quantity)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commit(quantity);
              }
            }}
          />
          <IconButton aria-label={`Increase ${item.product.name}`} disabled={busy} onClick={() => onQuantity(nextQuantity(item.quantity, "increase", item.product.unit))}>
            <Plus className="size-4" />
          </IconButton>
        </div>
        <div className="text-right">
          <p className="font-bold"><MoneyDisplay value={item.line_total} /></p>
          <p className="text-xs text-text-muted">
            {Number(item.tax_rate) > 0 ? `${item.tax_rate}% tax` : "No tax"}
          </p>
        </div>
      </div>
    </article>
  );
}
