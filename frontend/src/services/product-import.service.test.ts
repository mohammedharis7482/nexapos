import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiDownload, apiRequest } from "@/lib/api-client";

import { productService } from "./product.service";

vi.mock("@/lib/api-client", () => ({
  apiRequest: vi.fn(),
  apiDownload: vi.fn(),
}));

describe("product import service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses exact trailing-slash import endpoints", () => {
    productService.downloadImportTemplate();
    productService.importHistory();
    productService.importDetail("import-id");
    productService.confirmImport("import-id", "SKIP");
    productService.downloadImportErrors("import-id");

    expect(apiDownload).toHaveBeenCalledWith("/products/import-template/");
    expect(apiRequest).toHaveBeenNthCalledWith(
      1,
      "/products/imports/?page=1",
    );
    expect(apiDownload).toHaveBeenLastCalledWith(
      "/products/imports/import-id/errors/",
    );
    expect(apiRequest).toHaveBeenNthCalledWith(
      2,
      "/products/imports/import-id/",
    );
    expect(apiRequest).toHaveBeenNthCalledWith(
      3,
      "/products/imports/import-id/confirm/",
      {
        method: "POST",
        body: JSON.stringify({
          duplicate_strategy: "SKIP",
          confirmed: true,
        }),
        timeoutMs: 300_000,
      },
    );
  });

  it("uploads the CSV as multipart form data", () => {
    const file = new File(["csv"], "products.csv", { type: "text/csv" });
    productService.uploadImport(file);

    expect(apiRequest).toHaveBeenCalledOnce();
    const [path, options] = vi.mocked(apiRequest).mock.calls[0];
    expect(path).toBe("/products/imports/");
    expect(options?.method).toBe("POST");
    expect(options?.body).toBeInstanceOf(FormData);
    expect((options?.body as FormData).get("file")).toBe(file);
  });
});
