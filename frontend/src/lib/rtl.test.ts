import { describe, expect, it } from "vitest";

import { secondaryNameDir } from "./rtl";

describe("secondaryNameDir", () => {
  it("returns a direction only when there is text to direct", () => {
    expect(secondaryNameDir("أرز")).toBe("auto");
    expect(secondaryNameDir("Rice")).toBe("auto");
  });

  it("omits the attribute for empty or missing text", () => {
    expect(secondaryNameDir("")).toBeUndefined();
    expect(secondaryNameDir(null)).toBeUndefined();
    expect(secondaryNameDir(undefined)).toBeUndefined();
  });
});
