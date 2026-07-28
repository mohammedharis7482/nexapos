"use client";

import { AlertTriangle, Boxes, CheckCircle2, PackageX, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { StockStatusBadge } from "@/components/inventory/stock-status";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MetricCard, PageHeader, QuantityDisplay } from "@/components/ui/display";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { SearchInput, Select } from "@/components/ui/input";
import { FilterToolbar, Pagination, TableFrame } from "@/components/ui/layout";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import { categoryService } from "@/services/category.service";
import { inventoryService } from "@/services/inventory.service";
import type { ProductCategory } from "@/types/category";
import type {
  InventoryFilters,
  InventoryItem,
  InventorySummary,
} from "@/types/inventory";

export function inventoryCollectionState(
  loading: boolean,
  count: number,
  error: string | null,
) {
  if (loading) return "loading";
  if (error) return "error";
  if (count === 0) return "empty";
  return "ready";
}

function formatMovementTime(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-QA", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "No movements";
}

export default function InventoryPage() {
  const { user } = useAuth();
  const owner = user?.role === "OWNER";
  const initialized = useRef(false);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [searchDraft, setSearchDraft] = useState("");
  const [filters, setFilters] = useState<InventoryFilters>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [inventoryResponse, summaryResponse] = await Promise.all([
        inventoryService.list({ ...filters, page, page_size: 25 }),
        inventoryService.summary(),
      ]);
      setItems(inventoryResponse.data.results);
      setCount(inventoryResponse.data.count);
      setHasNext(Boolean(inventoryResponse.data.next));
      setSummary(summaryResponse.data);
    } catch (loadError) {
      setError(
        loadError instanceof ApiError
          ? loadError.message
          : "Inventory could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    void categoryService
      .list("", owner ? "all" : "true")
      .then((response) => setCategories(response.data.results));
  }, [owner]);
  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  function updateFilter(key: keyof InventoryFilters, value: string) {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  }

  const state = inventoryCollectionState(loading, items.length, error);
  const summaryCards: Array<{ label: string; value?: number; icon: LucideIcon; tone: "primary" | "success" | "warning" | "danger" }> = [
    { label: "Catalogue products", value: summary?.total_products, icon: Boxes, tone: "primary" },
    { label: "Inventory initialized", value: summary?.initialized, icon: CheckCircle2, tone: "success" },
    { label: "Low stock", value: summary?.low_stock, icon: AlertTriangle, tone: "warning" },
    { label: "Out of stock", value: summary?.out_of_stock, icon: PackageX, tone: "danger" },
  ];

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Stock control"
        title="Inventory"
        description={
          owner
            ? "Track balances and record auditable stock adjustments."
            : "View current stock for the active product catalogue."
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summaryCards.map(({ label, value, icon, tone }) => loading && !summary
          ? <Skeleton key={label} className="h-28" />
          : <MetricCard key={label} label={label} value={value ?? 0} icon={icon} tone={tone} />)}
      </div>

      <FilterToolbar
        result={<><span className="font-semibold tabular-nums text-foreground">{count}</span> matching inventory {count === 1 ? "product" : "products"}</>}
        status={filters.search || filters.category || filters.stock_status || filters.is_active ? <Button size="sm" variant="ghost" onClick={() => { setSearchDraft(""); setPage(1); setFilters({}); }}>Clear filters</Button> : null}
      >
        <form
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(240px,1fr)_200px_190px_150px_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            updateFilter("search", searchDraft);
          }}
        >
          <SearchInput
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Search product, SKU, or barcode"
              aria-label="Search inventory"
          />
          <Select
            aria-label="Category filter"
            value={filters.category ?? ""}
            onChange={(event) => updateFilter("category", event.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Stock status filter"
            value={filters.stock_status ?? ""}
            onChange={(event) => updateFilter("stock_status", event.target.value)}
          >
            <option value="">All stock statuses</option>
            <option value="NOT_INITIALIZED">Not initialized</option>
            <option value="IN_STOCK">In stock</option>
            <option value="LOW_STOCK">Low stock</option>
            <option value="OUT_OF_STOCK">Out of stock</option>
          </Select>
          {owner ? (
            <Select
              aria-label="Product status filter"
              value={filters.is_active ?? ""}
              onChange={(event) => updateFilter("is_active", event.target.value)}
            >
              <option value="">All products</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </Select>
          ) : null}
          <Button type="submit" variant="secondary" className="sm:col-span-2 xl:col-span-1">Search</Button>
        </form>
      </FilterToolbar>

      {state === "loading" ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : null}
      {state === "error" ? (
        <ErrorState
          title="Inventory unavailable"
          description={error ?? ""}
          onRetry={() => void load()}
        />
      ) : null}
      {state === "empty" ? (
        <EmptyState
          title="No inventory products found"
          description="Try a different search or stock-status filter."
        />
      ) : null}
      {state === "ready" ? (
        <>
          <TableFrame>
            <table className="premium-table">
              <thead className="bg-surface-secondary text-xs uppercase tracking-wide text-text-muted">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-right">On hand</th>
                  <th className="px-4 py-3 text-right">Threshold</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Last movement</th>
                  <th className="px-4 py-3"><span className="sr-only">Details</span></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.product.id} className="border-t border-border transition-colors hover:bg-surface-subtle">
                    <td className="px-4 py-4">
                      <p className="font-semibold">{item.product.name}</p>
                      <p className="text-xs text-text-muted">{item.product.sku}</p>
                    </td>
                    <td className="px-4 py-4 text-text-secondary">
                      {item.product.category?.name ?? "Uncategorized"}
                    </td>
                    <td className="px-4 py-4 text-right font-semibold">
                      <QuantityDisplay value={item.quantity_on_hand ?? "—"} unit={item.is_initialized ? item.product.unit : undefined} />
                    </td>
                    <td className="px-4 py-4 text-right text-text-secondary">
                      <QuantityDisplay value={item.low_stock_threshold ?? "—"} unit={item.is_initialized ? item.product.unit : undefined} />
                    </td>
                    <td className="px-4 py-4"><StockStatusBadge status={item.stock_status} /></td>
                    <td className="px-4 py-4 text-xs text-text-muted">{formatMovementTime(item.last_movement_at)}</td>
                    <td className="px-4 py-4 text-right">
                      <Link className="font-semibold text-primary" href={`/inventory/${item.product.id}`}>
                        {owner ? "Manage" : "View"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableFrame>
          <div className="space-y-3 md:hidden">
            {items.map((item) => (
              <Link key={item.product.id} href={`/inventory/${item.product.id}`} className="block">
                <Card className="p-4 transition-colors hover:bg-surface-secondary">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold">{item.product.name}</h2>
                      <p className="mt-1 text-xs text-text-muted">
                        {item.product.sku} · {item.product.category?.name ?? "Uncategorized"}
                      </p>
                    </div>
                    <StockStatusBadge status={item.stock_status} />
                  </div>
                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <p className="text-xs text-text-muted">Quantity on hand</p>
                      <p className="text-lg font-bold"><QuantityDisplay value={item.quantity_on_hand ?? "—"} unit={item.is_initialized ? item.product.unit : undefined} /></p>
                    </div>
                    <Boxes className="size-5 text-text-muted" aria-hidden="true" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
          <Pagination count={count} noun="product" page={page} hasNext={hasNext} onPrevious={() => setPage((value) => value - 1)} onNext={() => setPage((value) => value + 1)} />
        </>
      ) : null}
    </div>
  );
}
