"use client";

import { Languages } from "lucide-react";
import type { UseFormRegisterReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FormField, Input } from "@/components/ui/input";
import {
  TRANSLATION_UNAVAILABLE_REASON,
  isTranslationConfigured,
} from "@/lib/translation";
import { SHOP_LANGUAGE_LABELS } from "@/types/shop";
import type { ShopLanguage } from "@/types/shop";

/**
 * Optional second-language name input, plus the translate seam's control.
 *
 * Uses the same FormField/Input styling as every other field in the product
 * and category forms - no new visual pattern. The field is optional
 * throughout: leaving it blank behaves exactly as before this feature existed.
 *
 * The input carries `dir` so Arabic and Urdu render correctly. That is the
 * entire RTL surface here; nothing about the surrounding layout changes.
 */
export function SecondaryNameField({
  id,
  registration,
  secondaryLanguage,
  error,
  disabled,
}: {
  id: string;
  /** Spread from react-hook-form's register(); the field is uncontrolled so
   *  the form owns its value and no watch() subscription is needed. */
  registration: UseFormRegisterReturn;
  /** Empty when the shop has not chosen a second language. */
  secondaryLanguage: ShopLanguage | "";
  error?: string;
  disabled?: boolean;
}) {
  // Without a shop-level second language there is nothing to name, so the
  // field stays hidden rather than prompting for text nobody will read.
  if (!secondaryLanguage) return null;

  const languageLabel = SHOP_LANGUAGE_LABELS[secondaryLanguage];
  const translationReady = isTranslationConfigured();

  return (
    <div className="space-y-1.5">
      {/* FormField clones exactly one child, so the Input stays that child and
          keeps its aria-describedby/aria-invalid wiring. */}
      <FormField
        label={`Name in ${languageLabel} (optional)`}
        htmlFor={id}
        hint="Shown in billing search and on receipts. Leave blank to use the primary name everywhere."
        error={error}
      >
        {/* dir="auto" re-evaluates as the user types, so switching between
            Arabic and Latin script inside the field just works. This attribute
            is the entire RTL surface here. */}
        <Input
          id={id}
          dir="auto"
          lang={secondaryLanguage.toLowerCase()}
          disabled={disabled}
          invalid={Boolean(error)}
          {...registration}
        />
      </FormField>
      <div className="flex flex-wrap items-center gap-2">
        {/* Disabled with a visible reason rather than inert-but-clickable: the
            control must never look functional while no provider exists. */}
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={!translationReady || disabled}
          title={translationReady ? undefined : TRANSLATION_UNAVAILABLE_REASON}
          leadingIcon={<Languages className="size-4" />}
        >
          Translate
        </Button>
        {!translationReady ? (
          <span className="text-xs text-text-muted">
            {TRANSLATION_UNAVAILABLE_REASON}
          </span>
        ) : null}
      </div>
    </div>
  );
}
