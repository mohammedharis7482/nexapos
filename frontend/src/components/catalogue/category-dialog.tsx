"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Checkbox, FormField, Input, Textarea } from "@/components/ui/input";
import { Dialog } from "@/components/ui/overlay";
import { ApiError } from "@/lib/api-client";
import {
  categorySchema,
  type CategoryFormValues,
} from "@/schemas/category.schema";
import { categoryService } from "@/services/category.service";
import type { ProductCategory } from "@/types/category";

export function CategoryDialog({
  open,
  onOpenChange,
  category,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: ProductCategory | null;
  onSaved: () => void;
}) {
  const [generalError, setGeneralError] = useState<string | null>(null);
  const {
    register,
    reset,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: "",
      description: "",
      display_order: 0,
      is_active: true,
    },
  });

  useEffect(() => {
    reset(
      category
        ? {
            name: category.name,
            description: category.description,
            display_order: category.display_order,
            is_active: category.is_active,
          }
        : {
            name: "",
            description: "",
            display_order: 0,
            is_active: true,
          },
    );
  }, [category, open, reset]);

  const submit = handleSubmit(async (values) => {
    setGeneralError(null);
    try {
      if (category) await categoryService.update(category.id, values);
      else await categoryService.create(values);
      onSaved();
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ApiError) {
        const nameError =
          "name" in error.errors ? error.errors.name : undefined;
        const nameMessage =
          typeof nameError === "string"
            ? nameError
            : Array.isArray(nameError) && typeof nameError[0] === "string"
              ? nameError[0]
              : undefined;
        if (nameMessage) {
          setError("name", {
            message: nameMessage,
          });
        }
        setGeneralError(error.status === 403 ? "Owner access is required." : error.message);
      } else {
        setGeneralError("The category could not be saved.");
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
      title={category ? "Edit category" : "Add category"}
      description="Categories organize products without affecting stock."
      size="small"
      dismissible={!isSubmitting}
      footer={
        <>
          <Button variant="secondary" disabled={isSubmitting} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button form="category-form" type="submit" loading={isSubmitting}>
            {category ? "Save category" : "Add category"}
          </Button>
        </>
      }
    >
      <form id="category-form" className="space-y-4" onSubmit={submit} noValidate>
        {generalError ? <Alert title={generalError} /> : null}
        <FormField label="Category name" htmlFor="category-name" error={errors.name?.message}>
          <Input
            id="category-name"
            invalid={Boolean(errors.name)}
            {...register("name")}
          />
        </FormField>
        <FormField label="Description" htmlFor="category-description" error={errors.description?.message}>
          <Textarea id="category-description" {...register("description")} />
        </FormField>
        <FormField label="Display order" htmlFor="category-order" error={errors.display_order?.message}>
          <Input
            id="category-order"
            type="number"
            min="0"
            inputMode="numeric"
            invalid={Boolean(errors.display_order)}
            {...register("display_order", { valueAsNumber: true })}
          />
        </FormField>
        <Checkbox label="Active category" description="Active categories are available when organizing products." {...register("is_active")} />
      </form>
    </Dialog>
  );
}
