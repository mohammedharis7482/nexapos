import { z } from "zod";

const money = z
  .string()
  .trim()
  .regex(/^\d{1,10}(\.\d{1,2})?$/, "Enter a valid QAR amount.");
const optionalMoney = z.union([money, z.literal("")]);

export const paymentFormSchema = z
  .object({
    mode: z.enum(["CASH", "CARD", "SPLIT"]),
    amount_received: optionalMoney,
    cash_amount: optionalMoney,
    card_amount: optionalMoney,
    card_reference: z.string().trim().max(120),
  })
  .superRefine((value, context) => {
    if (value.mode === "CASH" && Number(value.amount_received) <= 0) {
      context.addIssue({
        code: "custom",
        path: ["amount_received"],
        message: "Enter the cash amount received.",
      });
    }
    if (value.mode === "SPLIT") {
      if (Number(value.cash_amount) <= 0) {
        context.addIssue({
          code: "custom",
          path: ["cash_amount"],
          message: "Cash allocation must be greater than zero.",
        });
      }
      if (Number(value.card_amount) <= 0) {
        context.addIssue({
          code: "custom",
          path: ["card_amount"],
          message: "Card allocation must be greater than zero.",
        });
      }
    }
  });

export type PaymentFormValues = z.infer<typeof paymentFormSchema>;

export function moneyToCents(value: string) {
  if (!/^\d+(\.\d{0,2})?$/.test(value)) return null;
  const [whole, decimal = ""] = value.split(".");
  return Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
}

export function formatCents(value: number) {
  return (value / 100).toFixed(2);
}
