/**
 * Translation seam - the single call site a provider can be dropped into.
 *
 * Nothing is integrated. There is deliberately no provider SDK in the
 * dependency list and no API key setting, so an unhosted app makes no network
 * calls and incurs no per-call cost. `translateProductName` is the only
 * function a future provider needs to implement; nothing else in the app
 * should learn a provider's name or shape.
 *
 * The UI must never present this as working while it is not: callers check
 * `isTranslationConfigured()` and disable the control with a visible reason.
 */

import type { ShopLanguage } from "@/types/shop";

/** What a provider receives. Languages are our own codes, not a vendor's. */
export interface TranslationRequest {
  text: string;
  from: ShopLanguage;
  to: ShopLanguage;
}

/** What a provider must return. `text` is the translated string, nothing else. */
export interface TranslationResult {
  text: string;
}

/**
 * Whether a provider is wired up. Hard-coded false until one is chosen -
 * intentionally not a settings flag or env var, because adding either would
 * imply a provider exists and invite half-configured states.
 */
export function isTranslationConfigured(): boolean {
  return false;
}

/** Shown on the disabled control so the state is explained, never silent. */
export const TRANSLATION_UNAVAILABLE_REASON = "Translation service not yet connected";

/**
 * The seam. A provider implementation replaces this body; every caller and
 * the request/result shapes above stay unchanged.
 */
export async function translateProductName(
  request: TranslationRequest,
): Promise<TranslationResult> {
  throw new Error(
    `${TRANSLATION_UNAVAILABLE_REASON}: cannot translate "${request.text}" from ${request.from} to ${request.to}.`,
  );
}
