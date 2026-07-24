import { describe, expect, it } from "vitest";

import { salesCollectionState } from "./page";

describe("sales collection state", () => {
  it("covers loading, empty, error, and ready history states", () => {
    expect(salesCollectionState(true, 0, null)).toBe("loading");
    expect(salesCollectionState(false, 0, null)).toBe("empty");
    expect(salesCollectionState(false, 0, "Failed")).toBe("error");
    expect(salesCollectionState(false, 1, null)).toBe("ready");
  });
});
