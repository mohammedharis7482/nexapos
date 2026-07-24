import { z } from "zod";

import { PRODUCT_UNITS } from "@/types/product";

const money = z
  .string()
  .regex(/^\d{1,10}(\.\d{1,2})?$/, "Enter a non-negative amount with up to 2 decimals.");
const taxRate = z
  .string()
  .regex(/^\d{1,3}(\.\d{1,2})?$/, "Enter a valid tax rate.")
  .refine((value) => Number(value) <= 100, "Tax rate cannot exceed 100.");

export const productSchema = z.object({
  name: z.string().trim().min(1, "Product name is required.").max(200),
  description: z.string().trim(),
  sku: z.string().trim().min(1, "SKU is required.").max(80),
  barcode: z.string().trim().max(80),
  unit: z.enum(PRODUCT_UNITS),
  purchase_price: money,
  selling_price: money,
  tax_rate: taxRate,
  is_tax_inclusive: z.boolean(),
  is_active: z.boolean(),
  category_id: z.union([z.literal(""), z.uuid()]),
});

export type ProductFormValues = z.infer<typeof productSchema>;
