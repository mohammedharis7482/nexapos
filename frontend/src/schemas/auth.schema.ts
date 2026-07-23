import { z } from "zod";

export const loginSchema = z.object({
  shop_id: z.uuid("Enter a valid Shop ID."),
  username: z
    .string()
    .trim()
    .min(1, "Username is required.")
    .max(150, "Username is too long."),
  password: z.string().min(1, "Password is required."),
  remember_shop: z.boolean(),
});

export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, "Current password is required."),
    new_password: z
      .string()
      .min(8, "New password must contain at least 8 characters."),
    confirm_password: z.string().min(1, "Confirm the new password."),
  })
  .refine((values) => values.new_password === values.confirm_password, {
    message: "The new passwords do not match.",
    path: ["confirm_password"],
  });

export type LoginFormValues = z.infer<typeof loginSchema>;
export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;
