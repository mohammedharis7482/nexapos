import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import manifest from "./manifest";

const SRC = join(process.cwd(), "src");
const PUBLIC = join(process.cwd(), "public");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx|js|jsx|mjs)$/.test(entry) ? [full] : [];
  });
}

describe("web app manifest", () => {
  it("declares what Android and Chrome need to offer installation", () => {
    const value = manifest();
    expect(value.name).toBe("NexaPOS");
    expect(value.short_name).toBeTruthy();
    expect(value.start_url).toBeTruthy();
    expect(value.display).toBe("standalone");
    expect(value.theme_color).toBe("#2563eb");
  });

  it("ships the 192 and 512 icons Chrome requires, plus a maskable variant", () => {
    const icons = manifest().icons ?? [];
    const sizes = icons.map((icon) => icon.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    expect(icons.some((icon) => icon.purpose === "maskable")).toBe(true);
  });

  it("points every icon at a file that actually exists", () => {
    for (const icon of manifest().icons ?? []) {
      expect(() => statSync(join(PUBLIC, String(icon.src)))).not.toThrow();
    }
  });

  it("uses the design system's brand colour for the theme", () => {
    const css = readFileSync(join(SRC, "app", "globals.css"), "utf8");
    expect(css).toContain("--brand-600: #2563eb");
  });
});

/**
 * The scope boundary from docs/planned-features.md, enforced.
 *
 * Installability only - no service worker, no caching. A POS showing a stale
 * price or stock figure is worse than one that plainly reports no connection.
 * If someone later adds a service worker or a cache layer, these fail.
 */
describe("no offline caching", () => {
  const files = sourceFiles(SRC);

  it("registers no service worker anywhere in src", () => {
    const offenders = files.filter((file) => {
      if (file.endsWith("pwa.test.ts")) return false;
      return /serviceWorker\s*\.\s*register|navigator\.serviceWorker/.test(
        readFileSync(file, "utf8"),
      );
    });
    expect(offenders).toEqual([]);
  });

  it("ships no service worker file in public/ or app/", () => {
    const suspicious = [
      ...readdirSync(PUBLIC),
      ...readdirSync(join(SRC, "app")),
    ].filter((entry) => /^(sw|service-worker|workbox)/i.test(entry));
    expect(suspicious).toEqual([]);
  });

  it("uses no Cache Storage API", () => {
    const offenders = files.filter((file) => {
      if (file.endsWith("pwa.test.ts")) return false;
      return /caches\s*\.\s*(open|match|keys)\b/.test(readFileSync(file, "utf8"));
    });
    expect(offenders).toEqual([]);
  });

  it("declares no PWA/caching dependency", () => {
    const pkg = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8"),
    ) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    const names = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    for (const banned of ["next-pwa", "workbox-window", "@ducanh2912/next-pwa", "serwist"]) {
      expect(names).not.toContain(banned);
    }
  });

  it("keeps the manifest free of offline hints", () => {
    // `display: standalone` is installability. Anything implying a cached
    // offline experience would contradict the spec.
    expect(JSON.stringify(manifest())).not.toMatch(/offline|serviceworker/i);
  });
});
