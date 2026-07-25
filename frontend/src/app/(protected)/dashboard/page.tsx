"use client";

import {
  ArrowRight,
  Boxes,
  CircleDollarSign,
  Clock3,
  PackagePlus,
  ReceiptText,
  RefreshCw,
  Search,
  ShoppingCart,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Badge, MetricCard, MoneyDisplay, PageHeader, QuantityDisplay } from "@/components/ui/display";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { MobileDataCard, SectionCard } from "@/components/ui/layout";
import { PaymentMethodBadge, StockStatusBadgeV2 } from "@/components/ui/status";
import { DataTable, DataTableBody, DataTableCell, DataTableHeader, DataTableHeading, DataTableRow } from "@/components/ui/table";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import { dashboardService } from "@/services/dashboard.service";
import type {
  CashierDashboardSummary,
  DashboardData,
  InventoryAlert,
  OwnerDashboardSummary,
  RecentSale,
} from "@/types/dashboard";

function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function zonedDate(value: string, timezone: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-QA", { timeZone: timezone, ...options }).format(new Date(value));
}

function formatUpdated(value: string, timezone: string) {
  return zonedDate(value, timezone, { dateStyle: "medium", timeStyle: "short" });
}

function formatSaleTime(value: string, timezone: string) {
  const saleDate = zonedDate(value, timezone, { year: "numeric", month: "2-digit", day: "2-digit" });
  const today = zonedDate(new Date().toISOString(), timezone, { year: "numeric", month: "2-digit", day: "2-digit" });
  const time = zonedDate(value, timezone, { hour: "numeric", minute: "2-digit" });
  return saleDate === today ? time : `${zonedDate(value, timezone, { month: "short", day: "numeric" })}, ${time}`;
}

function readableSaleNumber(value: string) {
  const parts = value.split("-");
  return parts.length > 2 ? parts.slice(-2).join("-") : value;
}

function ActionLink({
  href,
  children,
  primary = false,
}: {
  href: string;
  children: ReactNode;
  primary?: boolean;
}) {
  return <Link href={href} className={primary ? "premium-action-primary justify-center" : "premium-action-secondary justify-center"}>{children}</Link>;
}

function DashboardHeader({
  owner,
  firstName,
  shopName,
  updated,
  timezone,
  refreshing,
  onRefresh,
}: {
  owner: boolean;
  firstName: string;
  shopName: string;
  updated: string;
  timezone: string;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <PageHeader
      title={`${greeting()}, ${firstName}`}
      description={`${owner ? "Shop performance and operations" : "Your shift activity"} for ${shopName}. Last updated ${formatUpdated(updated, timezone)}.`}
      action={
        <>
          <Button variant="secondary" loading={refreshing} onClick={onRefresh} leadingIcon={<RefreshCw className="size-4" />}>Refresh</Button>
          <Link href="/billing" className="premium-action-primary"><ShoppingCart className="size-4" />Start New Bill</Link>
        </>
      }
    />
  );
}

function CommandStrip({ owner }: { owner: boolean }) {
  const actions = owner
    ? [
        { href: "/products", label: "Add Product", icon: PackagePlus },
        { href: "/inventory", label: "Update Stock", icon: Boxes },
        { href: "/sales", label: "View Sales", icon: ReceiptText },
      ]
    : [
        { href: "/products", label: "Search Products", icon: Search },
        { href: "/sales", label: "View My Sales", icon: ReceiptText },
      ];
  return (
    <section aria-labelledby="daily-work-title" className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-primary/20 bg-primary-soft/70 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div>
        <h2 id="daily-work-title" className="text-sm font-bold text-text-primary">Keep today&apos;s work moving</h2>
        <p className="mt-1 text-sm text-text-muted">{owner ? "Manage the essentials or open checkout." : "Open checkout or find a product quickly."}</p>
      </div>
      <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex">
        {actions.map(({ href, label, icon: Icon }) => <ActionLink key={href} href={href}><Icon className="size-4" />{label}</ActionLink>)}
        <ActionLink href="/billing" primary><ShoppingCart className="size-4" />Start New Bill</ActionLink>
      </div>
    </section>
  );
}

function PrimaryMetrics({ data }: { data: DashboardData }) {
  const owner = data.role === "OWNER";
  const summary = data.summary;
  const values = owner
    ? [
        ["Today’s Sales", <MoneyDisplay key="sales" value={(summary as OwnerDashboardSummary).sales_total_today} />, "Completed sales", WalletCards, "primary"],
        ["Bills Today", String((summary as OwnerDashboardSummary).completed_sales_count_today), "Completed bills", ReceiptText, "success"],
        ["Average Bill", <MoneyDisplay key="average" value={(summary as OwnerDashboardSummary).average_sale_value_today} />, "Completed sales", CircleDollarSign, "primary"],
        ["Items Sold", <QuantityDisplay key="items" value={(summary as OwnerDashboardSummary).items_sold_today} />, "Weighted quantities included", Boxes, "primary"],
      ] as const
    : [
        ["My Sales Today", <MoneyDisplay key="sales" value={(summary as CashierDashboardSummary).my_sales_total_today} />, "Your completed sales", WalletCards, "primary"],
        ["My Bills Today", String((summary as CashierDashboardSummary).my_completed_sales_count_today), "Your completed bills", ReceiptText, "success"],
        ["My Average Bill", <MoneyDisplay key="average" value={(summary as CashierDashboardSummary).my_average_sale_value_today} />, "Your completed sales", CircleDollarSign, "primary"],
        ["My Items Sold", <QuantityDisplay key="items" value={(summary as CashierDashboardSummary).my_items_sold_today} />, "Weighted quantities included", Boxes, "primary"],
      ] as const;
  return (
    <section aria-label="Today’s primary metrics" className="grid grid-cols-1 gap-3 min-[430px]:grid-cols-2 xl:grid-cols-4">
      {values.map(([label, value, detail, icon, tone]) => <MetricCard key={label} label={label} value={value} detail={detail} icon={icon} tone={tone} />)}
    </section>
  );
}

function SalesOverview({ data, timezone }: { data: DashboardData["sales_trend"]; timezone: string }) {
  const values = data.map((point) => Number(point.sales_total));
  const max = Math.max(...values, 0);
  const total = values.reduce((sum, value) => sum + value, 0);
  const average = data.length ? total / data.length : 0;
  const bills = data.reduce((sum, point) => sum + point.completed_sales_count, 0);
  const latestDate = data.at(-1)?.date;
  return (
    <SectionCard title="Sales Overview" description="Completed sales across the last seven calendar days" action={<Badge tone="primary">7 days</Badge>} className="h-full">
      <div className="p-5">
        <dl className="grid grid-cols-2 gap-3 border-b border-border-subtle pb-4 min-[430px]:grid-cols-3">
          <div><dt className="text-xs font-semibold text-text-muted">Seven-day total</dt><dd className="mt-1 text-lg font-bold"><MoneyDisplay value={total} /></dd></div>
          <div><dt className="text-xs font-semibold text-text-muted">Daily average</dt><dd className="mt-1 text-lg font-bold"><MoneyDisplay value={average} /></dd></div>
          <div className="col-span-2 min-[430px]:col-span-1"><dt className="text-xs font-semibold text-text-muted">Completed bills</dt><dd className="mt-1 text-lg font-bold tabular-nums">{bills}</dd></div>
        </dl>
        <div className="relative mt-5">
          <div className="pointer-events-none absolute inset-x-0 top-0 flex h-36 flex-col justify-between" aria-hidden="true">
            <span className="border-t border-dashed border-border" /><span className="border-t border-dashed border-border" /><span className="border-t border-dashed border-border" /><span className="border-t border-border" />
          </div>
          <div className="relative flex h-44 items-end gap-2 sm:gap-3" role="img" aria-label={`Seven-day sales chart. Total QAR ${total.toFixed(2)} across ${bills} completed bills.`}>
            {data.map((point) => {
              const value = Number(point.sales_total);
              const height = max === 0 ? 0 : (value / max) * 100;
              const today = point.date === latestDate;
              const label = zonedDate(`${point.date}T12:00:00Z`, timezone, { weekday: "short" });
              return (
                <div key={point.date} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end">
                  <div className="flex h-36 w-full items-end justify-center">
                    <div
                      tabIndex={0}
                      aria-label={`${label}: QAR ${value.toFixed(2)}, ${point.completed_sales_count} bills${today ? ", current day" : ""}`}
                      title={`${label}: QAR ${value.toFixed(2)} · ${point.completed_sales_count} bills`}
                      className={`w-full max-w-12 rounded-t-md border focus:outline-none focus:ring-4 focus:ring-[var(--focus-ring)] ${today ? "border-primary bg-primary" : "border-primary/20 bg-primary/55 hover:bg-primary/75"} ${value === 0 ? "h-1 bg-surface-muted" : ""}`}
                      style={value === 0 ? undefined : { height: `${Math.max(height, 5)}%` }}
                    />
                  </div>
                  <span className={`mt-2 text-[11px] font-semibold ${today ? "text-primary" : "text-text-muted"}`}>{label}</span>
                </div>
              );
            })}
          </div>
          {max === 0 ? <p className="absolute inset-x-0 top-12 text-center text-sm text-text-muted">No completed sales in this period</p> : null}
        </div>
      </div>
    </SectionCard>
  );
}

function PaymentSummary({ data }: { data: DashboardData["payment_breakdown"] }) {
  const total = data.reduce((sum, item) => sum + Number(item.amount), 0);
  return (
    <SectionCard title="Payments Today" description="Collected against completed sales" className="h-full">
      {total === 0 ? (
        <div className="p-5"><EmptyState title="No payments today" description="Complete the first sale to see the breakdown." compact action={<ActionLink href="/billing" primary>Start New Bill</ActionLink>} /></div>
      ) : (
        <div className="flex h-full flex-col p-5">
          <div className="space-y-5">
            {data.map((item) => (
              <div key={item.method}>
                <div className="flex items-center justify-between gap-3">
                  <PaymentMethodBadge method={item.method} />
                  <div className="text-right"><p className="font-bold"><MoneyDisplay value={item.amount} /></p><p className="text-xs text-text-muted">{Number(item.percentage).toFixed(1)}%</p></div>
                </div>
                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-muted" aria-hidden="true"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(Number(item.percentage), 100)}%` }} /></div>
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

function SalePayment({ methods }: { methods: RecentSale["payment_methods"] }) {
  return <div className="flex flex-wrap gap-1">{methods.map((method) => <PaymentMethodBadge key={method} method={method} />)}</div>;
}

function RecentSales({ data, owner, timezone }: { data: DashboardData["recent_sales"]; owner: boolean; timezone: string }) {
  const columns = owner ? 7 : 6;
  return (
    <SectionCard title="Recent Sales" description="Latest completed bills" action={<Link className="inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-primary hover:underline" href="/sales">View All Sales<ArrowRight className="size-4" /></Link>}>
      {data.length === 0 ? (
        <div className="p-5"><EmptyState title="No completed sales yet" description="Start a new bill to record the first sale." compact action={<ActionLink href="/billing" primary>Start New Bill</ActionLink>} /></div>
      ) : (
        <>
          <div className="hidden lg:block">
            <DataTable>
              <DataTableHeader><DataTableRow><DataTableHeading>Sale</DataTableHeading><DataTableHeading>Time</DataTableHeading>{owner ? <DataTableHeading>Cashier</DataTableHeading> : null}<DataTableHeading>Items</DataTableHeading><DataTableHeading>Payment</DataTableHeading><DataTableHeading align="right">Total</DataTableHeading><DataTableHeading><span className="sr-only">View</span></DataTableHeading></DataTableRow></DataTableHeader>
              <DataTableBody>
                {data.map((sale) => (
                  <DataTableRow key={sale.id} interactive>
                    <DataTableCell><Link title={sale.sale_number} href={`/sales/${sale.id}`} className="font-semibold text-text-primary hover:text-primary">{readableSaleNumber(sale.sale_number)}</Link></DataTableCell>
                    <DataTableCell className="text-text-secondary"><time dateTime={sale.completed_at}>{formatSaleTime(sale.completed_at, timezone)}</time></DataTableCell>
                    {owner ? <DataTableCell className="max-w-36 truncate text-text-secondary">{sale.cashier_name}</DataTableCell> : null}
                    <DataTableCell numeric>{sale.item_count} {sale.item_count === 1 ? "item" : "items"}</DataTableCell>
                    <DataTableCell><SalePayment methods={sale.payment_methods} /></DataTableCell>
                    <DataTableCell align="right" numeric className="font-bold"><MoneyDisplay value={sale.grand_total} /></DataTableCell>
                    <DataTableCell align="right"><Link href={`/sales/${sale.id}`} aria-label={`View sale ${sale.sale_number}`} className="inline-flex min-h-9 items-center text-sm font-semibold text-primary hover:underline">View</Link></DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </div>
          <div className="grid gap-3 p-4 lg:hidden" data-testid="recent-sales-cards">
            {data.map((sale) => (
              <MobileDataCard key={sale.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><Link title={sale.sale_number} href={`/sales/${sale.id}`} className="font-semibold hover:text-primary">{readableSaleNumber(sale.sale_number)}</Link><p className="mt-1 flex items-center gap-1 text-xs text-text-muted"><Clock3 className="size-3" />{formatSaleTime(sale.completed_at, timezone)} · {sale.item_count} {sale.item_count === 1 ? "item" : "items"}</p></div>
                  <p className="shrink-0 font-bold"><MoneyDisplay value={sale.grand_total} /></p>
                </div>
                <div className="mt-3 flex items-end justify-between gap-3"><div>{owner ? <p className="mb-1.5 text-xs text-text-muted">{sale.cashier_name}</p> : null}<SalePayment methods={sale.payment_methods} /></div><Link href={`/sales/${sale.id}`} aria-label={`View sale ${sale.sale_number}`} className="text-sm font-semibold text-primary hover:underline">View</Link></div>
              </MobileDataCard>
            ))}
          </div>
        </>
      )}
      <span className="sr-only">{columns} table columns</span>
    </SectionCard>
  );
}

function InventoryRow({ item, owner }: { item: InventoryAlert; owner: boolean }) {
  return (
    <li>
      <Link href={`/inventory/${item.product_id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-hover">
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.product_name}</p><p className="mt-0.5 truncate text-xs text-text-muted">{item.sku} · Threshold <QuantityDisplay value={item.low_stock_threshold ?? 0} unit={item.unit} /></p></div>
        <div className="shrink-0 text-right"><p className="mb-1 text-sm font-bold"><QuantityDisplay value={item.quantity_on_hand ?? 0} unit={item.unit} /></p><StockStatusBadgeV2 status={item.stock_status} /></div>
        {owner ? <span className="sr-only">Update stock</span> : null}
      </Link>
    </li>
  );
}

function InventoryAttention({ groups, owner }: { groups: DashboardData["inventory_alerts"]; owner: boolean }) {
  const rows = [...groups.out_of_stock, ...groups.low_stock, ...groups.not_initialized];
  return (
    <SectionCard title="Inventory Attention" description="Low, unavailable, or uninitialized stock" action={<Link href="/inventory" className="inline-flex min-h-9 items-center text-sm font-semibold text-primary hover:underline">View Inventory</Link>}>
      {rows.length === 0
        ? <div className="p-5"><EmptyState title="Inventory looks healthy" description="No low-stock, out-of-stock, or uninitialized products." compact tone="success" /></div>
        : <ul className="divide-y divide-border">{rows.slice(0, 5).map((item) => <InventoryRow key={item.product_id} item={item} owner={owner} />)}</ul>}
    </SectionCard>
  );
}

function TopProducts({ data }: { data: DashboardData["top_products"] }) {
  const maxRevenue = Math.max(...data.map((item) => Number(item.sales_total)), 0);
  return (
    <SectionCard title="Top Products" description="Today’s completed-sale performance">
      {data.length === 0 ? <div className="p-5"><EmptyState title="No product sales today" description="Top products will appear after completed sales." compact /></div> : (
        <ol className="divide-y divide-border">
          {data.slice(0, 5).map((item) => (
            <li key={item.product_id} className="flex items-center gap-3 px-5 py-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary">{item.rank}</span>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.product_name}</p><div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-muted"><div className="h-full rounded-full bg-primary/65" style={{ width: `${maxRevenue ? (Number(item.sales_total) / maxRevenue) * 100 : 0}%` }} /></div></div>
              <div className="shrink-0 text-right"><p className="text-sm font-bold"><MoneyDisplay value={item.sales_total} /></p><p className="text-xs text-text-muted"><QuantityDisplay value={item.quantity_sold} /> sold</p></div>
            </li>
          ))}
        </ol>
      )}
    </SectionCard>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-label="Loading dashboard" className="space-y-5">
      <div className="flex justify-between gap-4"><div className="space-y-3"><Skeleton className="h-8 w-56" /><Skeleton className="h-4 w-80 max-w-full" /></div><Skeleton className="hidden h-10 w-56 sm:block" /></div>
      <Skeleton className="h-24" />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-32" />)}</div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]"><Skeleton className="h-80" /><Skeleton className="h-80" /></div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]"><Skeleton className="h-72" /><Skeleton className="h-72" /></div>
      <Skeleton className="h-56" />
    </div>
  );
}

function DashboardContent({ data }: { data: DashboardData }) {
  const owner = data.role === "OWNER";
  return (
    <>
      <CommandStrip owner={owner} />
      <PrimaryMetrics data={data} />
      <div className={`grid items-stretch gap-5 ${owner ? "xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]" : ""}`}>
        <SalesOverview data={data.sales_trend} timezone={data.timezone} />
        {owner ? <PaymentSummary data={data.payment_breakdown} /> : null}
      </div>
      <div className={`grid items-start gap-5 ${owner ? "xl:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]" : ""}`}>
        <RecentSales data={data.recent_sales} owner={owner} timezone={data.timezone} />
        {owner ? <aside className="grid gap-5"><InventoryAttention groups={data.inventory_alerts} owner /><TopProducts data={data.top_products} /></aside> : null}
      </div>
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
  const updated = useMemo(() => data?.generated_at ?? null, [data]);
  if (!user) return null;
  return (
    <div className="page-stack">
      {updated ? <DashboardHeader owner={data?.role === "OWNER"} firstName={user.full_name.split(" ")[0]} shopName={user.shop.name} updated={updated} timezone={data?.timezone ?? user.shop.timezone} refreshing={loading} onRefresh={() => void load()} /> : null}
      {loading && !data ? <DashboardSkeleton /> : null}
      {error && !data ? <ErrorState title="Dashboard unavailable" description="NexaPOS could not load the dashboard. Check the server connection and try again." onRetry={() => void load()} /> : null}
      {error && data ? <div role="alert" className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-warning-border bg-warning-soft p-3 text-sm"><span>Refresh failed. The last loaded dashboard remains available.</span><Button size="sm" variant="secondary" onClick={() => void load()}>Retry</Button></div> : null}
      {data ? <DashboardContent data={data} /> : null}
    </div>
  );
}
