"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { FormField, Input, Select, Textarea } from "@/components/ui/input";
import { Dialog } from "@/components/ui/overlay";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
  adjustmentSchema,
  type AdjustmentFormValues,
} from "@/schemas/inventory.schema";
import { inventoryService } from "@/services/inventory.service";
import type { ManualMovementType } from "@/types/inventory";

export const movementOptions: Array<{
  value: ManualMovementType;
  label: string;
  direction: "increase" | "decrease";
}> = [
  { value: "STOCK_IN", label: "Stock received", direction: "increase" },
  { value: "STOCK_OUT", label: "Stock removed", direction: "decrease" },
  { value: "DAMAGE", label: "Damaged", direction: "decrease" },
  { value: "EXPIRED", label: "Expired", direction: "decrease" },
  { value: "CORRECTION_IN", label: "Correction increase", direction: "increase" },
  { value: "CORRECTION_OUT", label: "Correction decrease", direction: "decrease" },
];

const defaults: AdjustmentFormValues = {
  movement_type: "STOCK_IN",
  quantity: "",
  reason: "",
  reference: "",
};

export function expectedQuantity(
  current: string,
  quantity: string,
  movementType: ManualMovementType,
) {
  if (!/^\d+(\.\d{1,3})?$/.test(quantity)) return null;
  const direction = movementOptions.find((option) => option.value === movementType)?.direction;
  const result = Number(current) + (direction === "decrease" ? -Number(quantity) : Number(quantity));
  return result.toFixed(3);
}

export function AdjustmentDialog({
  open,
  onOpenChange,
  productId,
  productName,
  currentQuantity,
  unit,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  currentQuantity: string;
  unit: string;
  onSaved: () => void;
}) {
  const [generalError, setGeneralError] = useState<string | null>(null);
  const {
    register,
    control,
    reset,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AdjustmentFormValues>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: defaults,
  });
  useEffect(() => {
    if (open) reset(defaults);
  }, [open, reset]);
  const movementType = useWatch({ control, name: "movement_type" });
  const quantity = useWatch({ control, name: "quantity" });
  const expected = useMemo(
    () => expectedQuantity(currentQuantity, quantity, movementType),
    [currentQuantity, movementType, quantity],
  );
  const reductionTooLarge = expected !== null && Number(expected) < 0;

  const submit = handleSubmit(async (values) => {
    setGeneralError(null);
    try {
      await inventoryService.adjust(productId, values);
      onSaved();
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ApiError) {
        Object.entries(error.errors).forEach(([field, messages]) => {
          if (field in defaults) {
            setError(field as keyof AdjustmentFormValues, {
              message: Array.isArray(messages) ? messages[0] : messages,
            });
          }
        });
        setGeneralError(error.message);
      } else setGeneralError("Inventory could not be adjusted.");
    }
  });

  const direction = movementOptions.find((option) => option.value === movementType)?.direction;
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Adjust inventory"
      description={`${productName} currently has ${currentQuantity} ${unit}.`}
    >
      <form className="space-y-4" onSubmit={submit} noValidate>
        {generalError ? <Alert title={generalError} /> : null}
        <FormField label="Movement type" htmlFor="movement-type" error={errors.movement_type?.message}>
          <Select id="movement-type" {...register("movement_type")}>
            {movementOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </Select>
        </FormField>
        <FormField label="Quantity" htmlFor="adjustment-quantity" error={errors.quantity?.message}>
          <Input id="adjustment-quantity" inputMode="decimal" {...register("quantity")} />
        </FormField>
        <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-surface-secondary p-4">
          <div><p className="text-xs font-semibold text-text-muted">Current stock</p><p className="mt-1 font-bold tabular-nums">{currentQuantity} {unit.toLowerCase()}</p></div>
          <div className="text-right"><p className="text-xs font-semibold text-text-muted">Expected stock</p><p className={cn("mt-1 font-bold tabular-nums", reductionTooLarge ? "text-danger" : "text-text-primary")}>{expected ?? "—"} {unit.toLowerCase()}</p></div>
          <p className="col-span-2 border-t border-border pt-3 text-xs text-text-muted">This movement will <strong>{direction}</strong> stock.</p>
        </div>
        {reductionTooLarge ? <Alert title="This exceeds available stock." tone="warning">The backend will reject negative stock.</Alert> : null}
        <FormField label="Reason" htmlFor="adjustment-reason" error={errors.reason?.message}>
          <Textarea id="adjustment-reason" {...register("reason")} />
        </FormField>
        <FormField label="Reference (optional)" htmlFor="adjustment-reference" error={errors.reference?.message}>
          <Input id="adjustment-reference" {...register("reference")} />
        </FormField>
        <div className="flex justify-end gap-3 border-t border-border pt-4">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" loading={isSubmitting} disabled={reductionTooLarge}>Save adjustment</Button>
        </div>
      </form>
    </Dialog>
  );
}
