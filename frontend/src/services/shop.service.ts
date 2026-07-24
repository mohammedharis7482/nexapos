import { apiRequest } from "@/lib/api-client";
import type { ApiSuccess } from "@/types/auth";
import type { ShopSettings, ShopSettingsInput } from "@/types/shop";

export const SHOP_SETTINGS_ENDPOINT = "/shop/settings/";

export const shopService = {
  getSettings() {
    return apiRequest<ApiSuccess<ShopSettings>>(SHOP_SETTINGS_ENDPOINT);
  },
  updateSettings(payload: Partial<ShopSettingsInput>) {
    return apiRequest<ApiSuccess<ShopSettings>>(SHOP_SETTINGS_ENDPOINT, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
};
