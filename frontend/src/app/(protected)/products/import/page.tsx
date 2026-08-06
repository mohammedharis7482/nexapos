"use client";

import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Search,
  Trash2,
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
  ProductImportIssue,
} from "@/types/product";

type WorkingStage =
  | "idle"
  | "validating"
  | "importing"
  | "downloading"
  | "report";
type SeverityFilter = "all" | "error" | "warning";

function errorMessage(error: unknown) {
  if (!(error instanceof ApiError)) return "The import could not be completed.";
  if (error.status === 401) return "Your session has expired. Sign in and try again.";
  if (error.status === 403) return "Owner access is required to import products.";
  if (error.status === 413) return "The CSV is larger than the 5 MB limit.";
  if (error.status === 415) return "Upload a UTF-8 CSV file.";
  if (error.status === 500) return "NexaPOS could not validate the file. Try again shortly.";
  return error.message;
}

function isProductImportIssue(value: unknown): value is ProductImportIssue {
  return (
    typeof value === "object"
    && value !== null
    && "row_number" in value
    && "column" in value
    && "error_code" in value
  );
}

function structuredIssues(error: unknown): ProductImportIssue[] {
  if (!(error instanceof ApiError)) return [];
  return error.structuredErrors.filter(isProductImportIssue);
}

function statusTone(status: ProductImport["status"]) {
  if (status === "COMPLETED") return "success" as const;
  if (status === "FAILED") return "danger" as const;
  return "primary" as const;
}

function fileSize(size: number) {
  if (size < 1024) return `${size} bytes`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function ProductImportPage() {
  const { user } = useAuth();
  const owner = canManageCatalogue(user?.role ?? "CASHIER");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ProductImportDetail | null>(null);
  const [requestIssues, setRequestIssues] = useState<ProductImportIssue[]>([]);
  const [history, setHistory] = useState<ProductImport[]>([]);
  const [strategy, setStrategy] = useState<DuplicateStrategy | "">("");
  const [stage, setStage] = useState<WorkingStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [severity, setSeverity] = useState<SeverityFilter>("all");
  const [column, setColumn] = useState("");
  const [search, setSearch] = useState("");
  const [rowPage, setRowPage] = useState(1);

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
      saveBlob(
        await productService.downloadImportTemplate(),
        "nexapos-product-import-template.csv",
      );
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
    setRequestIssues([]);
    setPreview(null);
    setStrategy("");
    setSeverity("all");
    setColumn("");
    setSearch("");
    setRowPage(1);
    try {
      const uploaded = await productService.uploadImport(file);
      const detail = await productService.importDetail(uploaded.data.id);
      setPreview(detail.data);
      await loadHistory();
    } catch (uploadError) {
      setError(errorMessage(uploadError));
      setRequestIssues(structuredIssues(uploadError));
    } finally {
      setStage("idle");
    }
  }

  async function loadRows(page = 1) {
    if (!preview) return;
    setError(null);
    try {
      const detail = await productService.importDetail(preview.id, {
        page,
        severity,
        column,
        search,
      });
      setPreview(detail.data);
      setRowPage(page);
    } catch (filterError) {
      setError(errorMessage(filterError));
    }
  }

  async function confirmImport() {
    if (!preview || !strategy) return;
    setStage("importing");
    setError(null);
    try {
      const response = await productService.confirmImport(preview.id, strategy);
      const detail = await productService.importDetail(response.data.id);
      setPreview(detail.data);
      await loadHistory();
    } catch (importError) {
      setError(errorMessage(importError));
      setRequestIssues(structuredIssues(importError));
    } finally {
      setStage("idle");
    }
  }

  async function downloadErrors() {
    if (!preview) return;
    setStage("report");
    setError(null);
    try {
      saveBlob(
        await productService.downloadImportErrors(preview.id),
        `nexapos-import-errors-${preview.id}.csv`,
      );
    } catch (reportError) {
      setError(errorMessage(reportError));
    } finally {
      setStage("idle");
    }
  }

  function removeFile() {
    setFile(null);
    setPreview(null);
    setRequestIssues([]);
    setError(null);
    setStrategy("");
  }

  const working = stage !== "idle";
  const canConfirm = Boolean(
    preview?.can_import && strategy && !working,
  );
  const visibleIssues = preview
    ? preview.rows.results.flatMap((row) => [
        ...row.errors.map((issue) => ({ ...issue, severity: "Error" })),
        ...row.warnings.map((issue) => ({ ...issue, severity: "Warning" })),
      ])
    : requestIssues.map((issue) => ({ ...issue, severity: "Error" }));
  const availableColumns = preview
    ? Array.from(
        new Set(
          preview.rows.results.flatMap((row) =>
            [...row.errors, ...row.warnings].map((issue) => issue.column),
          ),
        ),
      ).sort()
    : [];

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

        {file ? (
          <div className="mt-5 flex flex-col gap-3 rounded-[var(--radius-control)] border border-border bg-surface-subtle p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate font-semibold">{file.name}</p>
              <p className="mt-1 text-sm text-foreground-muted">{fileSize(file.size)} · CSV</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex min-h-[var(--control-md)] cursor-pointer items-center rounded-[var(--radius-control)] border border-border bg-surface px-4 text-sm font-semibold hover:bg-surface-hover">
                Replace File
                <input
                  className="sr-only"
                  aria-label="Replace product CSV"
                  type="file"
                  accept=".csv,text/csv"
                  disabled={working}
                  onChange={(event) => {
                    setFile(event.target.files?.[0] ?? null);
                    setPreview(null);
                    setRequestIssues([]);
                    setError(null);
                  }}
                />
              </label>
              <Button
                variant="ghost"
                leadingIcon={<Trash2 className="size-4" />}
                disabled={working}
                onClick={removeFile}
              >
                Remove File
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-5">
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
                setRequestIssues([]);
                setError(null);
              }}
            />
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <Button
            leadingIcon={<Upload className="size-4" />}
            loading={stage === "validating"}
            disabled={!file || working}
            onClick={() => void validateFile()}
          >
            {preview ? "Revalidate" : "Validate CSV"}
          </Button>
        </div>
        {stage === "validating" ? (
          <div className="mt-4" role="status">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Spinner className="size-4" /> Validating products…
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
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <SummaryCard label="Total Rows" value={preview.total_rows} />
              <SummaryCard label="Valid" value={preview.valid_rows} />
              <SummaryCard label="Errors" value={preview.error_rows} />
              <SummaryCard label="Warnings" value={preview.warning_rows} />
              <SummaryCard label="New Categories" value={preview.categories_to_create.length} />
            </div>
          </section>

          {preview.categories_to_create.length ? (
            <Alert title="Categories to create" tone="info">
              {preview.categories_to_create.join(", ")}
            </Alert>
          ) : null}

          {preview.error_rows ? (
            <Alert title="Correct the CSV before importing" tone="warning">
              No catalogue data was changed. Fix every blocking error and
              validate the CSV again.
            </Alert>
          ) : (
            <Alert title="Validation passed" tone="success">
              Warnings do not block import. Review them and choose an explicit
              duplicate strategy before confirming.
            </Alert>
          )}
        </>
      ) : null}

      {visibleIssues.length ? (
        <SurfaceCard padding="none" className="overflow-hidden">
          <div className="border-b border-border p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="font-semibold">Validation issues</h2>
                <p className="mt-1 text-sm text-foreground-muted">
                  Review row, value, problem, and the suggested correction.
                </p>
              </div>
              {preview ? (
                <Button
                  variant="secondary"
                  leadingIcon={<Download className="size-4" />}
                  loading={stage === "report"}
                  onClick={() => void downloadErrors()}
                >
                  Download Error Report
                </Button>
              ) : null}
            </div>
            {preview ? (
              <form
                className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_180px_200px_auto]"
                onSubmit={(event) => {
                  event.preventDefault();
                  void loadRows(1);
                }}
              >
                <Input
                  aria-label="Search validation issues"
                  placeholder="Search product, value, or problem"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                <Select
                  aria-label="Issue severity"
                  value={severity}
                  onChange={(event) => setSeverity(event.target.value as SeverityFilter)}
                >
                  <option value="all">Errors and warnings</option>
                  <option value="error">Errors only</option>
                  <option value="warning">Warnings only</option>
                </Select>
                <Select
                  aria-label="Issue column"
                  value={column}
                  onChange={(event) => setColumn(event.target.value)}
                >
                  <option value="">All columns</option>
                  {availableColumns.map((item) => <option key={item} value={item}>{item}</option>)}
                </Select>
                <Button type="submit" variant="secondary" leadingIcon={<Search className="size-4" />}>
                  Filter
                </Button>
              </form>
            ) : null}
          </div>
          <TableFrame>
            <table className="premium-table">
              <thead>
                <tr>
                  <th className="px-4 py-3">Row</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Column</th>
                  <th className="px-4 py-3">Value</th>
                  <th className="px-4 py-3">Problem</th>
                  <th className="px-4 py-3">Suggested Fix</th>
                </tr>
              </thead>
              <tbody>
                {visibleIssues.map((issue, index) => (
                  <tr key={`${issue.row_number}-${issue.error_code}-${index}`} className="border-t border-border">
                    <td className="px-4 py-3 tabular-nums">{issue.row_number}</td>
                    <td className="px-4 py-3">
                      <Badge tone={issue.severity === "Error" ? "danger" : "warning"}>
                        {issue.severity}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-semibold">{issue.column}</td>
                    <td className="max-w-48 break-words px-4 py-3 text-foreground-muted">{issue.value || "—"}</td>
                    <td className="max-w-sm px-4 py-3">{issue.human_message}</td>
                    <td className="max-w-sm px-4 py-3 text-foreground-muted">{issue.suggested_fix || "Review this value."}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableFrame>
          {preview && (preview.rows.previous || preview.rows.next) ? (
            <div className="flex items-center justify-between border-t border-border p-4">
              <Button
                size="sm"
                variant="secondary"
                disabled={!preview.rows.previous}
                onClick={() => void loadRows(rowPage - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-foreground-muted">Page {rowPage}</span>
              <Button
                size="sm"
                variant="secondary"
                disabled={!preview.rows.next}
                onClick={() => void loadRows(rowPage + 1)}
              >
                Next
              </Button>
            </div>
          ) : null}
        </SurfaceCard>
      ) : null}

      {preview ? (
        <SurfaceCard padding="none" className="overflow-hidden">
          <div className="border-b border-border p-4">
            <h2 className="font-semibold">Product preview</h2>
            <p className="mt-1 text-sm text-foreground-muted">
              Showing {preview.rows.results.length} of {preview.rows.count} matching rows.
            </p>
          </div>
          <TableFrame>
            <table className="premium-table">
              <thead>
                <tr>
                  <th className="px-4 py-3">Row</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">SKU / Barcode</th>
                  <th className="px-4 py-3">Opening Quantity</th>
                  <th className="px-4 py-3">Category</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.results.map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="px-4 py-3 tabular-nums">{row.row_number}</td>
                    <td className="px-4 py-3">
                      <span className="block font-semibold">{row.normalized_data.name || "Missing name"}</span>
                      <span className="text-xs text-foreground-muted">{row.normalized_data.unit_display || row.normalized_data.unit}</span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="block">{row.normalized_data.sku}</span>
                      <span className="text-foreground-muted">{row.normalized_data.barcode ?? "No barcode"}</span>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{row.normalized_data.opening_stock ?? "Not initialized"}</td>
                    <td className="px-4 py-3">
                      <span className="block">{row.normalized_data.category || "Uncategorized"}</span>
                      {row.normalized_data.category_state === "NEW" ? <Badge tone="primary">New</Badge> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableFrame>
        </SurfaceCard>
      ) : null}

      {preview?.status === "VALIDATED" ? (
        <SurfaceCard>
          <h2 className="font-semibold">3. Confirm import</h2>
          <p className="mt-1 text-sm text-foreground-muted">
            Confirmation uses the validated server-side rows. It never trusts
            product data sent back by the browser.
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
                onChange={(event) => setStrategy(event.target.value as DuplicateStrategy | "")}
              >
                <option value="">Select a strategy</option>
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

      {preview?.status === "COMPLETED" ? (
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

      <SurfaceCard padding="none" className="overflow-hidden">
        <div className="border-b border-border p-4">
          <h2 className="font-semibold">Import history</h2>
          <p className="mt-1 text-sm text-foreground-muted">Recent imports for this shop only.</p>
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
