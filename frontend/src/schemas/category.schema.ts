import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Category name is required.").max(120),
  description: z.string().trim(),
  display_order: z
    .number()
    .int("Display order must be a whole number.")
    .min(0, "Display order cannot be negative."),
  is_active: z.boolean(),
});

export type CategoryFormValues = z.infer<typeof categorySchema>;
