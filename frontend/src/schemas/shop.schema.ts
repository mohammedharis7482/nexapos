import { z } from "zod";

const rate = z
  .string()
  .regex(/^\d{1,3}(\.\d{1,2})?$/, "Enter a valid tax rate.")
  .refine((value) => Number(value) <= 100, "Tax rate cannot exceed 100.");

export const shopSettingsSchema = z.object({
  name: z.string().trim().min(1, "Shop name is required.").max(150),
  legal_name: z.string().trim().max(200),
  phone: z.string().trim().min(1, "Phone is required.").max(30),
  email: z.union([z.literal(""), z.email("Enter a valid email.")]),
  address: z.string().trim().min(1, "Address is required."),
  city: z.string().trim().max(100),
  country: z.literal("Qatar"),
  currency: z.literal("QAR"),
  timezone: z.literal("Asia/Qatar"),
  tax_registration_number: z.string().trim().max(50),
  default_tax_rate: rate,
  receipt_footer: z.string(),
});

export type ShopSettingsFormValues = z.infer<typeof shopSettingsSchema>;
