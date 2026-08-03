import { describe, expect, it } from "vitest";

import { computeGridNavigationIndex } from "./grid-navigation";

// A 3-column grid of 8 items across 3 rows: [0,0,0, 40,40,40, 80,80]
const threeColumnTops = [0, 0, 0, 40, 40, 40, 80, 80];

describe("computeGridNavigationIndex", () => {
  it("moves right and left within bounds", () => {
    expect(computeGridNavigationIndex(0, "ArrowRight", threeColumnTops)).toBe(1);
    expect(computeGridNavigationIndex(2, "ArrowRight", threeColumnTops)).toBe(3);
    expect(computeGridNavigationIndex(1, "ArrowLeft", threeColumnTops)).toBe(0);
  });

  it("clamps right/left at the first and last item", () => {
    expect(computeGridNavigationIndex(0, "ArrowLeft", threeColumnTops)).toBe(0);
    expect(computeGridNavigationIndex(7, "ArrowRight", threeColumnTops)).toBe(7);
  });

  it("moves down and up by the row's column count", () => {
    expect(computeGridNavigationIndex(0, "ArrowDown", threeColumnTops)).toBe(3);
    expect(computeGridNavigationIndex(1, "ArrowDown", threeColumnTops)).toBe(4);
    expect(computeGridNavigationIndex(4, "ArrowUp", threeColumnTops)).toBe(1);
  });

  it("clamps down/up into the shorter last row instead of overshooting", () => {
    // Row 3 only has 2 items (indexes 6-7); moving down from index 5 (row 2,
    // column 3) has no column-3 slot below it, so it clamps to the last item.
    expect(computeGridNavigationIndex(5, "ArrowDown", threeColumnTops)).toBe(7);
  });

  it("clamps up past the first row", () => {
    expect(computeGridNavigationIndex(0, "ArrowUp", threeColumnTops)).toBe(0);
  });

  it("handles a single-item grid without throwing", () => {
    expect(computeGridNavigationIndex(0, "ArrowDown", [0])).toBe(0);
    expect(computeGridNavigationIndex(0, "ArrowRight", [0])).toBe(0);
  });
});
