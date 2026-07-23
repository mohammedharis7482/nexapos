import { describe, expect, it } from "vitest";

import { resolveProtectedState } from "./protected-boundary";

describe("protected route state", () => {
  it("shows loading while authentication is unresolved", () => {
    expect(resolveProtectedState("loading")).toBe("loading");
  });

  it("redirects unauthenticated visitors", () => {
    expect(resolveProtectedState("unauthenticated")).toBe("redirect");
  });

  it("renders only authenticated content", () => {
    expect(resolveProtectedState("authenticated")).toBe("content");
  });
});
