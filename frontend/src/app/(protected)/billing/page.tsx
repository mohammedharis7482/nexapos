"use client";

import {
  Barcode,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { CartLine } from "@/components/billing/cart-line";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge, PageHeader } from "@/components/ui/display";
import { Alert, EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Input, Select } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";
import { billingService } from "@/services/billing.service";
import { categoryService } from "@/services/category.service";
import { inventoryService } from "@/services/inventory.service";
import type { DraftSale } from "@/types/billing";
import type { ProductCategory } from "@/types/category";
import type { InventoryItem } from "@/types/inventory";

const DRAFT_STORAGE_KEY = "nexapos.activeDraftId";

export function billingWorkspaceState(
  loading: boolean,
  draft: DraftSale | null,
  error: string | null,
) {
  if (loading) return "loading";
  if (error && !draft) return "error";
  if (!draft) return "empty";
  return "ready";
}

export function availableForDraft(item: InventoryItem) {
  return item.product.is_active && item.is_initialized && Number(item.quantity_on_hand) > 0;
}

function apiMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

export default function BillingPage() {
  const initializationStarted = useRef(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<DraftSale | null>(null);
  const [results, setResults] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"products" | "cart">("products");

  const createFreshDraft = useCallback(async () => {
    const response = await billingService.create();
    localStorage.setItem(DRAFT_STORAGE_KEY, response.data.id);
    setDraft(response.data);
    return response.data;
  }, []);

  const initializeDraft = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const savedId = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (savedId) {
        try {
          const response = await billingService.detail(savedId);
          if (response.data.status === "DRAFT") {
            setDraft(response.data);
            return;
          }
        } catch {
          localStorage.removeItem(DRAFT_STORAGE_KEY);
        }
      }
      await createFreshDraft();
    } catch (loadError) {
      setError(apiMessage(loadError, "A draft bill could not be prepared."));
    } finally {
      setLoading(false);
    }
  }, [createFreshDraft]);

  const searchProducts = useCallback(async (term: string, categoryId = category) => {
    setSearching(true);
    try {
      const response = await inventoryService.list({
        search: term,
        category: categoryId,
        is_active: "true",
        page_size: 25,
      });
      setResults(response.data.results);
      return response.data.results;
    } catch (searchError) {
      setError(apiMessage(searchError, "Products could not be searched."));
      return [];
    } finally {
      setSearching(false);
    }
  }, [category]);

  useEffect(() => {
    if (initializationStarted.current) return;
    initializationStarted.current = true;
    void initializeDraft();
    void categoryService
      .list("", "true")
      .then((response) => setCategories(response.data.results));
    queueMicrotask(() => searchRef.current?.focus());
  }, [initializeDraft]);

  useEffect(() => {
    const timer = window.setTimeout(() => void searchProducts(search), 250);
    return () => window.clearTimeout(timer);
  }, [search, category, searchProducts]);

  async function addProduct(productId: string) {
    if (!draft) return;
    setBusyItem(productId);
    setError(null);
    setSuccess(null);
    try {
      const response = await billingService.addItem(draft.id, {
        product_id: productId,
        quantity: "1.000",
      });
      setDraft(response.data);
      setSuccess("Product added to the draft.");
      setSearch("");
      searchRef.current?.focus();
    } catch (addError) {
      setError(apiMessage(addError, "The product could not be added."));
    } finally {
      setBusyItem(null);
    }
  }

  async function submitSearch() {
    const term = search.trim();
    if (!term) return;
    const items = await searchProducts(term);
    const exact = items.find(
      (item) =>
        item.product.barcode?.toLowerCase() === term.toLowerCase()
        || item.product.sku.toLowerCase() === term.toLowerCase(),
    );
    if (exact) await addProduct(exact.product.id);
  }

  async function updateQuantity(itemId: string, quantity: string) {
    if (!draft) return;
    setBusyItem(itemId);
    setError(null);
    try {
      const response = await billingService.updateItem(
        draft.id,
        itemId,
        { quantity },
      );
      setDraft(response.data);
    } catch (updateError) {
      setError(apiMessage(updateError, "The quantity could not be updated."));
    } finally {
      setBusyItem(null);
    }
  }

  async function removeItem(itemId: string) {
    if (!draft) return;
    setBusyItem(itemId);
    setError(null);
    try {
      const response = await billingService.removeItem(draft.id, itemId);
      setDraft(response.data);
    } catch (removeError) {
      setError(apiMessage(removeError, "The item could not be removed."));
    } finally {
      setBusyItem(null);
    }
  }

  async function cancelDraft() {
    if (!draft || !window.confirm("Cancel this draft bill? Its audit record will be retained.")) return;
    setLoading(true);
    setError(null);
    try {
      await billingService.cancel(draft.id);
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      await createFreshDraft();
      setSuccess("Draft cancelled. A new empty draft is ready.");
      setMobileView("products");
    } catch (cancelError) {
      setError(apiMessage(cancelError, "The draft could not be cancelled."));
    } finally {
      setLoading(false);
    }
  }

  const state = billingWorkspaceState(loading, draft, error);
  const itemCount = draft?.items.reduce(
    (total, item) => total + Number(item.quantity),
    0,
  ) ?? 0;

  if (state === "loading") {
    return <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]"><Skeleton className="h-[620px]" /><Skeleton className="h-[620px]" /></div>;
  }
  if (state === "error") {
    return <ErrorState title="Billing unavailable" description={error ?? ""} onRetry={() => void initializeDraft()} />;
  }

  return (
    <div className="space-y-4 pb-4">
      <PageHeader
        title="New Bill"
        description="Build a draft using live catalogue prices and current stock availability."
        action={<Badge tone="primary">Draft</Badge>}
      />
      {error ? <Alert title={error} /> : null}
      {success ? <Alert title={success} tone="success" /> : null}

      <div className="grid grid-cols-2 gap-2 lg:hidden">
        <Button variant={mobileView === "products" ? "primary" : "secondary"} onClick={() => setMobileView("products")}>Products</Button>
        <Button variant={mobileView === "cart" ? "primary" : "secondary"} leadingIcon={<ShoppingCart className="size-4" />} onClick={() => setMobileView("cart")}>
          Cart ({draft?.items.length ?? 0})
        </Button>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className={`${mobileView === "products" ? "block" : "hidden"} space-y-4 lg:block`}>
          <Card className="p-4">
            <form
              className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_190px]"
              onSubmit={(event) => {
                event.preventDefault();
                void submitSearch();
              }}
            >
              <div className="relative">
                <Barcode className="absolute left-3.5 top-3.5 size-5 text-text-muted" />
                <Input
                  ref={searchRef}
                  className="pl-11"
                  aria-label="Product or barcode search"
                  placeholder="Scan barcode or search name / SKU"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <Select
                aria-label="Billing category filter"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                <option value="">All categories</option>
                {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </Select>
            </form>
          </Card>

          {searching ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Skeleton className="h-36" /><Skeleton className="h-36" /><Skeleton className="h-36" />
            </div>
          ) : results.length === 0 ? (
            <EmptyState title="No products found" description="Search by product name, SKU, or barcode." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {results.map((item) => {
                const available = availableForDraft(item);
                return (
                  <button
                    type="button"
                    key={item.product.id}
                    disabled={!available || busyItem !== null}
                    onClick={() => void addProduct(item.product.id)}
                    className="min-h-36 rounded-2xl border border-border bg-surface p-4 text-left transition-colors hover:border-primary hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="font-semibold">{item.product.name}</h2>
                      <span className="shrink-0 font-bold text-primary">QAR {item.product.selling_price}</span>
                    </div>
                    <p className="mt-1 text-xs text-text-muted">{item.product.sku}</p>
                    <div className="mt-5 flex items-end justify-between">
                      <div>
                        <p className="text-xs text-text-muted">Available</p>
                        <p className="font-semibold">{item.quantity_on_hand ?? "—"} {item.product.unit}</p>
                      </div>
                      <Badge tone={
                        item.stock_status === "IN_STOCK"
                          ? "success"
                          : item.stock_status === "LOW_STOCK"
                            ? "warning"
                            : "danger"
                      }>
                        {item.stock_status.replaceAll("_", " ")}
                      </Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <aside className={`${mobileView === "cart" ? "block" : "hidden"} lg:sticky lg:top-4 lg:block`}>
          <Card className="overflow-hidden">
            <header className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="font-bold">Current draft</h2>
                <p className="text-xs text-text-muted">{itemCount.toFixed(3)} total quantity</p>
              </div>
              <Button variant="ghost" leadingIcon={<Trash2 className="size-4" />} onClick={() => void cancelDraft()}>
                Cancel
              </Button>
            </header>
            <div className="max-h-[48vh] overflow-y-auto px-5 lg:max-h-[390px]">
              {draft?.items.length ? draft.items.map((item) => (
                <CartLine
                  key={`${item.id}-${item.quantity}`}
                  item={item}
                  busy={busyItem === item.id}
                  onQuantity={(quantity) => void updateQuantity(item.id, quantity)}
                  onRemove={() => void removeItem(item.id)}
                />
              )) : (
                <div className="py-10 text-center">
                  <ShoppingCart className="mx-auto size-8 text-text-muted" />
                  <p className="mt-3 font-semibold">Cart is empty</p>
                  <p className="mt-1 text-sm text-text-muted">Search or scan a product to begin.</p>
                </div>
              )}
            </div>
            <div className="border-t border-border bg-surface-secondary p-5">
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-text-muted">Items</dt><dd>{draft?.items.length ?? 0}</dd></div>
                <div className="flex justify-between"><dt className="text-text-muted">Subtotal</dt><dd>QAR {draft?.subtotal ?? "0.00"}</dd></div>
                <div className="flex justify-between"><dt className="text-text-muted">Tax</dt><dd>QAR {draft?.tax_total ?? "0.00"}</dd></div>
                <div className="flex justify-between"><dt className="text-text-muted">Discount</dt><dd>QAR {draft?.discount_total ?? "0.00"}</dd></div>
                <div className="flex justify-between border-t border-border pt-3 text-lg font-bold"><dt>Total</dt><dd>QAR {draft?.grand_total ?? "0.00"}</dd></div>
              </dl>
              <Button className="mt-4 w-full" disabled>Continue to Payment — next phase</Button>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
