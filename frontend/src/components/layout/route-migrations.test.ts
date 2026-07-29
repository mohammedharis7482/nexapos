import { describe, expect, it } from "vitest";

import { compatibilityRedirects } from "../../../next.config";

describe("navigation compatibility routes", () => {
  it("redirects legacy shift and team URLs to canonical parent modules", () => {
    expect(compatibilityRedirects).toEqual([
      { source: "/shift", destination: "/sales/shifts/current", permanent: false },
      { source: "/current-shift", destination: "/sales/shifts/current", permanent: false },
      { source: "/shifts", destination: "/sales/shifts", permanent: false },
      { source: "/team", destination: "/settings/team", permanent: false },
    ]);
    expect(compatibilityRedirects.every(({ source, destination }) => source !== destination)).toBe(true);
  });
});
