"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { IconButton } from "@/components/ui/button";
import { MoneyDisplay } from "@/components/ui/display";
import { Input } from "@/components/ui/input";
import { billingQuantity } from "@/schemas/billing.schema";
import type { SaleItem } from "@/types/billing";
import { isDecimalUnit } from "@/types/product";

export function nextQuantity(
  quantity: string,
  direction: "increase" | "decrease",
  unit: SaleItem["product"]["unit"] = "PIECE",
) {
  const decimal = isDecimalUnit(unit);
  const step = decimal ? 0.001 : 1;
  const next = Math.max(step, Number(quantity) + (direction === "increase" ? step : -step));
  return decimal ? next.toFixed(3) : String(Math.round(next));
}

/**
 * Whole-count products (piece, pack, bottle, ...) render as a clean integer
 * instead of the API's fixed 3-decimal string. Weight/volume products keep
 * their decimal precision, since fractional amounts (0.750 kg) are real.
 * Falls back to the raw value for the rare case of a non-integer quantity
 * on a whole-count product, rather than silently rounding it away.
 */
export function formatQuantityDisplay(quantity: string, unit: SaleItem["product"]["unit"]) {
  if (isDecimalUnit(unit)) return quantity;
  const numeric = Number(quantity);
  return Number.isInteger(numeric) ? String(numeric) : quantity;
}

export function CartLine({
  item,
  busy,
  onQuantity,
  onRemove,
  onFocusItem,
}: {
  item: SaleItem;
  busy: boolean;
  onQuantity: (quantity: string) => void;
  onRemove: () => void;
  onFocusItem?: () => void;
}) {
  const [quantity, setQuantity] = useState(formatQuantityDisplay(item.quantity, item.product.unit));
  const [confirmRemove, setConfirmRemove] = useState(false);

  function commit(value: string) {
    const parsed = billingQuantity.safeParse(value);
    if (parsed.success && Number(value) !== Number(item.quantity)) {
      onQuantity(value);
    } else {
      setQuantity(formatQuantityDisplay(item.quantity, item.product.unit));
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
            onFocus={(event) => {
              event.target.select();
              onFocusItem?.();
            }}
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
