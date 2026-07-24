import { describe, expect, it } from "vitest";

import { canManageCatalogue, settingsAccessMode } from "./access";
import { productCollectionState } from "@/app/(protected)/products/page";

describe("catalogue role and list states", () => {
  it("allows only owners to manage catalogue data", () => {
    expect(canManageCatalogue("OWNER")).toBe(true);
    expect(canManageCatalogue("CASHIER")).toBe(false);
  });

  it("makes settings editable for owners and read-only for cashiers", () => {
    expect(settingsAccessMode("OWNER")).toBe("editable");
    expect(settingsAccessMode("CASHIER")).toBe("readonly");
  });

  it("distinguishes loading, empty, error, and ready product lists", () => {
    expect(productCollectionState(true, 0, null)).toBe("loading");
    expect(productCollectionState(false, 0, null)).toBe("empty");
    expect(productCollectionState(false, 0, "Unavailable")).toBe("error");
    expect(productCollectionState(false, 2, null)).toBe("ready");
  });
});
