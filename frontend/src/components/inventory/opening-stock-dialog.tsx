"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { FormField, Input, Textarea } from "@/components/ui/input";
import { Dialog } from "@/components/ui/overlay";
import { ApiError } from "@/lib/api-client";
import {
  openingStockSchema,
  type OpeningStockFormValues,
} from "@/schemas/inventory.schema";
import { inventoryService } from "@/services/inventory.service";

const defaults: OpeningStockFormValues = {
  quantity: "0.000",
  low_stock_threshold: "0.000",
  reason: "",
};

export function OpeningStockDialog({
  open,
  onOpenChange,
  productId,
  productName,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  onSaved: () => void;
}) {
  const [generalError, setGeneralError] = useState<string | null>(null);
  const {
    register,
    reset,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<OpeningStockFormValues>({
    resolver: zodResolver(openingStockSchema),
    defaultValues: defaults,
  });

  useEffect(() => {
    if (open) reset(defaults);
  }, [open, reset]);

  const submit = handleSubmit(async (values) => {
    setGeneralError(null);
    try {
      await inventoryService.openingStock(productId, values);
      onSaved();
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ApiError) {
        Object.entries(error.errors).forEach(([field, messages]) => {
          if (field in defaults) {
            setError(field as keyof OpeningStockFormValues, {
              message: Array.isArray(messages) ? messages[0] : messages,
            });
          }
        });
        setGeneralError(error.message);
      } else setGeneralError("Opening stock could not be configured.");
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Configure opening stock"
      description={`${productName} can only receive opening stock once.`}
    >
      <form className="space-y-4" onSubmit={submit} noValidate>
        {generalError ? <Alert title={generalError} /> : null}
        <FormField label="Opening quantity" htmlFor="opening-quantity" error={errors.quantity?.message}>
          <Input id="opening-quantity" inputMode="decimal" {...register("quantity")} />
        </FormField>
        <FormField label="Low-stock threshold" htmlFor="opening-threshold" error={errors.low_stock_threshold?.message}>
          <Input id="opening-threshold" inputMode="decimal" {...register("low_stock_threshold")} />
        </FormField>
        <FormField label="Reason (optional)" htmlFor="opening-reason" error={errors.reason?.message}>
          <Textarea id="opening-reason" {...register("reason")} />
        </FormField>
        <Alert title="Confirm the physical count before saving." tone="warning">
          Later changes must be recorded as stock movements.
        </Alert>
        <div className="flex justify-end gap-3 border-t border-border pt-4">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>Configure stock</Button>
        </div>
      </form>
    </Dialog>
  );
}
