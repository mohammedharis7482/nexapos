"use client";

import {
  AlertTriangle,
  Boxes,
  CreditCard,
  PackageX,
  ReceiptText,
  RefreshCw,
  ShoppingCart,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge, PageHeader } from "@/components/ui/display";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import { dashboardService } from "@/services/dashboard.service";
import type {
  CashierDashboardSummary,
  DashboardData,
  InventoryAlert,
  OwnerDashboardSummary,
} from "@/types/dashboard";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function formatQar(value: string) {
  return new Intl.NumberFormat("en-QA", {
    style: "currency",
    currency: "QAR",
    minimumFractionDigits: 2,
  }).format(Number(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-QA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail?: string;
  icon: typeof ShoppingCart;
}) {
  return (
    <Card className="min-w-0 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</p>
          <p className="mt-2 truncate text-xl font-bold tracking-tight text-text-primary sm:text-2xl">{value}</p>
          {detail ? <p className="mt-1 text-xs text-text-muted">{detail}</p> : null}
        </div>
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      </div>
    </Card>
  );
}

function Trend({ data }: { data: DashboardData["sales_trend"] }) {
  const max = Math.max(...data.map((point) => Number(point.sales_total)), 0);
  return (
    <Card className="p-5">
      <h2 className="font-bold">Sales trend</h2>
      <p className="mt-1 text-sm text-text-muted">Last 7 calendar days</p>
      <div className="mt-5 flex h-44 items-end gap-2" aria-label="Seven-day sales trend">
        {data.map((point) => {
          const height = max ? Math.max((Number(point.sales_total) / max) * 100, 4) : 4;
          return (
            <div key={point.date} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div className="flex h-32 w-full items-end justify-center" title={`${point.date}: ${formatQar(point.sales_total)}`}>
                <div
                  className="w-full max-w-10 rounded-t-md bg-primary transition-[height]"
                  style={{ height: `${height}%` }}
                />
              </div>
              <span className="text-[11px] text-text-muted">
                {new Intl.DateTimeFormat("en-QA", { weekday: "short" }).format(new Date(`${point.date}T12:00:00`))}
              </span>
            </div>
          );
        })}
      </div>
      {max === 0 ? <p className="mt-2 text-center text-sm text-text-muted">No completed sales in this period.</p> : null}
    </Card>
  );
}

function PaymentBreakdown({ data }: { data: DashboardData["payment_breakdown"] }) {
  const total = data.reduce((sum, item) => sum + Number(item.amount), 0);
  return (
    <Card className="p-5">
      <h2 className="font-bold">Payments today</h2>
      <p className="mt-1 text-sm text-text-muted">Allocated sale payments</p>
      {total === 0 ? (
        <div className="py-12 text-center text-sm text-text-muted">No payments recorded today.</div>
      ) : (
        <div className="mt-6 space-y-5">
          {data.map((item) => (
            <div key={item.method}>
              <div className="flex justify-between gap-4 text-sm">
                <span className="font-semibold">{item.method === "CASH" ? "Cash" : "Card"}</span>
                <span>{formatQar(item.amount)} · {item.percentage}%</span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface-secondary">
                <div className="h-full rounded-full bg-primary" style={{ width: `${item.percentage}%` }} />
              </div>
            </div>
          ))}
          <div className="border-t border-border pt-4 text-sm font-bold">Total {formatQar(String(total))}</div>
        </div>
      )}
    </Card>
  );
}

function RecentSales({ data }: { data: DashboardData["recent_sales"] }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-4 p-5">
        <div><h2 className="font-bold">Recent sales</h2><p className="text-sm text-text-muted">Latest completed bills</p></div>
        <Link className="text-sm font-semibold text-primary hover:underline" href="/sales">View all sales</Link>
      </div>
      {data.length === 0 ? (
        <div className="px-5 pb-5"><EmptyState title="No completed sales" description="Completed bills will appear here." /></div>
      ) : (
        <div className="divide-y divide-border">
          {data.map((sale) => (
            <Link key={sale.id} href={`/sales/${sale.id}`} className="grid gap-1 px-5 py-4 hover:bg-surface-secondary sm:grid-cols-[1fr_auto]">
              <div>
                <p className="font-semibold">{sale.sale_number}</p>
                <p className="mt-1 text-xs text-text-muted">{formatDateTime(sale.completed_at)} · {sale.cashier_name} · {sale.item_count} items</p>
              </div>
              <div className="flex items-center justify-between gap-3 sm:block sm:text-right">
                <Badge>{sale.payment_methods.join(" + ")}</Badge>
                <p className="mt-1 font-bold">{formatQar(sale.grand_total)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

function AlertGroup({ title, rows }: { title: string; rows: InventoryAlert[] }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold">{title}</h3><Badge tone={rows.length ? "warning" : "success"}>{rows.length}</Badge></div>
      {rows.length ? rows.map((item) => (
        <Link key={item.product_id} href={`/inventory/${item.product_id}`} className="mb-2 flex min-h-12 items-center justify-between gap-3 rounded-xl border border-border px-3 py-2 hover:bg-surface-secondary">
          <div className="min-w-0"><p className="truncate text-sm font-semibold">{item.product_name}</p><p className="text-xs text-text-muted">{item.sku}</p></div>
          <span className="shrink-0 text-xs font-medium">{item.quantity_on_hand ?? "Not set"} {item.quantity_on_hand ? item.unit.toLowerCase() : ""}</span>
        </Link>
      )) : <p className="rounded-xl bg-success-soft p-3 text-sm text-success">No items</p>}
    </div>
  );
}

function DashboardContent({ data }: { data: DashboardData }) {
  const owner = data.role === "OWNER";
  const summary = data.summary;
  const cards = owner
    ? [
        ["Today’s sales", formatQar((summary as OwnerDashboardSummary).sales_total_today), "Completed sales only", WalletCards],
        ["Completed bills", String((summary as OwnerDashboardSummary).completed_sales_count_today), "Today", ReceiptText],
        ["Average bill", formatQar((summary as OwnerDashboardSummary).average_sale_value_today), "Today", CreditCard],
        ["Items sold", (summary as OwnerDashboardSummary).items_sold_today, "Weighted quantities included", Boxes],
        ["Low stock", String((summary as OwnerDashboardSummary).low_stock_count), "Active products", AlertTriangle],
        ["Out of stock", String((summary as OwnerDashboardSummary).out_of_stock_count), "Active products", PackageX],
      ] as const
    : [
        ["My sales today", formatQar((summary as CashierDashboardSummary).my_sales_total_today), "Your completed sales", WalletCards],
        ["My completed bills", String((summary as CashierDashboardSummary).my_completed_sales_count_today), "Today", ReceiptText],
        ["My average bill", formatQar((summary as CashierDashboardSummary).my_average_sale_value_today), "Today", CreditCard],
        ["My items sold", (summary as CashierDashboardSummary).my_items_sold_today, "Weighted quantities included", Boxes],
      ] as const;

  return (
    <>
      <div className={`grid grid-cols-2 gap-3 ${owner ? "xl:grid-cols-6" : "lg:grid-cols-4"}`}>
        {cards.map(([label, value, detail, icon]) => <MetricCard key={label} label={label} value={value} detail={detail} icon={icon} />)}
      </div>
      <div className="grid gap-5 lg:grid-cols-2"><Trend data={data.sales_trend} />{owner ? <PaymentBreakdown data={data.payment_breakdown} /> : <Card className="p-5"><h2 className="font-bold">Quick actions</h2><div className="mt-4 grid gap-3"><Link className="rounded-xl border border-border p-4 font-semibold hover:bg-surface-secondary" href="/billing">Start a new bill</Link><Link className="rounded-xl border border-border p-4 font-semibold hover:bg-surface-secondary" href="/products">Search products</Link></div></Card>}</div>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,.75fr)]">
        <RecentSales data={data.recent_sales} />
        <Card className="p-5">
          <div className="mb-5 flex items-center justify-between"><div><h2 className="font-bold">Inventory alerts</h2><p className="text-sm text-text-muted">Active product risks</p></div><Link className="text-sm font-semibold text-primary hover:underline" href="/inventory">View inventory</Link></div>
          <div className="space-y-5"><AlertGroup title="Low stock" rows={data.inventory_alerts.low_stock} /><AlertGroup title="Out of stock" rows={data.inventory_alerts.out_of_stock} /><AlertGroup title="Not initialized" rows={data.inventory_alerts.not_initialized} /></div>
        </Card>
      </div>
      {owner ? <Card className="p-5"><div className="flex items-center justify-between"><div><h2 className="font-bold">Top products today</h2><p className="text-sm text-text-muted">Ranked by quantity sold</p></div></div>{data.top_products.length ? <div className="mt-4 divide-y divide-border">{data.top_products.map((product) => <div key={product.product_id} className="grid grid-cols-[32px_1fr_auto] items-center gap-3 py-3"><span className="text-sm font-bold text-primary">#{product.rank}</span><div className="min-w-0"><p className="truncate font-semibold">{product.product_name}</p><p className="text-xs text-text-muted">{product.quantity_sold} sold · {product.sku}</p></div><strong>{formatQar(product.sales_total)}</strong></div>)}</div> : <p className="mt-4 rounded-xl border border-dashed border-border p-6 text-center text-sm text-text-muted">No completed product sales today.</p>}</Card> : null}
    </>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await dashboardService.get();
      setData(response.data);
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : "Dashboard data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  const updated = useMemo(() => data ? formatDateTime(data.generated_at) : null, [data]);
  if (!user) return null;
  return (
    <div className="page-stack">
      <PageHeader
        title={`${greeting()}, ${user.full_name.split(" ")[0]}`}
        description={`${user.shop.name}${updated ? ` · Updated ${updated}` : ""}`}
        action={<div className="flex gap-2"><Button variant="secondary" loading={loading} onClick={() => void load()} leadingIcon={<RefreshCw className="size-4" />}>Refresh</Button><Link href="/billing" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover"><ShoppingCart className="size-5" />Start New Bill</Link></div>}
      />
      {loading && !data ? <div className="space-y-5" aria-label="Loading dashboard"><div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div><Skeleton className="h-64" /></div> : null}
      {error && !data ? <ErrorState title="Dashboard unavailable" description={error} onRetry={() => void load()} /> : null}
      {data ? <DashboardContent data={data} /> : null}
    </div>
  );
}
