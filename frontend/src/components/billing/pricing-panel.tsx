"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button, IconButton } from "@/components/ui/button";
import { MoneyDisplay, QuantityDisplay } from "@/components/ui/display";
import { Input, SegmentedControl } from "@/components/ui/input";
import { packetLabel, packetStockDraw } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { billingQuantity } from "@/schemas/billing.schema";
import type { SalePricingMode } from "@/types/billing";
import type { InventoryItem } from "@/types/inventory";

/**
 * Inline packet/loose picker for a multi-pricing product.
 *
 * Sits between the search field and the product grid rather than inside a
 * card or a modal. Two reasons: the grid's arrow-key navigation resolves
 * cards by indexing the grid's `button` elements, so extra buttons inside a
 * card would silently shift every index; and a card is itself a `button`,
 * which cannot legally contain one. Keeping the controls out here leaves the
 * grid untouched and the flow modeless.
 */
export function PricingPanel({
  item,
  busy,
  onAdd,
  onCancel,
}: {
  item: InventoryItem;
  busy: boolean;
  onAdd: (payload: { pricing_mode: SalePricingMode; packet_id?: string; quantity: string }) => void;
  onCancel: () => void;
}) {
  const packets = item.product.packets;
  const [mode, setMode] = useState<"PACKET" | "LOOSE">(
    packets.length ? "PACKET" : "LOOSE",
  );
  const [packetId, setPacketId] = useState(packets[0]?.id ?? "");
  const [packetCount, setPacketCount] = useState("1");
  const [weight, setWeight] = useState("");
  const [error, setError] = useState<string | null>(null);
  const weightRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const available = Number(item.quantity_on_hand ?? "0");
  const packet = packets.find((candidate) => candidate.id === packetId) ?? packets[0];

  // Focus the weight field the moment loose mode is chosen, so the cashier
  // can type a weight straight off the scale without reaching for the mouse.
  useEffect(() => {
    if (mode === "LOOSE") weightRef.current?.focus();
  }, [mode]);

  function submit() {
    setError(null);
    if (mode === "LOOSE") {
      const parsed = billingQuantity.safeParse(weight);
      if (!parsed.success) {
        setError("Enter a weight greater than zero.");
        return;
      }
      if (Number(weight) > available) {
        setError(`Only ${item.quantity_on_hand} ${item.product.unit.toLowerCase()} in stock.`);
        return;
      }
      onAdd({ pricing_mode: "LOOSE", quantity: weight });
      return;
    }
    if (!packet) {
      setError("Choose a packet size.");
      return;
    }
    const parsed = billingQuantity.safeParse(packetCount);
    if (!parsed.success || Number(packetCount) % 1 !== 0) {
      setError("Packets are sold in whole numbers.");
      return;
    }
    if (packetStockDraw(packet, packetCount) > available) {
      setError(`Only ${item.quantity_on_hand} ${item.product.unit.toLowerCase()} in stock.`);
      return;
    }
    onAdd({ pricing_mode: "PACKET", packet_id: packet.id, quantity: packetCount });
  }

  return (
    <div
      ref={panelRef}
      role="group"
      aria-label={`Choose how to sell ${item.product.name}`}
      className="rounded-[var(--radius-card)] border border-primary bg-primary-soft/30 p-4 shadow-[var(--shadow-card)]"
      onKeyDown={(event) => {
        // Contained here so the grid's own arrow-key handler and the page's
        // shortcut bindings never see these keys.
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
        if (event.key === "Enter") {
          event.preventDefault();
          submit();
        }
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-semibold">{item.product.name}</h2>
          <p className="mt-0.5 text-xs text-text-muted">
            <QuantityDisplay
              value={item.quantity_on_hand ?? "0"}
              unit={item.product.unit}
            />{" "}
            available
          </p>
        </div>
        <IconButton aria-label="Close pricing options" onClick={onCancel}>
          <X className="size-4" />
        </IconButton>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {packets.length ? (
          <SegmentedControl
            label="Pricing mode"
            value={mode}
            onChange={setMode}
            options={[
              { value: "PACKET", label: "Packet" },
              { value: "LOOSE", label: "Loose" },
            ]}
          />
        ) : null}
      </div>

      {mode === "PACKET" && packets.length ? (
        <div className="mt-3">
          <span className="mb-1.5 block text-sm font-semibold">Packet size</span>
          <div role="group" aria-label="Packet size" className="flex flex-wrap gap-2">
            {packets.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={option.id === packet?.id}
                onClick={() => setPacketId(option.id)}
                className={cn(
                  "min-h-[var(--control-md)] rounded-[var(--radius-control)] border px-3 text-sm font-semibold transition-colors",
                  option.id === packet?.id
                    ? "border-primary bg-surface text-primary shadow-[var(--shadow-xs)]"
                    : "border-border bg-surface text-foreground-secondary hover:bg-surface-hover",
                )}
              >
                {packetLabel(option.size, item.product.unit)}
                <span className="ml-2 font-bold">
                  <MoneyDisplay value={option.price} />
                </span>
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <label htmlFor="packet-count" className="text-sm font-semibold">
              Packets
            </label>
            <Input
              id="packet-count"
              className="w-20 text-center"
              inputMode="numeric"
              value={packetCount}
              onFocus={(event) => event.target.select()}
              onChange={(event) => setPacketCount(event.target.value)}
            />
            {packet ? (
              <span className="text-sm text-text-muted">
                = <QuantityDisplay
                  value={packetStockDraw(packet, packetCount) || 0}
                  unit={item.product.unit}
                />
              </span>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2">
          <label htmlFor="loose-weight" className="text-sm font-semibold">
            Weight
          </label>
          {/* Same decimal entry and select-all-on-focus as the cart's
              quantity field, so weight is typed identically everywhere. */}
          <Input
            id="loose-weight"
            ref={weightRef}
            className="w-28 text-center"
            inputMode="decimal"
            placeholder="0.000"
            aria-label={`Weight in ${item.product.unit.toLowerCase()}`}
            value={weight}
            onFocus={(event) => event.target.select()}
            onChange={(event) => setWeight(event.target.value)}
          />
          <span className="text-sm text-text-muted">
            {item.product.unit.toLowerCase()} @{" "}
            <MoneyDisplay value={item.product.selling_price} />
          </span>
        </div>
      )}

      {error ? (
        <p role="alert" className="mt-2 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={submit} loading={busy} disabled={busy}>
          Add to Bill
        </Button>
      </div>
    </div>
  );
}
