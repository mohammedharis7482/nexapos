"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";

import { settingsAccessMode } from "@/components/catalogue/access";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/display";
import { Alert, ErrorState, Skeleton } from "@/components/ui/feedback";
import { FormField, Input, Textarea } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import {
  shopSettingsSchema,
  type ShopSettingsFormValues,
} from "@/schemas/shop.schema";
import { shopService } from "@/services/shop.service";

export default function SettingsPage() {
  const { user } = useAuth();
  const mode = settingsAccessMode(user?.role ?? "CASHIER");
  const initialized = useRef(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    reset,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ShopSettingsFormValues>({
    resolver: zodResolver(shopSettingsSchema),
  });

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await shopService.getSettings();
      reset(response.data);
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : "Shop settings could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [reset]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    void load();
  }, [load]);

  const submit = handleSubmit(async (values) => {
    setSuccess(false);
    setSubmitError(null);
    try {
      const response = await shopService.updateSettings(values);
      reset(response.data);
      setSuccess(true);
    } catch (error) {
      if (error instanceof ApiError) {
        Object.entries(error.errors).forEach(([field, messages]) => {
          if (field in shopSettingsSchema.shape) {
            setError(field as keyof ShopSettingsFormValues, {
              message: Array.isArray(messages) ? messages[0] : messages,
            });
          }
        });
        setSubmitError(error.status === 403 ? "Owner access is required." : error.message);
      } else setSubmitError("Shop settings could not be saved.");
    }
  });

  if (loading) {
    return <div className="space-y-5"><Skeleton className="h-10 w-64" /><Skeleton className="h-96 w-full" /></div>;
  }
  if (loadError) {
    return <ErrorState title="Settings unavailable" description={loadError} onRetry={() => void load()} />;
  }

  const disabled = mode === "readonly";
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Administration"
        title="Shop settings"
        description={disabled ? "You can view your shop profile. Only owners can make changes." : "Manage the profile printed and displayed across NexaPOS."}
      />
      {disabled ? <Alert title="Read-only access" tone="warning">Ask a shop owner to update these settings.</Alert> : null}
      {success ? <Alert title="Shop settings saved." tone="success" /> : null}
      {submitError ? <Alert title={submitError} /> : null}
      <Card className="max-w-5xl p-5 sm:p-7">
        <form onSubmit={submit} className="space-y-6" noValidate>
          <section className="space-y-5" aria-labelledby="business-details-heading">
          <div>
            <h2 id="business-details-heading" className="font-bold">Business details</h2>
            <p className="mt-1 text-sm text-text-muted">The identity displayed throughout NexaPOS and on receipts.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <FormField label="Shop name" htmlFor="shop-name" error={errors.name?.message}>
              <Input id="shop-name" disabled={disabled} {...register("name")} />
            </FormField>
            <FormField label="Legal name" htmlFor="legal-name" error={errors.legal_name?.message}>
              <Input id="legal-name" disabled={disabled} {...register("legal_name")} />
            </FormField>
            <FormField label="Phone" htmlFor="shop-phone" error={errors.phone?.message}>
              <Input id="shop-phone" disabled={disabled} {...register("phone")} />
            </FormField>
            <FormField label="Email" htmlFor="shop-email" error={errors.email?.message}>
              <Input id="shop-email" type="email" disabled={disabled} {...register("email")} />
            </FormField>
          </div>
          </section>
          <section className="space-y-5 border-t border-border pt-6" aria-labelledby="contact-heading">
          <div>
            <h2 id="contact-heading" className="font-bold">Contact and address</h2>
            <p className="mt-1 text-sm text-text-muted">Customer-facing contact information for your shop.</p>
          </div>
          <FormField label="Address" htmlFor="shop-address" error={errors.address?.message}>
            <Textarea id="shop-address" disabled={disabled} {...register("address")} />
          </FormField>
          <div className="grid gap-5 md:grid-cols-2">
            <FormField label="City" htmlFor="shop-city" error={errors.city?.message}>
              <Input id="shop-city" disabled={disabled} {...register("city")} />
            </FormField>
          </div>
          </section>
          <section className="space-y-5 border-t border-border pt-6" aria-labelledby="regional-heading">
          <div>
            <h2 id="regional-heading" className="font-bold">Regional and tax settings</h2>
            <p className="mt-1 text-sm text-text-muted">Qatar regional values and receipt tax identity.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <FormField label="Country" htmlFor="shop-country" error={errors.country?.message}>
              <Input id="shop-country" readOnly aria-readonly="true" {...register("country")} />
            </FormField>
            <FormField label="Currency" htmlFor="shop-currency" error={errors.currency?.message}>
              <Input id="shop-currency" readOnly aria-readonly="true" {...register("currency")} />
            </FormField>
            <FormField label="Timezone" htmlFor="shop-timezone" error={errors.timezone?.message}>
              <Input id="shop-timezone" readOnly aria-readonly="true" {...register("timezone")} />
            </FormField>
            <FormField label="Tax registration number" htmlFor="shop-trn" error={errors.tax_registration_number?.message}>
              <Input id="shop-trn" disabled={disabled} {...register("tax_registration_number")} />
            </FormField>
            <FormField label="Default tax rate %" htmlFor="default-tax" error={errors.default_tax_rate?.message}>
              <Input id="default-tax" inputMode="decimal" disabled={disabled} {...register("default_tax_rate")} />
            </FormField>
          </div>
          </section>
          <section className="space-y-5 border-t border-border pt-6" aria-labelledby="receipt-heading">
          <div>
            <h2 id="receipt-heading" className="font-bold">Receipt settings</h2>
            <p className="mt-1 text-sm text-text-muted">A short message printed at the bottom of customer receipts.</p>
          </div>
          <FormField label="Receipt footer" htmlFor="receipt-footer" error={errors.receipt_footer?.message}>
            <Textarea id="receipt-footer" disabled={disabled} {...register("receipt_footer")} />
          </FormField>
          </section>
          {!disabled ? (
            <div className="sticky bottom-[calc(var(--mobile-nav-height)+env(safe-area-inset-bottom))] -mx-5 flex justify-end border-t border-border bg-surface/95 px-5 pt-4 backdrop-blur-sm sm:-mx-7 sm:px-7 lg:bottom-0">
              <Button type="submit" loading={isSubmitting} leadingIcon={<Save className="size-4" />}>Save settings</Button>
            </div>
          ) : null}
        </form>
      </Card>
    </div>
  );
}
