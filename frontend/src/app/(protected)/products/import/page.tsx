"use client";

import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { canManageCatalogue } from "@/components/catalogue/access";
import { Button } from "@/components/ui/button";
import { SummaryCard, SurfaceCard } from "@/components/ui/card";
import { Badge, PageHeader } from "@/components/ui/display";
import { Alert, ErrorState, Spinner } from "@/components/ui/feedback";
import { Input, Select } from "@/components/ui/input";
import { TableFrame } from "@/components/ui/layout";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import { productService } from "@/services/product.service";
import type {
  DuplicateStrategy,
  ProductImport,
  ProductImportDetail,
} from "@/types/product";

type WorkingStage = "idle" | "validating" | "importing" | "downloading";

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "The import could not be completed.";
}

function statusTone(status: ProductImport["status"]) {
  if (status === "COMPLETED") return "success" as const;
  if (status === "FAILED") return "danger" as const;
  return "primary" as const;
}

export default function ProductImportPage() {
  const { user } = useAuth();
  const owner = canManageCatalogue(user?.role ?? "CASHIER");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ProductImportDetail | null>(null);
  const [history, setHistory] = useState<ProductImport[]>([]);
  const [strategy, setStrategy] = useState<DuplicateStrategy>("SKIP");
  const [stage, setStage] = useState<WorkingStage>("idle");
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    if (!owner) return;
    const response = await productService.importHistory();
    setHistory(response.data.results);
  }, [owner]);

  useEffect(() => {
    queueMicrotask(() => void loadHistory().catch(() => undefined));
  }, [loadHistory]);

  if (!owner) {
    return (
      <ErrorState
        title="Owner access required"
        description="Only an owner can import products and initialize opening stock."
      />
    );
  }

  async function downloadTemplate() {
    setStage("downloading");
    setError(null);
    try {
      const blob = await productService.downloadImportTemplate();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "nexapos-product-import-template.csv";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(errorMessage(downloadError));
    } finally {
      setStage("idle");
    }
  }

  async function validateFile() {
    if (!file) {
      setError("Select a CSV file first.");
      return;
    }
    setStage("validating");
    setError(null);
    setPreview(null);
    try {
      const uploaded = await productService.uploadImport(file);
      const detail = await productService.importDetail(uploaded.data.id);
      setPreview(detail.data);
      await loadHistory();
    } catch (uploadError) {
      setError(errorMessage(uploadError));
    } finally {
      setStage("idle");
    }
  }

  async function confirmImport() {
    if (!preview) return;
    setStage("importing");
    setError(null);
    try {
      const response = await productService.confirmImport(preview.id, strategy);
      const detail = await productService.importDetail(response.data.id);
      setPreview(detail.data);
      await loadHistory();
    } catch (importError) {
      setError(errorMessage(importError));
    } finally {
      setStage("idle");
    }
  }

  const working = stage !== "idle";
  const canConfirm =
    preview?.status === "VALIDATED" && preview.error_rows === 0 && !working;

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Catalogue onboarding"
        title="Import Products"
        description="Validate a NexaPOS CSV, review every issue, then create products and opening inventory in one controlled import."
        action={
          <Button
            variant="secondary"
            leadingIcon={<Download className="size-4" />}
            loading={stage === "downloading"}
            onClick={() => void downloadTemplate()}
          >
            Download Template
          </Button>
        }
      />

      <Link
        href="/products"
        className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-primary"
      >
        <ArrowLeft className="size-4" /> Back to Products
      </Link>

      {error ? <Alert title="Import could not continue">{error}</Alert> : null}

      <SurfaceCard>
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
            <FileSpreadsheet className="size-5" />
          </span>
          <div>
            <h2 className="font-semibold">1. Upload and validate</h2>
            <p className="mt-1 text-sm text-foreground-muted">
              CSV only, UTF-8, maximum 5 MB and 10,000 product rows. Keep the
              template column names unchanged.
            </p>
          </div>
        </div>
        <div className="mt-5 grid items-end gap-3 md:grid-cols-[1fr_auto]">
          <div>
            <label htmlFor="product-import-file" className="mb-1.5 block text-sm font-semibold">
              Product CSV
            </label>
            <Input
              id="product-import-file"
              type="file"
              accept=".csv,text/csv"
              disabled={working}
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setPreview(null);
                setError(null);
              }}
            />
          </div>
          <Button
            leadingIcon={<Upload className="size-4" />}
            loading={stage === "validating"}
            disabled={!file || working}
            onClick={() => void validateFile()}
          >
            Validate CSV
          </Button>
        </div>
        {stage === "validating" ? (
          <div className="mt-4" role="status">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Spinner className="size-4" /> Uploading and validating rows…
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-primary" />
            </div>
          </div>
        ) : null}
      </SurfaceCard>

      {preview ? (
        <>
          <section aria-labelledby="validation-summary">
            <h2 id="validation-summary" className="mb-3 font-semibold">
              2. Validation summary
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryCard label="CSV rows" value={preview.total_rows} />
              <SummaryCard label="Valid rows" value={preview.valid_rows} />
              <SummaryCard label="Rows with errors" value={preview.error_rows} />
              <SummaryCard label="Existing duplicates" value={preview.duplicate_rows} />
            </div>
          </section>

          {preview.error_rows ? (
            <Alert title="Correct the CSV before importing" tone="warning">
              No products have been changed. Download or edit your source CSV,
              fix the rows shown below, and validate it again.
            </Alert>
          ) : (
            <Alert title="Validation passed" tone="success">
              Review duplicate handling and confirm when you are ready.
            </Alert>
          )}

          <SurfaceCard padding="none" className="overflow-hidden">
            <div className="border-b border-border p-4">
              <h2 className="font-semibold">Row preview</h2>
              <p className="mt-1 text-sm text-foreground-muted">
                Showing the first {preview.rows.results.length} of {preview.total_rows} rows.
              </p>
            </div>
            <TableFrame>
              <table className="premium-table">
                <thead>
                  <tr>
                    <th className="px-4 py-3">Row</th>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">SKU / Barcode</th>
                    <th className="px-4 py-3">Stock</th>
                    <th className="px-4 py-3">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.results.map((row) => {
                    const messages = Object.values(row.errors).flat();
                    return (
                      <tr key={row.id} className="border-t border-border">
                        <td className="px-4 py-3 tabular-nums">{row.row_number}</td>
                        <td className="px-4 py-3">
                          <span className="block font-semibold">{row.normalized_data.name || "Missing name"}</span>
                          <span className="text-xs text-foreground-muted">{row.normalized_data.category || "Uncategorized"} · {row.normalized_data.unit}</span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className="block">{row.normalized_data.sku}</span>
                          <span className="text-foreground-muted">{row.normalized_data.barcode ?? "No barcode"}</span>
                        </td>
                        <td className="px-4 py-3 tabular-nums">{row.normalized_data.opening_stock ?? "Not initialized"}</td>
                        <td className="max-w-sm px-4 py-3">
                          {messages.length ? (
                            <ul className="space-y-1 text-sm text-danger">
                              {messages.map((message) => <li key={message}>{message}</li>)}
                            </ul>
                          ) : row.duplicate_fields.length ? (
                            <Badge tone="warning">Duplicate: {row.duplicate_fields.join(", ")}</Badge>
                          ) : (
                            <Badge tone="success">Ready</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableFrame>
          </SurfaceCard>

          {preview.status === "VALIDATED" ? (
            <SurfaceCard>
              <h2 className="font-semibold">3. Confirm import</h2>
              <p className="mt-1 text-sm text-foreground-muted">
                Choose what NexaPOS should do when SKU or barcode matches an existing product.
              </p>
              <div className="mt-4 grid items-end gap-3 sm:grid-cols-[minmax(220px,1fr)_auto]">
                <div>
                  <label htmlFor="duplicate-strategy" className="mb-1.5 block text-sm font-semibold">
                    Duplicate strategy
                  </label>
                  <Select
                    id="duplicate-strategy"
                    value={strategy}
                    disabled={working}
                    onChange={(event) => setStrategy(event.target.value as DuplicateStrategy)}
                  >
                    <option value="SKIP">Skip existing products</option>
                    <option value="UPDATE">Update existing products</option>
                    <option value="CANCEL">Cancel if duplicates exist</option>
                  </Select>
                </div>
                <Button
                  loading={stage === "importing"}
                  disabled={!canConfirm}
                  onClick={() => void confirmImport()}
                >
                  Confirm Import
                </Button>
              </div>
              {stage === "importing" ? (
                <div className="mt-4" role="status">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <Spinner className="size-4" /> Creating products and opening inventory…
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
                    <div className="h-full w-5/6 animate-pulse rounded-full bg-primary" />
                  </div>
                </div>
              ) : null}
            </SurfaceCard>
          ) : null}

          {preview.status === "COMPLETED" ? (
            <SurfaceCard>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="size-6 shrink-0 text-success" />
                <div>
                  <h2 className="font-semibold">Import complete</h2>
                  <p className="mt-1 text-sm text-foreground-muted">
                    Products with positive initialized stock are ready for Billing.
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <SummaryCard label="Created" value={preview.products_created} />
                <SummaryCard label="Updated" value={preview.products_updated} />
                <SummaryCard label="Skipped" value={preview.products_skipped} />
                <SummaryCard label="Categories created" value={preview.categories_created} />
                <SummaryCard label="Inventory initialized" value={preview.inventory_initialized} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={() => { window.location.href = "/products"; }}>View Products</Button>
                <Button variant="secondary" onClick={() => { window.location.href = "/inventory"; }}>View Inventory</Button>
              </div>
            </SurfaceCard>
          ) : null}
        </>
      ) : null}

      <SurfaceCard padding="none" className="overflow-hidden">
        <div className="border-b border-border p-4">
          <h2 className="font-semibold">Import history</h2>
          <p className="mt-1 text-sm text-foreground-muted">
            Recent imports for this shop only.
          </p>
        </div>
        {history.length ? (
          <div className="divide-y divide-border">
            {history.slice(0, 10).map((item) => (
              <button
                type="button"
                key={item.id}
                className="flex w-full items-center justify-between gap-4 p-4 text-left hover:bg-surface-hover"
                onClick={async () => {
                  setError(null);
                  try {
                    const response = await productService.importDetail(item.id);
                    setPreview(response.data);
                  } catch (historyError) {
                    setError(errorMessage(historyError));
                  }
                }}
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{item.filename}</span>
                  <span className="text-xs text-foreground-muted">
                    {item.created_by_name} · {new Date(item.created_at).toLocaleString()}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="text-sm tabular-nums text-foreground-muted">{item.total_rows} rows</span>
                  <Badge tone={statusTone(item.status)}>{item.status.toLowerCase()}</Badge>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="p-5 text-sm text-foreground-muted">No product imports yet.</p>
        )}
      </SurfaceCard>
    </div>
  );
}
