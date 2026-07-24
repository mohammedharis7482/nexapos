import { describe, expect, it } from "vitest";

import { inventoryCollectionState } from "./page";

describe("inventory collection state", () => {
  it("covers loading, empty, error, and ready states", () => {
    expect(inventoryCollectionState(true, 0, null)).toBe("loading");
    expect(inventoryCollectionState(false, 0, null)).toBe("empty");
    expect(inventoryCollectionState(false, 0, "Failed")).toBe("error");
    expect(inventoryCollectionState(false, 2, null)).toBe("ready");
  });
});
