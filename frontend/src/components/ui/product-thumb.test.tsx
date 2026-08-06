import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProductThumb, categoryTint } from "./product-thumb";

describe("categoryTint", () => {
  it("is stable for the same category and uses only brand-scale tints", () => {
    expect(categoryTint("Dairy")).toBe(categoryTint("Dairy"));
    expect(categoryTint("Dairy")).not.toMatch(/success|warning|danger/);
  });

  it("falls back to a single tint for uncategorised products", () => {
    expect(categoryTint(null)).toBe(categoryTint(undefined));
    expect(categoryTint("")).toBe(categoryTint(null));
  });
});

describe("ProductThumb", () => {
  it("renders the placeholder when there is no image", () => {
    render(<ProductThumb src={null} alt="Bananas" categoryName="Fruit" />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByTestId("product-thumb-placeholder")).toBeInTheDocument();
  });

  it("renders the image when one exists", () => {
    render(<ProductThumb src="http://localhost/media/a.jpg" alt="Bananas" />);
    expect(screen.getByRole("img", { name: "Bananas" })).toHaveAttribute(
      "src",
      "http://localhost/media/a.jpg",
    );
    expect(screen.queryByTestId("product-thumb-placeholder")).toBeNull();
  });

  it("falls back to the placeholder instead of a broken image when loading fails", () => {
    render(<ProductThumb src="http://localhost/media/missing.jpg" alt="Bananas" />);
    fireEvent.error(screen.getByRole("img", { name: "Bananas" }));
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByTestId("product-thumb-placeholder")).toBeInTheDocument();
  });

  it("retries a new src after a previous one failed", () => {
    const { rerender } = render(<ProductThumb src="http://localhost/a.jpg" alt="Bananas" />);
    fireEvent.error(screen.getByRole("img", { name: "Bananas" }));
    expect(screen.getByTestId("product-thumb-placeholder")).toBeInTheDocument();
    rerender(<ProductThumb src="http://localhost/b.jpg" alt="Bananas" />);
    expect(screen.getByRole("img", { name: "Bananas" })).toHaveAttribute(
      "src",
      "http://localhost/b.jpg",
    );
  });
});
