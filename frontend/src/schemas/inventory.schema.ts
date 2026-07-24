import { z } from "zod";

import { MANUAL_MOVEMENT_TYPES } from "@/types/inventory";

export const unsignedQuantity = z
  .string()
  .trim()
  .regex(
    /^\d{1,12}(\.\d{1,3})?$/,
    "Enter a non-negative quantity with up to 3 decimals.",
  );

export const positiveQuantity = unsignedQuantity.refine(
  (value) => Number(value) > 0,
  "Quantity must be greater than zero.",
);

export const openingStockSchema = z.object({
  quantity: unsignedQuantity,
  low_stock_threshold: unsignedQuantity,
  reason: z.string().trim().max(500),
});

export const adjustmentSchema = z.object({
  movement_type: z.enum(MANUAL_MOVEMENT_TYPES),
  quantity: positiveQuantity,
  reason: z.string().trim().max(500),
  reference: z.string().trim().max(120),
});

export type OpeningStockFormValues = z.infer<typeof openingStockSchema>;
export type AdjustmentFormValues = z.infer<typeof adjustmentSchema>;
