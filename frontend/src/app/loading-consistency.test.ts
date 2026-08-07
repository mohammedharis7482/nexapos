import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const PROTECTED = join(process.cwd(), "src", "app", "(protected)");

function pages(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return pages(full);
    return entry === "page.tsx" ? [full] : [];
  });
}

/**
 * The design system says loading components resemble final content and names
 * four of them (CardSkeleton, FormSkeleton, PageSkeleton, TableSkeleton).
 *
 * Every page that renders a table should reach for TableSkeleton rather than
 * hand-rolling a stack of bars at some arbitrary height - that per-page
 * variation is exactly what this pass removed.
 *
 * Billing is exempt and deliberately so: its split-pane and product-grid
 * skeletons already mirror its own final layout, which is the rule this test
 * enforces rather than an exception to it.
 */
describe("loading-state consistency", () => {
  // Scoped to pages whose table is gated by a fetch-driven loading branch.
  // The import wizard also renders tables, but they appear only after
  // validation from data already in memory and its progress lives on the
  // stage buttons - it has no table-loading state to standardise, so
  // requiring a TableSkeleton there would mean inventing UI.
  const tablePages = pages(PROTECTED).filter((file) => {
    const source = readFileSync(file, "utf8");
    return source.includes("<table") && /\{(state === "loading"|loading) \?/.test(source);
  });

  it("finds the table pages it is meant to guard", () => {
    expect(tablePages.length).toBeGreaterThanOrEqual(3);
  });

  it("uses TableSkeleton on every fetch-gated table page", () => {
    const offenders = tablePages.filter(
      (file) => !readFileSync(file, "utf8").includes("TableSkeleton"),
    );
    expect(offenders.map((file) => file.replace(PROTECTED, ""))).toEqual([]);
  });

  it("leaves no ad-hoc bar stacks on those pages", () => {
    const offenders = tablePages.filter((file) => {
      const source = readFileSync(file, "utf8");
      // Three or more bare <Skeleton> bars in a row was the old pattern.
      return (source.match(/<Skeleton\s/g) ?? []).length >= 3;
    });
    expect(offenders.map((file) => file.replace(PROTECTED, ""))).toEqual([]);
  });
});
