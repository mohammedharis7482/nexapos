"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { FormField, QuantityInput, Textarea } from "@/components/ui/input";
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
  productSku,
  unit,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  productSku?: string;
  unit?: string;
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
      description={`${productName}${productSku ? ` · ${productSku}` : ""} · ${unit ?? "unit"} · Not initialized`}
      dismissible={!isSubmitting}
      footer={
        <>
          <Button variant="secondary" disabled={isSubmitting} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button form="opening-stock-form" type="submit" loading={isSubmitting}>Initialize stock</Button>
        </>
      }
    >
      <form id="opening-stock-form" className="space-y-4" onSubmit={submit} noValidate>
        {generalError ? <Alert title={generalError} /> : null}
        <FormField label="Opening quantity" htmlFor="opening-quantity" error={errors.quantity?.message}>
          <QuantityInput id="opening-quantity" unit={unit} invalid={Boolean(errors.quantity)} {...register("quantity")} />
        </FormField>
        <FormField label="Low-stock threshold" htmlFor="opening-threshold" error={errors.low_stock_threshold?.message}>
          <QuantityInput id="opening-threshold" unit={unit} invalid={Boolean(errors.low_stock_threshold)} {...register("low_stock_threshold")} />
        </FormField>
        <FormField label="Reason (optional)" htmlFor="opening-reason" error={errors.reason?.message}>
          <Textarea id="opening-reason" {...register("reason")} />
        </FormField>
        <Alert title="Confirm the physical count before saving." tone="warning">
          Later changes must be recorded as stock movements.
        </Alert>
      </form>
    </Dialog>
  );
}
