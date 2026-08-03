import { beforeEach, describe, expect, it } from "vitest";

import { getCsrfToken, setCsrfToken } from "./csrf";

describe("csrf token store", () => {
  beforeEach(() => {
    setCsrfToken(null);
  });

  it("starts empty and holds whatever is set", () => {
    expect(getCsrfToken()).toBeNull();
    setCsrfToken("abc123");
    expect(getCsrfToken()).toBe("abc123");
  });

  it("can be cleared back to null", () => {
    setCsrfToken("abc123");
    setCsrfToken(null);
    expect(getCsrfToken()).toBeNull();
  });

  it("never reads from or is backed by document.cookie", () => {
    document.cookie = "csrftoken=cookie-value; path=/";
    expect(getCsrfToken()).toBeNull();
    setCsrfToken("memory-value");
    expect(getCsrfToken()).toBe("memory-value");
    expect(getCsrfToken()).not.toBe("cookie-value");
    document.cookie = "csrftoken=; Max-Age=0; path=/";
  });
});
