"use client";

import { Plus, Trash2 } from "lucide-react";
import { useId } from "react";

import { Button, IconButton } from "@/components/ui/button";
import { Checkbox, MoneyInput, QuantityInput } from "@/components/ui/input";
import type { ProductPacketInput, ProductUnit } from "@/types/product";

/** A row's identity has to survive edits to its own size, so rows carry a
 *  client-side key rather than being keyed by index or by value. */
export interface PacketDraft extends ProductPacketInput {
  key: string;
}

export function newPacketDraft(): PacketDraft {
  return { key: crypto.randomUUID(), size: "", price: "" };
}

/**
 * Optional packet definitions for a multi-pricing product.
 *
 * Follows ProductImageField's convention for an optional feature: a single
 * toggle reveals the controls, and everything stays inside the same fieldset
 * styling as the rest of the product form. Sizes are entered in the
 * product's own unit, which is what the server stores.
 */
export function ProductPacketsField({
  enabled,
  onEnabledChange,
  unit,
  packets,
  onPacketsChange,
  error,
  disabled,
}: {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  unit: ProductUnit;
  packets: PacketDraft[];
  onPacketsChange: (packets: PacketDraft[]) => void;
  error?: string | null;
  disabled?: boolean;
}) {
  const headingId = useId();

  function update(key: string, patch: Partial<ProductPacketInput>) {
    onPacketsChange(
      packets.map((packet) => (packet.key === key ? { ...packet, ...patch } : packet)),
    );
  }

  return (
    <div>
      <Checkbox
        label="Sell as packets and loose"
        description="Define fixed packet sizes alongside loose sales. Both draw on the same stock."
        checked={enabled}
        disabled={disabled}
        onChange={(event) => onEnabledChange(event.target.checked)}
      />

      {enabled ? (
        <div className="mt-3 space-y-3 rounded-[var(--radius-control)] border border-border bg-surface-subtle p-4">
          <p id={headingId} className="text-sm font-semibold">
            Packet sizes
            <span className="ml-2 font-normal text-text-muted">
              in {unit.toLowerCase()}
            </span>
          </p>

          {packets.length === 0 ? (
            <p className="text-sm text-text-muted">
              Add at least one packet size, for example 0.250 at a fixed price.
            </p>
          ) : null}

          <ul aria-labelledby={headingId} className="space-y-2">
            {packets.map((packet, index) => (
              <li key={packet.key} className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <label
                    htmlFor={`packet-size-${packet.key}`}
                    className="mb-1.5 block text-xs font-semibold text-text-secondary"
                  >
                    Size
                  </label>
                  <QuantityInput
                    id={`packet-size-${packet.key}`}
                    unit={unit}
                    placeholder="0.250"
                    disabled={disabled}
                    value={packet.size}
                    onFocus={(event) => event.target.select()}
                    onChange={(event) => update(packet.key, { size: event.target.value })}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <label
                    htmlFor={`packet-price-${packet.key}`}
                    className="mb-1.5 block text-xs font-semibold text-text-secondary"
                  >
                    Packet price
                  </label>
                  <MoneyInput
                    id={`packet-price-${packet.key}`}
                    placeholder="0.00"
                    disabled={disabled}
                    value={packet.price}
                    onFocus={(event) => event.target.select()}
                    onChange={(event) => update(packet.key, { price: event.target.value })}
                  />
                </div>
                <IconButton
                  aria-label={`Remove packet size ${index + 1}`}
                  disabled={disabled}
                  onClick={() =>
                    onPacketsChange(packets.filter((row) => row.key !== packet.key))
                  }
                >
                  <Trash2 className="size-4 text-danger" />
                </IconButton>
              </li>
            ))}
          </ul>

          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={disabled}
            leadingIcon={<Plus className="size-4" />}
            onClick={() => onPacketsChange([...packets, newPacketDraft()])}
          >
            Add packet size
          </Button>

          {error ? (
            <p role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
