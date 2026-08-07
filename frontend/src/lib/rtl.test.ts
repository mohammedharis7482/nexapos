import { describe, expect, it } from "vitest";

import { isRtlLanguage, secondaryNameDir } from "./rtl";

describe("isRtlLanguage", () => {
  it("identifies the two RTL languages in the supported set", () => {
    expect(isRtlLanguage("ARABIC")).toBe(true);
    expect(isRtlLanguage("URDU")).toBe(true);
  });

  it("treats the LTR languages as LTR", () => {
    expect(isRtlLanguage("ENGLISH")).toBe(false);
    expect(isRtlLanguage("MALAYALAM")).toBe(false);
    expect(isRtlLanguage("HINDI")).toBe(false);
  });

  it("treats an unset secondary language as LTR", () => {
    expect(isRtlLanguage("")).toBe(false);
    expect(isRtlLanguage(null)).toBe(false);
    expect(isRtlLanguage(undefined)).toBe(false);
  });
});

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
