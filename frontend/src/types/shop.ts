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
  tax_registration_number: string;
  default_tax_rate: string;
  receipt_footer: string;
  logo: string | null;
  is_active: boolean;
}

export type ShopSettingsInput = Omit<ShopSettings, "id" | "logo" | "is_active">;
