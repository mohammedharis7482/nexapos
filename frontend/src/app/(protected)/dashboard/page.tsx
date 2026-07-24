"use client";

import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CreditCard,
  PackagePlus,
  PackageX,
  ReceiptText,
  RefreshCw,
  ShoppingCart,
  Sparkles,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Badge, MetricCard, MoneyDisplay, PageHeader, PaymentBadge, QuantityDisplay } from "@/components/ui/display";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { SectionCard } from "@/components/ui/layout";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import { dashboardService } from "@/services/dashboard.service";
import type { CashierDashboardSummary, DashboardData, InventoryAlert, OwnerDashboardSummary } from "@/types/dashboard";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function formatQar(value: string | number) {
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

function ActionBanner({ owner }: { owner: boolean }) {
  return (
    <section className="overflow-hidden rounded-[var(--radius-card)] border border-blue-200/70 bg-primary-soft">
      <div className="flex flex-col gap-5 px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3.5">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-white shadow-sm">
            <Sparkles className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-bold tracking-[-0.015em]">Ready for today&apos;s customers</h2>
            <p className="mt-1 text-sm text-text-secondary">Keep the catalogue current, stock accurate, and checkout moving.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {owner ? <Link href="/products" className="premium-action-secondary"><PackagePlus className="size-4" />Add Product</Link> : null}
          {owner ? <Link href="/inventory" className="premium-action-secondary"><Boxes className="size-4" />Update Stock</Link> : null}
          <Link href="/sales" className="premium-action-secondary"><ReceiptText className="size-4" />View Sales</Link>
          <Link href="/billing" className="premium-action-primary"><ShoppingCart className="size-4" />Start New Bill</Link>
        </div>
      </div>
    </section>
  );
}

function SalesOverview({ data }: { data: DashboardData["sales_trend"] }) {
  const values = data.map((point) => Number(point.sales_total));
  const max = Math.max(...values, 0);
  const total = values.reduce((sum, value) => sum + value, 0);
  const average = data.length ? total / data.length : 0;

  return (
    <SectionCard
      title="Sales overview"
      description="Last seven calendar days"
      action={<Badge tone="primary">7 days</Badge>}
    >
      <div className="grid gap-6 p-5 sm:p-6">
        <div className="flex flex-wrap gap-8">
          <div><p className="text-xs font-semibold text-text-muted">Weekly total</p><p className="mt-1 text-xl font-bold"><MoneyDisplay value={total} /></p></div>
          <div><p className="text-xs font-semibold text-text-muted">Daily average</p><p className="mt-1 text-xl font-bold"><MoneyDisplay value={average} /></p></div>
        </div>
        <div className="relative">
          <div className="pointer-events-none absolute inset-x-0 top-0 flex h-40 flex-col justify-between" aria-hidden="true">
            <span className="border-t border-dashed border-border" />
            <span className="border-t border-dashed border-border" />
            <span className="border-t border-dashed border-border" />
            <span className="border-t border-border" />
          </div>
          <div className="relative flex h-48 items-end gap-2 pt-2 sm:gap-4" role="img" aria-label="Seven-day sales chart">
            {data.map((point) => {
              const height = max ? Math.max((Number(point.sales_total) / max) * 100, 3) : 3;
              const label = new Intl.DateTimeFormat("en-QA", { weekday: "short" }).format(new Date(`${point.date}T12:00:00`));
              return (
                <div key={point.date} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end">
                  <span className="mb-1 hidden rounded-md bg-brand-navy px-2 py-1 text-[10px] font-semibold text-white group-hover:block sm:group-focus-within:block">
                    {formatQar(point.sales_total)}
                  </span>
                  <div className="flex h-36 w-full items-end justify-center">
                    <div
                      tabIndex={0}
                      aria-label={`${point.date}: ${formatQar(point.sales_total)}`}
                      className="w-full max-w-11 rounded-t-md bg-primary/85 transition-colors hover:bg-primary focus:bg-primary focus:outline-none focus:ring-4 focus:ring-[var(--focus-ring)]"
                      style={{ height: `${height}%` }}
                      title={`${point.date}: ${formatQar(point.sales_total)}`}
                    />
                  </div>
                  <span className="mt-2 text-[11px] font-medium text-text-muted">{label}</span>
                </div>
              );
            })}
          </div>
          {max === 0 ? <p className="absolute inset-0 grid place-items-center text-sm text-text-muted">No completed sales in this period.</p> : null}
        </div>
      </div>
    </SectionCard>
  );
}

function PaymentSummary({ data }: { data: DashboardData["payment_breakdown"] }) {
  const total = data.reduce((sum, item) => sum + Number(item.amount), 0);
  return (
    <SectionCard title="Payments today" description="Allocated sale payments">
      {total === 0 ? (
        <div className="p-5"><EmptyState title="No payments today" description="Payment totals will appear after the first completed sale." compact /></div>
      ) : (
        <div className="p-5 sm:p-6">
          <div className="space-y-6">
            {data.map((item) => (
              <div key={item.method}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-9 place-items-center rounded-lg bg-primary-soft text-primary">
                      {item.method === "CASH" ? <WalletCards className="size-4" /> : <CreditCard className="size-4" />}
                    </span>
                    <span className="text-sm font-semibold">{item.method === "CASH" ? "Cash" : "Card"}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-bold"><MoneyDisplay value={item.amount} /></p>
                    <p className="text-xs text-text-muted">{Number(item.percentage).toFixed(1)}%</p>
                  </div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-secondary">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${item.percentage}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
            <span className="text-sm font-semibold text-text-secondary">Total collected</span>
            <span className="text-lg font-bold"><MoneyDisplay value={total} /></span>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

function RecentSales({ data }: { data: DashboardData["recent_sales"] }) {
  return (
    <SectionCard
      title="Recent sales"
      description="Latest completed bills"
      action={<Link className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline" href="/sales">View all sales<ArrowRight className="size-4" /></Link>}
    >
      {data.length === 0 ? (
        <div className="p-5"><EmptyState title="No completed sales yet" description="Start a new bill to record the first sale." compact /></div>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="premium-table">
              <thead><tr><th>Sale number</th><th>Time</th><th>Items</th><th>Payment</th><th className="text-right">Total</th></tr></thead>
              <tbody>
                {data.map((sale) => (
                  <tr key={sale.id}>
                    <td><Link href={`/sales/${sale.id}`} className="font-semibold text-text-primary hover:text-primary">{sale.sale_number}</Link></td>
                    <td className="text-text-secondary">{formatDateTime(sale.completed_at)}</td>
                    <td>{sale.item_count}</td>
                    <td><PaymentBadge methods={sale.payment_methods} /></td>
                    <td className="text-right font-bold"><MoneyDisplay value={sale.grand_total} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-border md:hidden">
            {data.map((sale) => (
              <Link key={sale.id} href={`/sales/${sale.id}`} className="block p-4 hover:bg-surface-secondary">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="font-semibold">{sale.sale_number}</p><p className="mt-1 text-xs text-text-muted">{formatDateTime(sale.completed_at)} · {sale.item_count} items</p></div>
                  <p className="font-bold"><MoneyDisplay value={sale.grand_total} /></p>
                </div>
                <div className="mt-2"><PaymentBadge methods={sale.payment_methods} /></div>
              </Link>
            ))}
          </div>
        </>
      )}
    </SectionCard>
  );
}

function InventoryAttention({ groups }: { groups: DashboardData["inventory_alerts"] }) {
  const rows = [...groups.out_of_stock, ...groups.low_stock, ...groups.not_initialized];
  return (
    <SectionCard
      title="Inventory attention"
      description="Products that need review"
      action={<Link href="/inventory" className="text-sm font-semibold text-primary hover:underline">View inventory</Link>}
    >
      {rows.length === 0 ? (
        <div className="p-5"><EmptyState title="Inventory looks healthy" description="No low-stock or out-of-stock products." compact tone="success" /></div>
      ) : (
        <div className="divide-y divide-border">
          {rows.slice(0, 6).map((item) => <InventoryRow key={item.product_id} item={item} />)}
        </div>
      )}
    </SectionCard>
  );
}

function InventoryRow({ item }: { item: InventoryAlert }) {
  const tone = item.stock_status === "OUT_OF_STOCK" ? "danger" : item.stock_status === "LOW_STOCK" ? "warning" : "neutral";
  return (
    <Link href={`/inventory/${item.product_id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-secondary">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-secondary text-xs font-bold text-text-secondary">
        {item.product_name.slice(0, 2).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{item.product_name}</p>
        <p className="text-xs text-text-muted">{item.sku} · Threshold {item.low_stock_threshold ?? "—"}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold"><QuantityDisplay value={item.quantity_on_hand ?? "—"} unit={item.quantity_on_hand ? item.unit : undefined} /></p>
        <Badge tone={tone}>{item.stock_status.replaceAll("_", " ")}</Badge>
      </div>
    </Link>
  );
}

function DashboardContent({ data }: { data: DashboardData }) {
  const owner = data.role === "OWNER";
  const summary = data.summary;
  const cards = owner
    ? [
        ["Today’s sales", <MoneyDisplay key="value" value={(summary as OwnerDashboardSummary).sales_total_today} />, "Completed sales only", WalletCards, "primary"],
        ["Bills today", String((summary as OwnerDashboardSummary).completed_sales_count_today), "Completed bills", ReceiptText, "success"],
        ["Items sold", <QuantityDisplay key="value" value={(summary as OwnerDashboardSummary).items_sold_today} />, "Weighted quantities included", Boxes, "primary"],
        ["Low stock", String((summary as OwnerDashboardSummary).low_stock_count), "Active products", AlertTriangle, "warning"],
      ] as const
    : [
        ["My sales today", <MoneyDisplay key="value" value={(summary as CashierDashboardSummary).my_sales_total_today} />, "Your completed sales", WalletCards, "primary"],
        ["My completed bills", String((summary as CashierDashboardSummary).my_completed_sales_count_today), "Today", ReceiptText, "success"],
        ["My items sold", <QuantityDisplay key="value" value={(summary as CashierDashboardSummary).my_items_sold_today} />, "Weighted quantities included", Boxes, "primary"],
        ["My average bill", <MoneyDisplay key="value" value={(summary as CashierDashboardSummary).my_average_sale_value_today} />, "Today", CreditCard, "primary"],
      ] as const;

  return (
    <>
      <ActionBanner owner={owner} />
      <div className="grid grid-cols-1 gap-3 min-[430px]:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, detail, icon, tone]) => <MetricCard key={label} label={label} value={value} detail={detail} icon={icon} tone={tone} />)}
      </div>
      {owner ? (
        <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,.7fr)]">
          <SalesOverview data={data.sales_trend} />
          <PaymentSummary data={data.payment_breakdown} />
        </div>
      ) : <SalesOverview data={data.sales_trend} />}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,.75fr)]">
        <RecentSales data={data.recent_sales} />
        {owner ? <InventoryAttention groups={data.inventory_alerts} /> : (
          <SectionCard title="Quick actions" description="Continue your shift">
            <div className="grid gap-3 p-5"><Link className="premium-action-primary justify-center" href="/billing">Start a new bill</Link><Link className="premium-action-secondary justify-center" href="/products">Search products</Link></div>
          </SectionCard>
        )}
      </div>
      {owner ? (
        <SectionCard title="Top products today" description="Ranked by completed-sale revenue">
          {data.top_products.length ? (
            <div className="grid divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-3">
              {data.top_products.map((item) => (
                <div key={item.product_id} className="flex items-center gap-3 p-5">
                  <span className="grid size-9 place-items-center rounded-lg bg-primary-soft text-sm font-bold text-primary">{item.rank}</span>
                  <div className="min-w-0 flex-1"><p className="truncate font-semibold">{item.product_name}</p><p className="text-xs text-text-muted"><QuantityDisplay value={item.quantity_sold} /> sold</p></div>
                  <p className="font-bold"><MoneyDisplay value={item.sales_total} /></p>
                </div>
              ))}
            </div>
          ) : <div className="p-5"><EmptyState title="No product sales today" description="Top products will appear after completed sales." compact /></div>}
        </SectionCard>
      ) : null}
      {owner ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <MetricCard label="Out of stock" value={(summary as OwnerDashboardSummary).out_of_stock_count} detail="Active products" icon={PackageX} tone="danger" />
          <MetricCard label="Average bill" value={<MoneyDisplay value={(summary as OwnerDashboardSummary).average_sale_value_today} />} detail="Completed sales today" icon={CreditCard} />
        </div>
      ) : null}
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
        eyebrow="Overview"
        title={`${greeting()}, ${user.full_name.split(" ")[0]}`}
        description={`${user.shop.name}${updated ? ` · Dashboard updated ${updated}` : ""}`}
        action={<Button variant="secondary" loading={loading} onClick={() => void load()} leadingIcon={<RefreshCw className="size-4" />}>Refresh</Button>}
      />
      {loading && !data ? <div className="space-y-5" aria-label="Loading dashboard"><Skeleton className="h-24" /><div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div><Skeleton className="h-80" /></div> : null}
      {error && !data ? <ErrorState title="Dashboard unavailable" description={error} onRetry={() => void load()} /> : null}
      {data ? <DashboardContent data={data} /> : null}
    </div>
  );
}
