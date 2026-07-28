"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Checkbox, FormField, Input, MoneyInput, PercentageInput, Select, Textarea } from "@/components/ui/input";
import { Dialog } from "@/components/ui/overlay";
import { ApiError } from "@/lib/api-client";
import {
  productSchema,
  type ProductFormValues,
} from "@/schemas/product.schema";
import { productService } from "@/services/product.service";
import type { ProductCategory } from "@/types/category";
import {
  PRODUCT_UNITS,
  type Product,
  type ProductInput,
} from "@/types/product";

const defaults: ProductFormValues = {
  name: "",
  description: "",
  sku: "",
  barcode: "",
  unit: "PIECE",
  purchase_price: "0.00",
  selling_price: "",
  tax_rate: "0.00",
  is_tax_inclusive: false,
  is_active: true,
  category_id: "",
};

export function ProductDialog({
  open,
  onOpenChange,
  product,
  categories,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  categories: ProductCategory[];
  onSaved: () => void;
}) {
  const [generalError, setGeneralError] = useState<string | null>(null);
  const {
    register,
    reset,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: defaults,
  });

  useEffect(() => {
    reset(
      product
        ? {
            name: product.name,
            description: product.description,
            sku: product.sku,
            barcode: product.barcode ?? "",
            unit: product.unit,
            purchase_price: product.purchase_price,
            selling_price: product.selling_price,
            tax_rate: product.tax_rate,
            is_tax_inclusive: product.is_tax_inclusive,
            is_active: product.is_active,
            category_id: product.category?.id ?? "",
          }
        : defaults,
    );
  }, [open, product, reset]);

  const submit = handleSubmit(async (values) => {
    setGeneralError(null);
    const payload: ProductInput = {
      ...values,
      category_id: values.category_id || null,
    };
    try {
      if (product) await productService.update(product.id, payload);
      else await productService.create(payload);
      onSaved();
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ApiError) {
        Object.entries(error.errors).forEach(([field, messages]) => {
          if (field in defaults) {
            setError(field as keyof ProductFormValues, {
              message: Array.isArray(messages) ? messages[0] : messages,
            });
          }
        });
        setGeneralError(error.status === 403 ? "Owner access is required." : error.message);
      } else {
        setGeneralError("The product could not be saved.");
      }
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setGeneralError(null);
        onOpenChange(next);
      }}
      title={product ? "Edit product" : "Add product"}
      description="Catalogue details only. Stock quantities are managed separately."
      size="large"
      dismissible={!isSubmitting}
      footer={
        <>
          <Button variant="secondary" disabled={isSubmitting} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button form="product-form" type="submit" loading={isSubmitting}>
            {product ? "Save product" : "Add product"}
          </Button>
        </>
      }
    >
      <form id="product-form" className="space-y-6" onSubmit={submit} noValidate>
        {generalError ? <Alert title={generalError} /> : null}
        <fieldset className="space-y-4 rounded-xl border border-border bg-surface-secondary/50 p-4">
          <legend className="px-1 text-sm font-bold text-text-primary">Basic information</legend>
        <FormField label="Product name" htmlFor="product-name" error={errors.name?.message}>
          <Input id="product-name" invalid={Boolean(errors.name)} {...register("name")} />
        </FormField>
        <FormField label="Description" htmlFor="product-description" error={errors.description?.message}>
          <Textarea id="product-description" {...register("description")} />
        </FormField>
        </fieldset>
        <fieldset className="space-y-4 rounded-xl border border-border bg-surface-secondary/50 p-4">
          <legend className="px-1 text-sm font-bold text-text-primary">Product codes</legend>
          <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="SKU" htmlFor="product-sku" error={errors.sku?.message}>
            <Input id="product-sku" invalid={Boolean(errors.sku)} {...register("sku")} />
          </FormField>
          <FormField label="Barcode" htmlFor="product-barcode" error={errors.barcode?.message}>
            <Input id="product-barcode" inputMode="numeric" invalid={Boolean(errors.barcode)} {...register("barcode")} />
          </FormField>
        </div>
        </fieldset>
        <fieldset className="space-y-4 rounded-xl border border-border bg-surface-secondary/50 p-4">
          <legend className="px-1 text-sm font-bold text-text-primary">Classification and unit</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Category" htmlFor="product-category" error={errors.category_id?.message}>
            <Select id="product-category" invalid={Boolean(errors.category_id)} {...register("category_id")}>
              <option value="">Uncategorized</option>
              {categories.filter((category) => category.is_active || category.id === product?.category?.id).map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Unit" htmlFor="product-unit" error={errors.unit?.message}>
            <Select id="product-unit" invalid={Boolean(errors.unit)} {...register("unit")}>
              {PRODUCT_UNITS.map((unit) => <option key={unit} value={unit}>{unit.replaceAll("_", " ")}</option>)}
            </Select>
          </FormField>
        </div>
        </fieldset>
        <fieldset className="space-y-4 rounded-xl border border-border bg-surface-secondary/50 p-4">
          <legend className="px-1 text-sm font-bold text-text-primary">Pricing</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Purchase price" htmlFor="purchase-price" error={errors.purchase_price?.message}>
            <MoneyInput id="purchase-price" invalid={Boolean(errors.purchase_price)} {...register("purchase_price")} />
          </FormField>
          <FormField label="Selling price" htmlFor="selling-price" error={errors.selling_price?.message}>
            <MoneyInput id="selling-price" invalid={Boolean(errors.selling_price)} {...register("selling_price")} />
          </FormField>
        </div>
        </fieldset>
        <fieldset className="space-y-4 rounded-xl border border-border bg-surface-secondary/50 p-4">
          <legend className="px-1 text-sm font-bold text-text-primary">Tax configuration</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Tax rate %" htmlFor="tax-rate" error={errors.tax_rate?.message}>
              <PercentageInput id="tax-rate" invalid={Boolean(errors.tax_rate)} {...register("tax_rate")} />
            </FormField>
          <Checkbox label="Price includes tax" {...register("is_tax_inclusive")} />
          </div>
        </fieldset>
        <fieldset className="space-y-3 rounded-xl border border-border bg-surface-secondary/50 p-4">
          <legend className="px-1 text-sm font-bold text-text-primary">Availability</legend>
          <Checkbox label="Active product" {...register("is_active")} />
        </fieldset>
      </form>
    </Dialog>
  );
}
