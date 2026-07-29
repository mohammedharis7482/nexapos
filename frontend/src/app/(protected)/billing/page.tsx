"use client";

import {
  Barcode,
  CheckCircle2,
  ReceiptText,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { CartLine } from "@/components/billing/cart-line";
import { PaymentDialog } from "@/components/billing/payment-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge, MoneyDisplay, PageHeader, QuantityDisplay } from "@/components/ui/display";
import { Alert, EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Input, Select } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/overlay";
import { ApiError } from "@/lib/api-client";
import { billingService } from "@/services/billing.service";
import { categoryService } from "@/services/category.service";
import { inventoryService } from "@/services/inventory.service";
import { shiftService } from "@/services/shift.service";
import type { DraftSale } from "@/types/billing";
import type { ProductCategory } from "@/types/category";
import type { InventoryItem } from "@/types/inventory";
import type { CompletedSale } from "@/types/sales";

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
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [completedSale, setCompletedSale] = useState<CompletedSale | null>(null);
  const [heldBills, setHeldBills] = useState<DraftSale[]>([]);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [holding, setHolding] = useState(false);
  const [shift, setShift] = useState<import("@/types/shift").CashierShift | null>(null);
  const [shiftRequired, setShiftRequired] = useState(false);

  const createFreshDraft = useCallback(async () => {
    const response = await billingService.create();
    localStorage.setItem(DRAFT_STORAGE_KEY, response.data.id);
    setDraft(response.data);
    return response.data;
  }, []);

  const loadHeldBills = useCallback(async () => {
    const response = await billingService.list();
    setHeldBills(response.data.results.filter((bill) => bill.status === "HELD"));
  }, []);

  const initializeDraft = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const currentShift = await shiftService.current();
      if (!currentShift.data) {
        setShiftRequired(true);
        return;
      }
      setShift(currentShift.data);
      setShiftRequired(false);
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
      await loadHeldBills();
    } catch (loadError) {
      setError(apiMessage(loadError, "A draft bill could not be prepared."));
    } finally {
      setLoading(false);
    }
  }, [createFreshDraft, loadHeldBills]);

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
    if (!draft) return;
    setCancelling(true);
    setError(null);
    try {
      await billingService.cancel(draft.id);
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      await createFreshDraft();
      await loadHeldBills();
      setSuccess("Draft cancelled. A new empty draft is ready.");
      setMobileView("products");
      setCancelOpen(false);
    } catch (cancelError) {
      setError(apiMessage(cancelError, "The draft could not be cancelled."));
    } finally {
      setCancelling(false);
    }
  }

  async function resumeBill(bill: DraftSale) {
    try {
      const response = await billingService.resume(bill.id);
      localStorage.setItem(DRAFT_STORAGE_KEY, bill.id);
      setDraft(response.data);
      setHeldBills((items) => items.filter((item) => item.id !== bill.id));
      setSuccess("Held bill resumed and revalidated.");
    } catch (caught) {
      setError(apiMessage(caught, "The held bill could not be resumed."));
    }
  }

  async function holdDraft() {
    if (!draft) return;
    setHolding(true);
    try {
      await billingService.hold(draft.id);
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      await createFreshDraft();
      setSuccess("Bill held. It can be resumed from the saved bills list.");
    } catch (caught) {
      setError(apiMessage(caught, "The bill could not be held."));
    } finally {
      setHolding(false);
    }
  }

  async function refreshAfterConflict() {
    if (!draft) return;
    try {
      const response = await billingService.detail(draft.id);
      setDraft(response.data);
      await searchProducts(search);
    } catch {
      setError("The draft could not be refreshed after the stock conflict.");
    }
  }

  async function startNewBill() {
    setLoading(true);
    setCompletedSale(null);
    setSuccess(null);
    setError(null);
    try {
      await createFreshDraft();
      setMobileView("products");
      queueMicrotask(() => searchRef.current?.focus());
    } catch (newDraftError) {
      setError(apiMessage(newDraftError, "A new draft could not be created."));
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
  if (shiftRequired) {
    return (
      <div className="mx-auto max-w-xl py-8">
        <Card className="p-6 text-center sm:p-8">
          <h1 className="text-2xl font-bold">Open a shift to start billing</h1>
          <p className="mt-2 text-sm leading-6 text-foreground-muted">NexaPOS needs an active cash-drawer shift before a bill can be completed.</p>
          <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
            <Link className="premium-action-primary justify-center" href="/sales/shifts/current">Open Shift</Link>
            <Link className="premium-action-secondary justify-center" href="/dashboard">Back to Dashboard</Link>
          </div>
        </Card>
      </div>
    );
  }
  if (completedSale) {
    const methods = completedSale.payments.map((payment) => payment.method).join(" + ");
    return (
      <div className="mx-auto max-w-2xl py-6">
        <Card className="overflow-hidden text-center">
          <div className="bg-success-soft px-6 py-8 sm:px-8">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-surface text-success shadow-sm"><CheckCircle2 className="size-9" /></span>
          <h1 className="mt-4 text-2xl font-bold">Payment recorded</h1>
          <p className="mt-2 text-sm text-text-muted">{completedSale.sale_number}</p>
          <p className="mt-6 text-3xl font-bold"><MoneyDisplay value={completedSale.grand_total} /></p>
          <p className="mt-2 text-sm text-text-secondary">{methods}</p>
          {Number(completedSale.change_due) > 0 ? (
            <p className="mt-2 font-semibold text-success">Change: <MoneyDisplay value={completedSale.change_due} /></p>
          ) : null}
          </div>
          <div className="grid gap-3 p-6 sm:grid-cols-2 sm:p-8">
            <Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface px-4 text-sm font-semibold" href={`/sales/${completedSale.id}/receipt`}>
              <ReceiptText className="size-4" /> View / Print Receipt
            </Link>
            <Button onClick={() => void startNewBill()}>Start New Bill</Button>
            <Link className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border-strong px-4 text-sm font-semibold" href={`/sales/${completedSale.id}`}>
              View Sale
            </Link>
            <Link className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border-strong px-4 text-sm font-semibold" href="/sales">
              View All Sales
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Point of sale"
        title="New Bill"
        description="Build a draft using live catalogue prices and current stock availability."
        action={<><Link className="premium-action-secondary" href="/sales/shifts/current">Shift open{shift ? ` · ${new Date(shift.opened_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}</Link><Badge tone="primary">Draft</Badge></>}
      />
      {error ? <Alert title={error} /> : null}
      {success ? <Alert title={success} tone="success" /> : null}
      {heldBills.length ? (
        <Card className="p-4">
          <h2 className="font-bold">Held bills</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {heldBills.map((bill) => (
              <div key={bill.id} className="flex items-center justify-between rounded-xl border border-border p-3">
                <div><p className="font-semibold">{bill.created_by.full_name}</p><p className="text-sm text-text-muted">{bill.items.length} lines · <MoneyDisplay value={bill.grand_total} /></p></div>
                <Button variant="outline" onClick={() => void resumeBill(bill)}>Resume</Button>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-2 lg:hidden">
        <Button variant={mobileView === "products" ? "primary" : "secondary"} onClick={() => setMobileView("products")}>Products</Button>
        <Button variant={mobileView === "cart" ? "primary" : "secondary"} leadingIcon={<ShoppingCart className="size-4" />} onClick={() => setMobileView("cart")}>
          Cart ({draft?.items.length ?? 0})
        </Button>
      </div>

      <div className="grid min-h-[calc(100dvh-13rem)] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_390px] xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className={`${mobileView === "products" ? "block" : "hidden"} space-y-4 lg:block`}>
          <Card className="p-3.5 sm:p-4">
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
                  className="min-h-12 pl-11 text-base"
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
            <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              <Skeleton className="h-36" /><Skeleton className="h-36" /><Skeleton className="h-36" />
            </div>
          ) : results.length === 0 ? (
            <EmptyState title="No products found" description="Search by product name, SKU, or barcode." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              {results.map((item) => {
                const available = availableForDraft(item);
                return (
                  <button
                    type="button"
                    key={item.product.id}
                    disabled={!available || busyItem !== null}
                    onClick={() => void addProduct(item.product.id)}
                    className="group min-h-36 rounded-[var(--radius-card)] border border-border bg-surface p-4 text-left shadow-[var(--shadow-card)] transition-colors hover:border-blue-300 hover:bg-primary-soft/40 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="font-semibold">{item.product.name}</h2>
                      <span className="shrink-0 font-bold text-primary"><MoneyDisplay value={item.product.selling_price} /></span>
                    </div>
                    <p className="mt-1 text-xs text-text-muted">{item.product.sku}</p>
                    <div className="mt-5 flex items-end justify-between">
                      <div>
                        <p className="text-xs text-text-muted">Available</p>
                        <p className="font-semibold"><QuantityDisplay value={item.quantity_on_hand ?? "—"} unit={item.product.unit} /></p>
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

        <aside className={`${mobileView === "cart" ? "block" : "hidden"} lg:sticky lg:top-[calc(var(--header-height)+1rem)] lg:block`}>
          <Card className="overflow-hidden border-border-strong">
            <header className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="font-bold">Current draft</h2>
                <p className="text-xs text-text-muted">{itemCount.toFixed(3)} total quantity</p>
              </div>
              <Button variant="ghost" leadingIcon={<Trash2 className="size-4" />} onClick={() => setCancelOpen(true)}>
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
                <div className="flex justify-between"><dt className="text-text-muted">Subtotal</dt><dd><MoneyDisplay value={draft?.subtotal ?? "0.00"} /></dd></div>
                <div className="flex justify-between"><dt className="text-text-muted">Tax</dt><dd><MoneyDisplay value={draft?.tax_total ?? "0.00"} /></dd></div>
                <div className="flex justify-between"><dt className="text-text-muted">Discount</dt><dd><MoneyDisplay value={draft?.discount_total ?? "0.00"} /></dd></div>
                <div className="flex justify-between border-t border-border pt-3 text-xl font-bold"><dt>Total</dt><dd><MoneyDisplay value={draft?.grand_total ?? "0.00"} /></dd></div>
              </dl>
              <Button
                className="mt-4 w-full"
                disabled={!draft?.items.length}
                onClick={() => setPaymentOpen(true)}
              >
                Continue to Payment
              </Button>
              <Button
                className="mt-2 w-full"
                variant="secondary"
                disabled={!draft?.items.length}
                loading={holding}
                onClick={() => void holdDraft()}
              >
                Hold Bill
              </Button>
            </div>
          </Card>
        </aside>
      </div>
      {draft ? (
        <PaymentDialog
          open={paymentOpen}
          onOpenChange={setPaymentOpen}
          draft={draft}
          onCompleted={(sale) => {
            localStorage.removeItem(DRAFT_STORAGE_KEY);
            setCompletedSale(sale);
            setDraft(null);
          }}
          onInventoryConflict={() => void refreshAfterConflict()}
        />
      ) : null}
      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel this draft?"
        description="The bill will no longer be editable. Its audit record will be retained and a new empty draft will be prepared."
        confirmLabel="Cancel draft"
        loading={cancelling}
        onConfirm={() => void cancelDraft()}
      />
    </div>
  );
}
