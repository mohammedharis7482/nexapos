import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { productService } from "@/services/product.service";
import type { ProductImportDetail } from "@/types/product";

import ProductImportPage from "./page";

const mocks = vi.hoisted(() => ({
  role: "OWNER",
}));

vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({ user: { role: mocks.role } }),
}));
vi.mock("@/services/product.service", () => ({
  productService: {
    importHistory: vi.fn(),
    uploadImport: vi.fn(),
    importDetail: vi.fn(),
    confirmImport: vi.fn(),
    downloadImportTemplate: vi.fn(),
  },
}));

const validated: ProductImportDetail = {
  id: "import-id",
  filename: "products.csv",
  status: "VALIDATED",
  duplicate_strategy: "",
  total_rows: 1,
  valid_rows: 1,
  error_rows: 0,
  duplicate_rows: 0,
  products_created: 0,
  products_updated: 0,
  products_skipped: 0,
  categories_created: 0,
  inventory_initialized: 0,
  error_message: "",
  created_by_name: "Owner",
  started_at: null,
  completed_at: null,
  created_at: "2026-07-29T00:00:00Z",
  rows: {
    count: 1,
    next: null,
    previous: null,
    results: [
      {
        id: "row-id",
        row_number: 2,
        raw_data: {},
        normalized_data: {
          name: "Milk",
          category: "Dairy",
          sku: "AUTO-ABC",
          barcode: null,
          unit: "BOTTLE",
          purchase_price: "5.00",
          selling_price: "6.00",
          opening_stock: "12.000",
          low_stock_alert: "2.000",
          is_active: true,
        },
        errors: {},
        duplicate_fields: [],
      },
    ],
  },
};

describe("ProductImportPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.role = "OWNER";
    vi.mocked(productService.importHistory).mockResolvedValue({
      success: true,
      message: "",
      data: { count: 0, next: null, previous: null, results: [] },
    });
    vi.mocked(productService.uploadImport).mockResolvedValue({
      success: true,
      message: "",
      data: validated,
    });
    vi.mocked(productService.importDetail).mockResolvedValue({
      success: true,
      message: "",
      data: validated,
    });
  });

  it("uploads, validates, previews, and confirms one import", async () => {
    vi.mocked(productService.confirmImport).mockResolvedValue({
      success: true,
      message: "",
      data: {
        ...validated,
        status: "COMPLETED",
        products_created: 1,
        categories_created: 1,
        inventory_initialized: 1,
      },
    });
    vi.mocked(productService.importDetail)
      .mockResolvedValueOnce({ success: true, message: "", data: validated })
      .mockResolvedValueOnce({
        success: true,
        message: "",
        data: {
          ...validated,
          status: "COMPLETED",
          products_created: 1,
          categories_created: 1,
          inventory_initialized: 1,
        },
      });

    render(<ProductImportPage />);
    const file = new File(["Product Name"], "products.csv", {
      type: "text/csv",
    });
    fireEvent.change(screen.getByLabelText("Product CSV"), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Validate CSV" }));

    await screen.findByText("Validation passed");
    expect(screen.getByText("Milk")).toBeInTheDocument();
    expect(screen.getByText("No barcode")).toBeInTheDocument();
    expect(productService.uploadImport).toHaveBeenCalledOnce();

    fireEvent.change(screen.getByLabelText("Duplicate strategy"), {
      target: { value: "UPDATE" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm Import" }));
    await screen.findByText("Import complete");
    expect(productService.confirmImport).toHaveBeenCalledWith(
      "import-id",
      "UPDATE",
    );
  });

  it("shows validation errors and prevents confirmation", async () => {
    const invalid = {
      ...validated,
      valid_rows: 0,
      error_rows: 1,
      rows: {
        ...validated.rows,
        results: [
          {
            ...validated.rows.results[0],
            errors: { selling_price: ["Selling Price is required."] },
          },
        ],
      },
    };
    vi.mocked(productService.importDetail).mockResolvedValue({
      success: true,
      message: "",
      data: invalid,
    });
    render(<ProductImportPage />);
    fireEvent.change(screen.getByLabelText("Product CSV"), {
      target: { files: [new File(["bad"], "bad.csv")] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Validate CSV" }));
    await screen.findByText("Correct the CSV before importing");
    expect(screen.getByText("Selling Price is required.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm Import" })).toBeDisabled();
  });

  it("does not expose the import workflow to cashiers", async () => {
    mocks.role = "CASHIER";
    render(<ProductImportPage />);
    expect(screen.getByText("Owner access required")).toBeInTheDocument();
    expect(productService.importHistory).not.toHaveBeenCalled();
  });

  it("renders one controlled upload error", async () => {
    vi.mocked(productService.uploadImport).mockRejectedValue(
      new Error("network"),
    );
    render(<ProductImportPage />);
    fireEvent.change(screen.getByLabelText("Product CSV"), {
      target: { files: [new File(["bad"], "bad.csv")] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Validate CSV" }));
    await waitFor(() =>
      expect(screen.getByText("Import could not continue")).toBeInTheDocument(),
    );
    expect(productService.uploadImport).toHaveBeenCalledOnce();
  });
});
