"use client";

import { useEffect, useRef, useState } from "react";

import { SegmentedControl } from "@/components/ui/input";
import { discountValueInput } from "@/schemas/billing.schema";
import { billingService } from "@/services/billing.service";
import { ApiError } from "@/lib/api-client";
import type { DiscountType, DraftSale } from "@/types/billing";

const DEBOUNCE_MS = 250;

export function clampDiscountInput(
  mode: Exclude<DiscountType, "NONE">,
  rawValue: string,
  subtotal: string,
): { value: string; clamped: boolean } {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) return { value: rawValue, clamped: false };
  const ceiling = mode === "PERCENTAGE" ? 100 : Number(subtotal);
  if (parsed > ceiling) return { value: ceiling.toFixed(2), clamped: true };
  return { value: rawValue, clamped: false };
}

export function DiscountControl({
  draft,
  onUpdated,
}: {
  draft: DraftSale;
  onUpdated: (draft: DraftSale) => void;
}) {
  const initialMode: Exclude<DiscountType, "NONE"> =
    draft.discount_type === "FIXED" ? "FIXED" : "PERCENTAGE";
  const [mode, setMode] = useState<Exclude<DiscountType, "NONE">>(initialMode);
  const [value, setValue] = useState(
    draft.discount_type === "NONE" ? "" : draft.discount_value,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<number | null>(null);
  const requestId = useRef(0);

  async function commit(nextMode: Exclude<DiscountType, "NONE">, nextValue: string) {
    const trimmed = nextValue.trim();
    const isEmpty = trimmed === "" || Number(trimmed) === 0;
    const parseResult = isEmpty
      ? { success: true as const }
      : discountValueInput.safeParse(trimmed);
    if (!parseResult.success) return;

    const id = ++requestId.current;
    setBusy(true);
    try {
      const response = await billingService.setDiscount(draft.id, {
        discount_type: isEmpty ? "NONE" : nextMode,
        discount_value: isEmpty ? "0.00" : trimmed,
      });
      if (id === requestId.current) onUpdated(response.data);
    } catch (error) {
      if (id === requestId.current) {
        setNotice(
          error instanceof ApiError ? error.message : "The discount could not be applied.",
        );
      }
    } finally {
      if (id === requestId.current) setBusy(false);
    }
  }

  function scheduleCommit(nextMode: Exclude<DiscountType, "NONE">, nextValue: string) {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void commit(nextMode, nextValue), DEBOUNCE_MS);
  }

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  function handleValueChange(raw: string) {
    setNotice(null);
    if (raw !== "" && !/^\d{0,12}(\.\d{0,2})?$/.test(raw)) return;
    const { value: clamped, clamped: wasClamped } = clampDiscountInput(mode, raw, draft.subtotal);
    setValue(clamped);
    if (wasClamped) {
      setNotice(
        mode === "PERCENTAGE"
          ? "A discount can't exceed 100%."
          : `A discount can't exceed the subtotal (QAR ${draft.subtotal}).`,
      );
    }
    scheduleCommit(mode, clamped);
  }

  function handleModeChange(nextMode: Exclude<DiscountType, "NONE">) {
    setMode(nextMode);
    setNotice(null);
    if (value.trim() === "") return;
    const { value: clamped, clamped: wasClamped } = clampDiscountInput(nextMode, value, draft.subtotal);
    setValue(clamped);
    if (wasClamped) {
      setNotice(
        nextMode === "PERCENTAGE"
          ? "A discount can't exceed 100%."
          : `A discount can't exceed the subtotal (QAR ${draft.subtotal}).`,
      );
    }
    scheduleCommit(nextMode, clamped);
  }

  return (
    <div className="space-y-1.5 border-b border-border pb-4">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor="bill-discount" className="text-sm font-semibold text-foreground">
          Discount
        </label>
        <SegmentedControl
          label="Discount type"
          value={mode}
          onChange={handleModeChange}
          options={[
            { value: "PERCENTAGE", label: "%" },
            { value: "FIXED", label: "QAR" },
          ]}
        />
      </div>
      <div className="relative">
        <input
          id="bill-discount"
          inputMode="decimal"
          placeholder="0.00"
          value={value}
          disabled={busy}
          aria-describedby={notice ? "bill-discount-notice" : undefined}
          onChange={(event) => handleValueChange(event.target.value)}
          className="min-h-[var(--control-md)] w-full rounded-[var(--radius-control)] border border-input-border bg-surface px-3.5 pr-10 text-right text-[15px] tabular-nums text-foreground shadow-[var(--shadow-xs)] outline-none transition-colors focus:border-border-focus focus:ring-4 focus:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:bg-surface-muted"
        />
        <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-foreground-muted">
          {mode === "PERCENTAGE" ? "%" : "QAR"}
        </span>
      </div>
      {notice ? (
        <p id="bill-discount-notice" className="text-xs font-medium text-warning" role="alert" aria-live="polite">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
