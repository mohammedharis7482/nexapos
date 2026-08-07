/** The supported set for second-language product/category names, mirroring
 *  Shop.Language on the backend. Applies to product and category names only -
 *  app UI chrome stays English. */
export const SHOP_LANGUAGES = [
  "ENGLISH",
  "ARABIC",
  "MALAYALAM",
  "HINDI",
  "URDU",
] as const;
export type ShopLanguage = (typeof SHOP_LANGUAGES)[number];

export const SHOP_LANGUAGE_LABELS: Record<ShopLanguage, string> = {
  ENGLISH: "English",
  ARABIC: "Arabic",
  MALAYALAM: "Malayalam",
  HINDI: "Hindi",
  URDU: "Urdu",
};

export interface ShopSettings {
  id: string;
  name: string;
  legal_name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  country: "Qatar";
  currency: "QAR";
  timezone: "Asia/Qatar";
  primary_language: ShopLanguage;
  /** Empty means the shop has not opted into second-language names. */
  secondary_language: ShopLanguage | "";
  tax_registration_number: string;
  default_tax_rate: string;
  receipt_footer: string;
  logo: string | null;
  is_active: boolean;
}

export type ShopSettingsInput = Omit<ShopSettings, "id" | "logo" | "is_active">;
