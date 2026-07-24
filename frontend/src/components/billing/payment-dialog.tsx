"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CreditCard, Split, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { FormField, Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/overlay";
import { ApiError } from "@/lib/api-client";
import {
  formatCents,
  moneyToCents,
  paymentFormSchema,
  type PaymentFormValues,
} from "@/schemas/payment.schema";
import { billingService } from "@/services/billing.service";
import type { DraftSale } from "@/types/billing";
import type { CompleteSaleRequest } from "@/types/payment";
import type { CompletedSale } from "@/types/sales";

const defaults: PaymentFormValues = {
  mode: "CASH",
  amount_received: "",
  cash_amount: "",
  card_amount: "",
  card_reference: "",
};

export function cashChangePreview(total: string, received: string) {
  const totalCents = moneyToCents(total);
  const receivedCents = moneyToCents(received);
  if (totalCents === null || receivedCents === null) return null;
  return formatCents(receivedCents - totalCents);
}

export function PaymentDialog({
  open,
  onOpenChange,
  draft,
  onCompleted,
  onInventoryConflict,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: DraftSale;
  onCompleted: (sale: CompletedSale) => void;
  onInventoryConflict: () => void;
}) {
  const [generalError, setGeneralError] = useState<string | null>(null);
  const {
    control,
    register,
    reset,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: defaults,
  });
  const mode = useWatch({ control, name: "mode" });
  const amountReceived = useWatch({ control, name: "amount_received" });
  const cashAmount = useWatch({ control, name: "cash_amount" });
  const cardAmount = useWatch({ control, name: "card_amount" });

  useEffect(() => {
    if (open) {
      reset({
        ...defaults,
        amount_received: draft.grand_total,
        card_amount: draft.grand_total,
      });
    }
  }, [draft.grand_total, open, reset]);

  const change = cashChangePreview(
    mode === "SPLIT" ? cashAmount : draft.grand_total,
    amountReceived,
  );
  const splitRemaining = (() => {
    const total = moneyToCents(draft.grand_total);
    const cash = moneyToCents(cashAmount);
    const card = moneyToCents(cardAmount);
    if (total === null || cash === null || card === null) return null;
    return formatCents(total - cash - card);
  })();

  const submit = handleSubmit(async (values) => {
    const totalCents = moneyToCents(draft.grand_total)!;
    const payload: CompleteSaleRequest = { payments: [] };
    if (values.mode === "CASH") {
      const received = moneyToCents(values.amount_received);
      if (received === null || received < totalCents) {
        setError("amount_received", {
          message: "Cash received must cover the grand total.",
        });
        return;
      }
      payload.payments = [{ method: "CASH", amount: draft.grand_total }];
      payload.amount_received = values.amount_received;
    } else if (values.mode === "CARD") {
      payload.payments = [
        {
          method: "CARD",
          amount: draft.grand_total,
          reference: values.card_reference,
        },
      ];
    } else {
      const cash = moneyToCents(values.cash_amount);
      const card = moneyToCents(values.card_amount);
      const received = moneyToCents(values.amount_received);
      if (cash === null || card === null || cash + card !== totalCents) {
        setError("card_amount", {
          message: "Cash and card allocations must equal the grand total.",
        });
        return;
      }
      if (received === null || received < cash) {
        setError("amount_received", {
          message: "Cash received must cover the cash allocation.",
        });
        return;
      }
      payload.payments = [
        { method: "CASH", amount: values.cash_amount },
        {
          method: "CARD",
          amount: values.card_amount,
          reference: values.card_reference,
        },
      ];
      payload.amount_received = values.amount_received;
    }

    setGeneralError(null);
    try {
      const response = await billingService.complete(draft.id, payload);
      onCompleted(response.data);
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ApiError) {
        const inventoryConflict = "inventory" in error.errors;
        if (inventoryConflict) {
          setGeneralError(
            "Stock changed before payment. Review the cart quantities and try again.",
          );
          onInventoryConflict();
        } else {
          setGeneralError(error.message);
        }
        Object.entries(error.errors).forEach(([field, messages]) => {
          if (field === "amount_received") {
            setError("amount_received", {
              message: Array.isArray(messages) ? messages[0] : messages,
            });
          }
        });
      } else setGeneralError("The sale could not be completed.");
    }
  });

  const methods = [
    { value: "CASH", label: "Cash", icon: WalletCards },
    { value: "CARD", label: "Card", icon: CreditCard },
    { value: "SPLIT", label: "Split", icon: Split },
  ] as const;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setGeneralError(null);
        onOpenChange(next);
      }}
      title="Complete payment"
      description={`${draft.items.length} line items · QAR ${draft.grand_total}`}
    >
      <form className="space-y-5" onSubmit={submit} noValidate>
        {generalError ? <Alert title={generalError} /> : null}
        <div className="grid grid-cols-3 gap-2">
          {methods.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setValue("mode", value)}
              className={`min-h-20 rounded-xl border p-2 text-sm font-semibold ${
                mode === value
                  ? "border-primary bg-primary-soft text-primary"
                  : "border-border bg-surface"
              }`}
            >
              <Icon className="mx-auto mb-1 size-5" />
              {label}
            </button>
          ))}
        </div>

        <div className="rounded-xl bg-surface-secondary p-4">
          <div className="flex justify-between text-sm"><span>Subtotal</span><strong>QAR {draft.subtotal}</strong></div>
          <div className="mt-2 flex justify-between text-sm"><span>Tax</span><strong>QAR {draft.tax_total}</strong></div>
          <div className="mt-3 flex justify-between border-t border-border pt-3 text-lg"><strong>Grand total</strong><strong>QAR {draft.grand_total}</strong></div>
        </div>

        {mode === "CASH" || mode === "SPLIT" ? (
          <>
            {mode === "SPLIT" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Cash allocation" htmlFor="cash-allocation" error={errors.cash_amount?.message}>
                  <Input id="cash-allocation" inputMode="decimal" {...register("cash_amount")} />
                </FormField>
                <FormField label="Card allocation" htmlFor="card-allocation" error={errors.card_amount?.message}>
                  <Input id="card-allocation" inputMode="decimal" {...register("card_amount")} />
                </FormField>
                <p className="sm:col-span-2 text-sm text-text-muted">
                  Remaining: QAR {splitRemaining ?? "—"}
                </p>
              </div>
            ) : null}
            <FormField label="Cash received" htmlFor="cash-received" error={errors.amount_received?.message}>
              <Input id="cash-received" inputMode="decimal" {...register("amount_received")} />
            </FormField>
            <div className="flex flex-wrap gap-2">
              {[draft.grand_total, "10.00", "20.00", "50.00", "100.00"].map((amount, index) => (
                <Button key={`${amount}-${index}`} variant="secondary" onClick={() => setValue("amount_received", amount)}>
                  {index === 0 ? "Exact" : `QAR ${amount}`}
                </Button>
              ))}
            </div>
            <p className="rounded-xl bg-success-soft p-3 text-sm font-semibold text-success">
              Expected change: QAR {change !== null && Number(change) >= 0 ? change : "—"}
            </p>
          </>
        ) : null}

        {mode === "CARD" || mode === "SPLIT" ? (
          <>
            <FormField label="Terminal reference (optional)" htmlFor="card-reference" error={errors.card_reference?.message}>
              <Input id="card-reference" {...register("card_reference")} />
            </FormField>
            <Alert title="External terminal recording" tone="warning">
              NexaPOS records the result only. Never enter a card number, CVV, or expiry.
            </Alert>
          </>
        ) : null}

        <div className="flex justify-end gap-3 border-t border-border pt-4">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Back</Button>
          <Button type="submit" loading={isSubmitting}>Confirm payment</Button>
        </div>
      </form>
    </Dialog>
  );
}
