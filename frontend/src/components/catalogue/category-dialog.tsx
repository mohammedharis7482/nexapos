"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { FormField, Input, Textarea } from "@/components/ui/input";
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
        if (nameError) {
          setError("name", {
            message: Array.isArray(nameError) ? nameError[0] : nameError,
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
    >
      <form className="space-y-4" onSubmit={submit} noValidate>
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
        <label className="flex min-h-11 items-center gap-3 text-sm text-text-secondary">
          <input type="checkbox" className="size-4 accent-primary" {...register("is_active")} />
          Active category
        </label>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>
            {category ? "Save category" : "Add category"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
