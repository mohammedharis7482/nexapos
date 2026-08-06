"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Checkbox, FormField, Input, MoneyInput, PercentageInput, Select, Textarea } from "@/components/ui/input";
import { Dialog } from "@/components/ui/overlay";
import { ProductImageField } from "@/components/catalogue/product-image-field";
import {
  ProductPacketsField,
  newPacketDraft,
  type PacketDraft,
} from "@/components/catalogue/product-packets-field";
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

/**
 * Image selection is entirely optional: an untouched picker leaves `file` null
 * and `removeExisting` false, so the save path never calls an image endpoint.
 * `identity` records which (open, product) pair the state belongs to.
 */
interface ImageState {
  identity: string;
  file: File | null;
  existingUrl: string | null;
  removeExisting: boolean;
  error: string | null;
}

/**
 * Multi-pricing is off unless the product already uses it, so an untouched
 * form always posts pricing_mode STANDARD with no packets - byte-identical
 * to what it posted before this feature existed.
 */
interface PricingState {
  identity: string;
  enabled: boolean;
  packets: PacketDraft[];
  error: string | null;
}

function freshPricingState(identity: string, product: Product | null): PricingState {
  const enabled = product?.pricing_mode === "MULTI";
  return {
    identity,
    enabled,
    packets: enabled
      ? (product?.packets ?? []).map((packet) => ({
          key: packet.id,
          size: packet.size,
          price: packet.price,
        }))
      : [],
    error: null,
  };
}

function freshImageState(identity: string, product: Product | null): ImageState {
  return {
    identity,
    file: null,
    existingUrl: product?.image_url ?? null,
    removeExisting: false,
    error: null,
  };
}

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
  onSaved: (product: Product, addStock: boolean) => void;
}) {
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [submitAction, setSubmitAction] = useState<"save" | "stock">("save");
  const [uploadingImage, setUploadingImage] = useState(false);

  // The image picker resets whenever the dialog opens or targets a different
  // product. Adjusting during render keyed on that identity - rather than in
  // the reset effect below - avoids a cascading second render.
  const imageIdentity = `${open}:${product?.id ?? "new"}`;
  const [image, setImage] = useState(() => freshImageState(imageIdentity, product));
  if (image.identity !== imageIdentity) setImage(freshImageState(imageIdentity, product));
  // Packet definitions live outside react-hook-form: they are a variable-length
  // list rather than a fixed set of fields, and they post as a nested array.
  // Reset on the same identity as the image state, for the same reason.
  const [pricing, setPricing] = useState(() => freshPricingState(imageIdentity, product));
  if (pricing.identity !== imageIdentity) setPricing(freshPricingState(imageIdentity, product));
  const {
    register,
    reset,
    watch,
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

  // Packet sizes are entered in the product's own unit, so the field's
  // label has to follow the unit select live rather than the saved value.
  const watchedUnit = watch("unit");

  const persist = async (values: ProductFormValues, addStock: boolean) => {
    setGeneralError(null);
    const packets = pricing.packets.map(({ size, price }) => ({ size, price }));
    if (pricing.enabled) {
      if (!packets.length) {
        setPricing((current) => ({ ...current, error: "Add at least one packet size." }));
        return;
      }
      if (packets.some((packet) => !(Number(packet.size) > 0))) {
        setPricing((current) => ({
          ...current, error: "Every packet needs a size greater than zero.",
        }));
        return;
      }
      if (packets.some((packet) => !(Number(packet.price) >= 0))) {
        setPricing((current) => ({
          ...current, error: "Every packet needs a price.",
        }));
        return;
      }
      const sizes = packets.map((packet) => Number(packet.size));
      if (new Set(sizes).size !== sizes.length) {
        setPricing((current) => ({
          ...current, error: "Each packet size may only be defined once.",
        }));
        return;
      }
    }
    setPricing((current) => ({ ...current, error: null }));
    const payload: ProductInput = {
      ...values,
      category_id: values.category_id || null,
      pricing_mode: pricing.enabled ? "MULTI" : "STANDARD",
      ...(pricing.enabled ? { packets } : {}),
    };
    try {
      const response = product
        ? await productService.update(product.id, payload)
        : await productService.create(payload);

      // The image is a separate sub-resource call, made only when the user
      // actually chose or cleared one. A failure here must not discard the
      // saved product, so it surfaces on the image field and leaves the
      // dialog open rather than throwing away the write that succeeded.
      let saved = response.data;
      if (image.file || image.removeExisting) {
        setUploadingImage(true);
        try {
          const imageResponse = image.file
            ? await productService.uploadImage(saved.id, image.file)
            : await productService.removeImage(saved.id);
          saved = imageResponse.data;
        } catch (imageFailure) {
          setImage((current) => ({
            ...current,
            error:
              imageFailure instanceof ApiError
                ? imageFailure.message
                : "The image could not be uploaded. The product was saved.",
          }));
          onSaved(saved, false);
          return;
        } finally {
          setUploadingImage(false);
        }
      }

      onSaved(saved, !product && addStock);
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
  };
  const submit = handleSubmit((values) => persist(values, false));
  const submitAndAddStock = handleSubmit((values) => persist(values, true));

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
          {!product ? (
            <Button
              type="button"
              variant="secondary"
              loading={isSubmitting && submitAction === "stock"}
              disabled={isSubmitting}
              onClick={() => {
                setSubmitAction("stock");
                void submitAndAddStock();
              }}
            >
              Save &amp; Add Stock
            </Button>
          ) : null}
          <Button
            form="product-form"
            type="submit"
            loading={isSubmitting && submitAction === "save"}
            disabled={isSubmitting}
            onClick={() => {
              setSubmitAction("save");
            }}
          >
            Save Product
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
        <ProductImageField
          existingUrl={image.removeExisting ? null : image.existingUrl}
          categoryName={product?.category?.name}
          productName={product?.name ?? "Product"}
          file={image.file}
          onFileChange={(next) => {
            setImage((current) => ({
              ...current,
              file: next,
              error: null,
              removeExisting: next ? false : current.removeExisting,
            }));
          }}
          onRemoveExisting={() => setImage((current) => ({ ...current, removeExisting: true }))}
          disabled={isSubmitting}
          uploading={uploadingImage}
          error={image.error}
        />
        </fieldset>
        <fieldset className="space-y-4 rounded-xl border border-border bg-surface-secondary/50 p-4">
          <legend className="px-1 text-sm font-bold text-text-primary">Product codes</legend>
          <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="SKU" htmlFor="product-sku" hint="Required shop code; saved in uppercase." error={errors.sku?.message}>
            <Input id="product-sku" invalid={Boolean(errors.sku)} {...register("sku")} />
          </FormField>
          <FormField label="Barcode (optional)" htmlFor="product-barcode" hint="Scan or enter a code, or leave blank. Name and SKU remain searchable." error={errors.barcode?.message}>
            <Input
              id="product-barcode"
              inputMode="numeric"
              invalid={Boolean(errors.barcode)}
              {...register("barcode")}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.preventDefault();
              }}
            />
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
          <FormField label="Unit" htmlFor="product-unit" hint="Kilogram, gram, litre and millilitre support decimal quantities." error={errors.unit?.message}>
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
          <FormField
            label="Selling price"
            htmlFor="selling-price"
            hint={pricing.enabled ? `Price per ${watchedUnit.toLowerCase()} for loose sales.` : undefined}
            error={errors.selling_price?.message}
          >
            <MoneyInput id="selling-price" invalid={Boolean(errors.selling_price)} {...register("selling_price")} />
          </FormField>
        </div>
        <ProductPacketsField
          enabled={pricing.enabled}
          onEnabledChange={(enabled) =>
            setPricing((current) => ({
              ...current,
              enabled,
              // Seed one blank row so the requirement is visible immediately
              // rather than only surfacing as an error on save.
              packets: enabled && !current.packets.length
                ? [newPacketDraft()]
                : current.packets,
              error: null,
            }))
          }
          unit={watchedUnit}
          packets={pricing.packets}
          onPacketsChange={(packets) =>
            setPricing((current) => ({ ...current, packets, error: null }))
          }
          error={pricing.error}
          disabled={isSubmitting}
        />
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
