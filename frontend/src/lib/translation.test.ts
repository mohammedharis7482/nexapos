import { describe, expect, it } from "vitest";

import {
  TRANSLATION_UNAVAILABLE_REASON,
  isTranslationConfigured,
  translateProductName,
} from "./translation";

describe("translation seam", () => {
  it("reports itself unconfigured until a provider is chosen", () => {
    expect(isTranslationConfigured()).toBe(false);
  });

  it("rejects rather than returning a silently wrong translation", async () => {
    await expect(
      translateProductName({ text: "Rice", from: "ENGLISH", to: "ARABIC" }),
    ).rejects.toThrow(TRANSLATION_UNAVAILABLE_REASON);
  });

  it("states a reason the UI can show, never an empty message", () => {
    expect(TRANSLATION_UNAVAILABLE_REASON.trim().length).toBeGreaterThan(0);
  });
});
