import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { productService } from "@/services/product.service";
import { ApiError } from "@/lib/api-client";
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
    downloadImportErrors: vi.fn(),
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
  invalid_rows: 0,
  warning_rows: 0,
  duplicate_rows: 0,
  duplicate_summary: { existing_rows: 0, strategy_required: false },
  products_created: 0,
  products_updated: 0,
  products_skipped: 0,
  categories_created: 0,
  categories_to_create: ["Dairy"],
  inventory_initialized: 0,
  opening_movements_created: 0,
  error_message: "",
  failure_code: "",
  created_by_name: "Owner",
  started_at: null,
  completed_at: null,
  expires_at: "2026-07-30T00:00:00Z",
  duration_ms: 12,
  created_at: "2026-07-29T00:00:00Z",
  can_import: true,
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
          description: "",
          category: "Dairy",
          category_state: "NEW",
          sku: "AUTO-ABC",
          barcode: null,
          unit: "BOTTLE",
          unit_display: "Bottle",
          purchase_price: "5.00",
          selling_price: "6.00",
          opening_stock: "12.000",
          low_stock_alert: "2.000",
          is_active: true,
          tax_rate: "0.00",
        },
        errors: [],
        warnings: [],
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
    vi.mocked(productService.downloadImportErrors).mockResolvedValue(
      new Blob(["errors"]),
    );
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
    expect(screen.getByText("products.csv")).toBeInTheDocument();
    expect(screen.getByText("12 bytes · CSV")).toBeInTheDocument();
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
      invalid_rows: 1,
      can_import: false,
      rows: {
        ...validated.rows,
        results: [
          {
            ...validated.rows.results[0],
            errors: [{
              row_number: 2,
              column: "Selling Price (QAR)",
              value: "",
              error_code: "REQUIRED_VALUE",
              human_message: "Selling Price is required.",
              suggested_fix: "Enter a selling price.",
            }],
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

  it("renders structured header errors returned before a preview exists", async () => {
    vi.mocked(productService.uploadImport).mockRejectedValue(
      new ApiError(
        "The CSV headers do not match the NexaPOS product template.",
        400,
        {
          file: ["The CSV headers are invalid."],
        },
        undefined,
        [{
          row_number: 1,
          column: "Selling Price (QAR)",
          value: "selling",
          error_code: "MISSING_HEADER",
          human_message: "The required column 'Selling Price (QAR)' is missing.",
          suggested_fix: "Download a fresh NexaPOS template.",
        }],
      ),
    );
    render(<ProductImportPage />);
    fireEvent.change(screen.getByLabelText("Product CSV"), {
      target: { files: [new File(["bad"], "bad.csv")] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Validate CSV" }));
    expect(
      await screen.findByText("The required column 'Selling Price (QAR)' is missing."),
    ).toBeInTheDocument();
    expect(screen.getByText("Download a fresh NexaPOS template.")).toBeInTheDocument();
  });

  it("shows warnings, category summary, filters issues, and downloads a report", async () => {
    const warning = {
      ...validated,
      warning_rows: 1,
      rows: {
        ...validated.rows,
        results: [{
          ...validated.rows.results[0],
          warnings: [{
            row_number: 2,
            column: "Selling Price (QAR)",
            value: "4.00",
            error_code: "SELLING_BELOW_PURCHASE",
            human_message: "Selling price is below purchase price.",
            suggested_fix: "Review the prices.",
          }],
        }],
      },
    };
    vi.mocked(productService.importDetail).mockResolvedValue({
      success: true, message: "", data: warning,
    });
    render(<ProductImportPage />);
    fireEvent.change(screen.getByLabelText("Product CSV"), {
      target: { files: [new File(["csv"], "products.csv")] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Validate CSV" }));
    expect(await screen.findByText("Selling price is below purchase price.")).toBeInTheDocument();
    expect(screen.getAllByText("Dairy")).not.toHaveLength(0);
    fireEvent.change(screen.getByLabelText("Issue severity"), {
      target: { value: "warning" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Filter" }));
    await waitFor(() =>
      expect(productService.importDetail).toHaveBeenLastCalledWith(
        "import-id",
        expect.objectContaining({ severity: "warning" }),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Download Error Report" }));
    await waitFor(() =>
      expect(productService.downloadImportErrors).toHaveBeenCalledWith("import-id"),
    );
  });

  it("prevents duplicate validation submissions while the upload is pending", async () => {
    let resolveUpload!: (value: Awaited<ReturnType<typeof productService.uploadImport>>) => void;
    vi.mocked(productService.uploadImport).mockReturnValue(
      new Promise((resolve) => { resolveUpload = resolve; }),
    );
    render(<ProductImportPage />);
    fireEvent.change(screen.getByLabelText("Product CSV"), {
      target: { files: [new File(["csv"], "products.csv")] },
    });
    const button = screen.getByRole("button", { name: "Validate CSV" });
    fireEvent.click(button);
    expect(await screen.findByText("Validating products…")).toBeInTheDocument();
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(productService.uploadImport).toHaveBeenCalledOnce();
    resolveUpload({ success: true, message: "", data: validated });
  });

  it("shows a permission-specific API error", async () => {
    vi.mocked(productService.uploadImport).mockRejectedValue(
      new ApiError("Forbidden", 403),
    );
    render(<ProductImportPage />);
    fireEvent.change(screen.getByLabelText("Product CSV"), {
      target: { files: [new File(["csv"], "products.csv")] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Validate CSV" }));
    expect(
      await screen.findByText("Owner access is required to import products."),
    ).toBeInTheDocument();
  });
});
