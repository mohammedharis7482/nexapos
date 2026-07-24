"use client";

import { ArrowLeft, Plus, Settings2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { AdjustmentDialog, movementOptions } from "@/components/inventory/adjustment-dialog";
import { OpeningStockDialog } from "@/components/inventory/opening-stock-dialog";
import { StockStatusBadge } from "@/components/inventory/stock-status";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge, PageHeader } from "@/components/ui/display";
import { Alert, EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { FormField, Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import { inventoryService } from "@/services/inventory.service";
import type { InventoryItem, StockMovement } from "@/types/inventory";

function movementLabel(type: StockMovement["movement_type"]) {
  if (type === "OPENING") return "Opening stock";
  return movementOptions.find((option) => option.value === type)?.label ?? type;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-QA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function InventoryDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const { user } = useAuth();
  const owner = user?.role === "OWNER";
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [movementCount, setMovementCount] = useState(0);
  const [movementPage, setMovementPage] = useState(1);
  const [hasNextMovements, setHasNextMovements] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [openingOpen, setOpeningOpen] = useState(false);
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [threshold, setThreshold] = useState("");
  const [thresholdSaving, setThresholdSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [detailResponse, movementResponse] = await Promise.all([
        inventoryService.detail(productId),
        inventoryService.movements(productId, movementPage),
      ]);
      setItem(detailResponse.data);
      setThreshold(detailResponse.data.low_stock_threshold ?? "0.000");
      setMovements(movementResponse.data.results);
      setMovementCount(movementResponse.data.count);
      setHasNextMovements(Boolean(movementResponse.data.next));
    } catch (loadError) {
      setError(
        loadError instanceof ApiError
          ? loadError.message
          : "Inventory details could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [movementPage, productId]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  async function refresh(message: string) {
    setSuccess(message);
    await load();
  }

  async function saveThreshold() {
    setThresholdSaving(true);
    setError(null);
    try {
      await inventoryService.updateThreshold(productId, threshold);
      await refresh("Low-stock threshold updated.");
    } catch (saveError) {
      setError(saveError instanceof ApiError ? saveError.message : "Threshold could not be updated.");
    } finally {
      setThresholdSaving(false);
    }
  }

  if (loading && !item) {
    return <div className="space-y-5"><Skeleton className="h-10 w-64" /><Skeleton className="h-52 w-full" /><Skeleton className="h-80 w-full" /></div>;
  }
  if (error && !item) {
    return <ErrorState title="Inventory unavailable" description={error} onRetry={() => void load()} />;
  }
  if (!item) return null;

  return (
    <div className="space-y-6 pb-4">
      <Link href="/inventory" className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
        <ArrowLeft className="size-4" /> Back to inventory
      </Link>
      <PageHeader
        title={item.product.name}
        description={`${item.product.sku} · ${item.product.category?.name ?? "Uncategorized"}`}
        action={
          owner ? (
            item.is_initialized ? (
              <Button leadingIcon={<Settings2 className="size-4" />} onClick={() => setAdjustmentOpen(true)}>Adjust stock</Button>
            ) : (
              <Button leadingIcon={<Plus className="size-4" />} onClick={() => setOpeningOpen(true)}>Configure opening stock</Button>
            )
          ) : undefined
        }
      />
      {success ? <Alert title={success} tone="success" /> : null}
      {error ? <Alert title={error} /> : null}

      <Card className="p-5">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Current stock</p>
            <p className="mt-2 text-2xl font-bold">{item.quantity_on_hand ?? "—"} {item.is_initialized ? item.product.unit : ""}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Status</p>
            <div className="mt-3"><StockStatusBadge status={item.stock_status} /></div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Barcode</p>
            <p className="mt-2 font-semibold">{item.product.barcode ?? "No barcode"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Product status</p>
            <div className="mt-3"><Badge tone={item.product.is_active ? "success" : "neutral"}>{item.product.is_active ? "Active" : "Inactive"}</Badge></div>
          </div>
        </div>
        {owner && item.is_initialized ? (
          <div className="mt-6 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-end">
            <FormField label="Low-stock threshold" htmlFor="detail-threshold">
              <Input id="detail-threshold" className="sm:w-48" inputMode="decimal" value={threshold} onChange={(event) => setThreshold(event.target.value)} />
            </FormField>
            <Button variant="secondary" loading={thresholdSaving} onClick={() => void saveThreshold()}>Update threshold</Button>
          </div>
        ) : null}
      </Card>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-bold">Movement history</h2>
          <p className="text-sm text-text-muted">Read-only audit trail · {movementCount} movements</p>
        </div>
        {movements.length === 0 ? (
          <EmptyState title="No stock movements" description="Configure opening stock to begin the inventory ledger." />
        ) : (
          <Card className="divide-y divide-border overflow-hidden">
            {movements.map((movement) => {
              const positive = Number(movement.quantity_delta) >= 0;
              return (
                <article key={movement.id} className="p-4 sm:p-5">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row">
                    <div>
                      <p className="font-semibold">{movementLabel(movement.movement_type)}</p>
                      <p className="mt-1 text-xs text-text-muted">{formatDate(movement.created_at)} · {movement.created_by.full_name}</p>
                    </div>
                    <p className={`font-bold ${positive ? "text-success" : "text-danger"}`}>
                      {positive ? "+" : ""}{movement.quantity_delta} {item.product.unit}
                      <span className="sr-only">{positive ? " increase" : " decrease"}</span>
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-text-secondary">
                    <span>Before: {movement.quantity_before}</span>
                    <span>After: {movement.quantity_after}</span>
                    {movement.reference ? <span>Reference: {movement.reference}</span> : null}
                  </div>
                  {movement.reason ? <p className="mt-2 text-sm text-text-muted">{movement.reason}</p> : null}
                </article>
              );
            })}
          </Card>
        )}
        {movementCount > 0 ? (
          <div className="flex justify-end gap-2">
            <Button variant="secondary" disabled={movementPage === 1} onClick={() => setMovementPage((page) => page - 1)}>Previous</Button>
            <Button variant="secondary" disabled={!hasNextMovements} onClick={() => setMovementPage((page) => page + 1)}>Next</Button>
          </div>
        ) : null}
      </section>

      <OpeningStockDialog
        open={openingOpen}
        onOpenChange={setOpeningOpen}
        productId={productId}
        productName={item.product.name}
        onSaved={() => void refresh("Opening stock configured.")}
      />
      {item.quantity_on_hand !== null ? (
        <AdjustmentDialog
          open={adjustmentOpen}
          onOpenChange={setAdjustmentOpen}
          productId={productId}
          productName={item.product.name}
          currentQuantity={item.quantity_on_hand}
          unit={item.product.unit}
          onSaved={() => void refresh("Inventory adjustment recorded.")}
        />
      ) : null}
    </div>
  );
}
