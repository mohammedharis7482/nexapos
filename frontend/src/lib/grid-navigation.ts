export type ArrowKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown";

/**
 * Resolves which index arrow-key navigation should move focus to inside a
 * responsive CSS grid of equal-height items, given each item's rendered
 * offsetTop (items sharing a row share the same offsetTop). Pure function
 * so the row/column math can be tested without a real layout engine.
 */
export function computeGridNavigationIndex(
  currentIndex: number,
  key: ArrowKey,
  itemTops: number[],
): number {
  const count = itemTops.length;
  if (count === 0) return currentIndex;
  if (key === "ArrowRight") return Math.min(currentIndex + 1, count - 1);
  if (key === "ArrowLeft") return Math.max(currentIndex - 1, 0);

  const currentTop = itemTops[currentIndex];
  let rowStart = currentIndex;
  while (rowStart > 0 && itemTops[rowStart - 1] === currentTop) rowStart--;
  let columns = 0;
  for (let index = rowStart; index < count && itemTops[index] === currentTop; index++) columns++;

  const target = key === "ArrowDown" ? currentIndex + columns : currentIndex - columns;
  return Math.max(0, Math.min(target, count - 1));
}
