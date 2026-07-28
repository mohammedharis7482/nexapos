"use client";

import { Edit3, FolderCog, Plus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { canManageCatalogue } from "@/components/catalogue/access";
import { ProductDialog } from "@/components/catalogue/product-dialog";
import { Button, IconButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge, MoneyDisplay, PageHeader } from "@/components/ui/display";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { SearchInput, Select } from "@/components/ui/input";
import { FilterToolbar, Pagination, TableFrame } from "@/components/ui/layout";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import { categoryService } from "@/services/category.service";
import { productService } from "@/services/product.service";
import type { ProductCategory } from "@/types/category";
import { PRODUCT_UNITS, type Product, type ProductFilters } from "@/types/product";

export function productCollectionState(loading: boolean, count: number, error: string | null) {
  if (loading) return "loading";
  if (error) return "error";
  if (count === 0) return "empty";
  return "ready";
}

export default function ProductsPage() {
  const { user } = useAuth();
  const owner = canManageCatalogue(user?.role ?? "CASHIER");
  const initialized = useRef(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [searchDraft, setSearchDraft] = useState("");
  const [filters, setFilters] = useState<ProductFilters>({ ordering: "name" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const loadCategories = useCallback(async () => {
    const response = await categoryService.list("", owner ? "all" : "true");
    setCategories(response.data.results);
  }, [owner]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await productService.list({ ...filters, page, page_size: 25 });
      setProducts(response.data.results);
      setCount(response.data.count);
      setHasNext(Boolean(response.data.next));
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : "Products could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    void loadCategories().catch(() => setError("Categories could not be loaded."));
  }, [loadCategories]);
  useEffect(() => {
    queueMicrotask(() => void loadProducts());
  }, [loadProducts]);

  const state = productCollectionState(loading, products.length, error);
  function updateFilter(key: keyof ProductFilters, value: string) {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Catalogue"
        title="Products"
        description={owner ? "Manage your shop catalogue, pricing, barcodes, and active status." : "Search the active product catalogue."}
        action={
          <div className="flex gap-2">
            {owner ? <Button variant="secondary" leadingIcon={<FolderCog className="size-4" />} className="hidden sm:inline-flex" onClick={() => { window.location.href = "/products/categories"; }}>Categories</Button> : null}
            {owner ? <Button leadingIcon={<Plus className="size-4" />} onClick={() => { setEditing(null); setDialogOpen(true); }}>Add Product</Button> : null}
          </div>
        }
      />
      {owner ? <Link href="/products/categories" className="text-sm font-semibold text-primary sm:hidden">Manage categories</Link> : null}
      <FilterToolbar
        result={<><span className="font-semibold tabular-nums text-foreground">{count}</span> matching {count === 1 ? "product" : "products"}</>}
        status={filters.search || filters.category || filters.unit || filters.is_active ? <div className="flex items-center gap-2"><Badge tone="primary">Filters applied</Badge><Button size="sm" variant="ghost" onClick={() => { setSearchDraft(""); setPage(1); setFilters({ ordering: "name" }); }}>Clear</Button></div> : null}
      >
        <form
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(240px,1fr)_180px_150px_150px_auto]"
          onSubmit={(event) => { event.preventDefault(); updateFilter("search", searchDraft); }}
        >
          <SearchInput value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Search name, SKU, or barcode" aria-label="Search products" />
          <Select aria-label="Category filter" value={filters.category ?? ""} onChange={(event) => updateFilter("category", event.target.value)}>
            <option value="">All categories</option>
            {categories.filter((category) => category.is_active).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </Select>
          <Select aria-label="Unit filter" value={filters.unit ?? ""} onChange={(event) => updateFilter("unit", event.target.value)}>
            <option value="">All units</option>
            {PRODUCT_UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
          </Select>
          {owner ? (
            <Select aria-label="Status filter" value={filters.is_active ?? ""} onChange={(event) => updateFilter("is_active", event.target.value)}>
              <option value="">All statuses</option><option value="true">Active</option><option value="false">Inactive</option>
            </Select>
          ) : null}
          <Button type="submit" variant="secondary" className="sm:col-span-2 xl:col-span-1">Search</Button>
        </form>
      </FilterToolbar>

      {state === "loading" ? <div className="space-y-3"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div> : null}
      {state === "error" ? <ErrorState title="Products unavailable" description={error ?? ""} onRetry={() => void loadProducts()} /> : null}
      {state === "empty" ? <EmptyState title="No products found" description={filters.search ? "Try a different search or filter." : "Add the first catalogue product when you are ready."} /> : null}
      {state === "ready" ? (
        <>
          <TableFrame>
            <table className="premium-table">
              <thead className="bg-surface-secondary text-xs uppercase tracking-wide text-text-muted">
                <tr><th className="px-4 py-3">Product</th><th className="px-4 py-3">SKU / Barcode</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Unit</th><th className="px-4 py-3 text-right">Selling price</th><th className="px-4 py-3">Status</th>{owner ? <th className="px-4 py-3 text-right"><span className="sr-only">Actions</span></th> : null}</tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} className="border-t border-border transition-colors hover:bg-surface-subtle">
                    <td className="px-4 py-4 font-semibold">{product.name}</td>
                    <td className="px-4 py-4 text-text-secondary"><span className="block">{product.sku}</span><span className="text-xs text-text-muted">{product.barcode ?? "No barcode"}</span></td>
                    <td className="px-4 py-4 text-text-secondary">{product.category?.name ?? "Uncategorized"}</td>
                    <td className="px-4 py-4 text-text-secondary">{product.unit}</td>
                    <td className="px-4 py-4 text-right font-semibold"><MoneyDisplay value={product.selling_price} /></td>
                    <td className="px-4 py-4"><Badge tone={product.is_active ? "success" : "neutral"}>{product.is_active ? "Active" : "Inactive"}</Badge></td>
                    {owner ? <td className="px-4 py-4 text-right"><IconButton aria-label={`Edit ${product.name}`} onClick={() => { setEditing(product); setDialogOpen(true); }}><Edit3 className="size-4" /></IconButton></td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableFrame>
          <div className="space-y-3 md:hidden">
            {products.map((product) => (
              <Card key={product.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div><h2 className="font-semibold">{product.name}</h2><p className="mt-1 text-sm text-text-muted">{product.category?.name ?? "Uncategorized"} · {product.unit}</p></div>
                  {owner ? <IconButton aria-label={`Edit ${product.name}`} onClick={() => { setEditing(product); setDialogOpen(true); }}><Edit3 className="size-4" /></IconButton> : null}
                </div>
                <div className="mt-4 flex items-end justify-between gap-3"><div className="min-w-0 text-xs text-text-muted"><p className="break-words">{product.sku}</p><p className="break-words">{product.barcode ?? "No barcode"}</p></div><div className="shrink-0 text-right"><p className="font-bold"><MoneyDisplay value={product.selling_price} /></p><Badge tone={product.is_active ? "success" : "neutral"}>{product.is_active ? "Active" : "Inactive"}</Badge></div></div>
              </Card>
            ))}
          </div>
          <Pagination count={count} noun="product" page={page} hasNext={hasNext} onPrevious={() => setPage((value) => value - 1)} onNext={() => setPage((value) => value + 1)} />
        </>
      ) : null}
      <ProductDialog open={dialogOpen} onOpenChange={setDialogOpen} product={editing} categories={categories} onSaved={() => { void loadProducts(); void loadCategories(); }} />
    </div>
  );
}
