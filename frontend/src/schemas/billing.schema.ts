import { z } from "zod";

export const billingQuantity = z
  .string()
  .trim()
  .regex(/^\d{1,12}(\.\d{1,3})?$/, "Enter a quantity with up to 3 decimals.")
  .refine((value) => Number(value) > 0, "Quantity must be greater than zero.");

export const addDraftItemSchema = z
  .object({
    product_id: z.string().uuid().optional(),
    barcode: z.string().trim().min(1).optional(),
    quantity: billingQuantity,
  })
  .refine(
    (value) => Boolean(value.product_id) !== Boolean(value.barcode),
    "Supply either a product or barcode.",
  );

export const updateDraftItemSchema = z.object({
  quantity: billingQuantity,
});
