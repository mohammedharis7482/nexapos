"use client";

import { BarChart3, Boxes, CreditCard, PackageSearch, RefreshCw, Users } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge, PageHeader } from "@/components/ui/display";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Input, Select } from "@/components/ui/input";
import { FilterToolbar } from "@/components/ui/layout";
import { ApiError } from "@/lib/api-client";
import { categoryService } from "@/services/category.service";
import { reportsService } from "@/services/reports.service";
import { salesService } from "@/services/sales.service";
import type { DraftCreator } from "@/types/billing";
import type { ProductCategory } from "@/types/category";
import type { ReportFilters, ReportsData } from "@/types/reports";

type ReportTab = "sales" | "products" | "inventory" | "payments" | "cashiers";
const tabs: Array<{ id: ReportTab; label: string; icon: typeof BarChart3 }> = [
  { id: "sales", label: "Sales", icon: BarChart3 },
  { id: "products", label: "Products", icon: PackageSearch },
  { id: "inventory", label: "Inventory", icon: Boxes },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "cashiers", label: "Cashiers", icon: Users },
];

function isoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function defaultReportFilters(now = new Date()): ReportFilters {
  const from = new Date(now);
  from.setDate(from.getDate() - 6);
  return { date_from: isoDate(from), date_to: isoDate(now), payment_method: "" };
}

function presetFilters(days: number, now = new Date()): Pick<ReportFilters, "date_from" | "date_to"> {
  const from = new Date(now);
  from.setDate(from.getDate() - (days - 1));
  return { date_from: isoDate(from), date_to: isoDate(now) };
}

function qar(value: string) {
  return new Intl.NumberFormat("en-QA", { style: "currency", currency: "QAR" }).format(Number(value));
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <Card className="min-w-0 p-[var(--card-padding)]"><p className="text-xs font-semibold text-text-muted">{label}</p><p className="mt-2 whitespace-nowrap text-xl font-bold tracking-[-0.025em]">{value}</p>{detail ? <p className="mt-1 text-xs text-text-muted">{detail}</p> : null}</Card>;
}

function SalesReportView({ data }: { data: ReportsData }) {
  const max = Math.max(...data.sales.daily.map((row) => Number(row.sales_total)), 0);
  return <div className="space-y-5">
    <div className="grid grid-cols-1 gap-3 min-[430px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <SummaryCard label="Gross sales" value={qar(data.sales.gross_sales)} />
      <SummaryCard label="Completed bills" value={String(data.sales.completed_sales_count)} />
      <SummaryCard label="Average bill" value={qar(data.sales.average_sale_value)} />
      <SummaryCard label="Items sold" value={data.sales.items_sold} />
      <SummaryCard label="Tax" value={qar(data.sales.tax_total)} />
      <SummaryCard label="Discounts" value={qar(data.sales.discount_total)} />
    </div>
    <Card className="p-5 sm:p-6"><h2 className="font-bold">Sales by day</h2><p className="mt-1 text-sm text-text-muted">Completed-sale totals for the selected period</p><div className="relative mt-5"><div className="pointer-events-none absolute inset-x-0 top-0 flex h-36 flex-col justify-between"><span className="border-t border-dashed border-border" /><span className="border-t border-dashed border-border" /><span className="border-t border-dashed border-border" /><span className="border-t border-border" /></div><div className="relative flex h-52 items-end gap-1.5 overflow-x-auto" aria-label="Sales report chart">{data.sales.daily.map((row) => <div key={row.date} className="flex min-w-10 flex-1 flex-col items-center gap-2"><div className="flex h-36 w-full items-end justify-center" title={`${row.date}: ${qar(row.sales_total)}`}><div className="w-full max-w-9 rounded-t bg-primary/85" style={{ height: `${max ? Math.max(Number(row.sales_total) / max * 100, 3) : 3}%` }} /></div><span className="text-[10px] text-text-muted">{row.date.slice(5)}</span></div>)}</div>{max === 0 ? <p className="text-center text-sm text-text-muted">No completed sales in this range.</p> : null}</div></Card>
  </div>;
}

function ProductsReportView({ data }: { data: ReportsData }) {
  if (!data.products.length) return <EmptyState title="No product sales" description="No completed product sales match these filters." />;
  return <Card className="overflow-hidden"><div className="divide-y divide-border">{data.products.map((row) => <div key={row.product_id} className="grid grid-cols-[36px_1fr_auto] items-center gap-3 p-4"><strong className="text-primary">#{row.rank}</strong><div className="min-w-0"><Link href={`/products?search=${encodeURIComponent(row.sku)}`} className="truncate font-semibold hover:text-primary">{row.product_name}</Link><p className="text-xs text-text-muted">{row.sku} · {row.quantity_sold} {row.unit.toLowerCase()} · {row.sales_count} bills</p></div><strong>{qar(row.sales_total)}</strong></div>)}</div></Card>;
}

function InventoryReportView({ data }: { data: ReportsData }) {
  const report = data.inventory;
  return <div className="space-y-5"><div className="grid grid-cols-1 gap-3 min-[430px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"><SummaryCard label="Active products" value={String(report.active_products)} /><SummaryCard label="Quantity on hand" value={report.quantity_on_hand} /><SummaryCard label="In stock" value={String(report.in_stock)} /><SummaryCard label="Low stock" value={String(report.low_stock)} /><SummaryCard label="Out of stock" value={String(report.out_of_stock)} /><SummaryCard label="Not initialized" value={String(report.not_initialized)} /></div>{report.items.length ? <Card className="overflow-hidden"><div className="divide-y divide-border">{report.items.map((row) => <Link key={row.product_id} href={`/inventory/${row.product_id}`} className="flex items-center justify-between gap-4 p-4 hover:bg-surface-secondary"><div className="min-w-0"><p className="break-words font-semibold">{row.product_name}</p><p className="break-words text-xs text-text-muted">{row.sku} · {row.category ?? "Uncategorized"}</p></div><div className="shrink-0 text-right"><Badge tone={row.stock_status === "IN_STOCK" ? "success" : row.stock_status === "LOW_STOCK" ? "warning" : "danger"}>{row.stock_status.replaceAll("_", " ")}</Badge><p className="mt-1 text-xs">{row.quantity_on_hand ?? "Not set"}</p></div></Link>)}</div></Card> : <EmptyState title="No inventory rows" description="No active products match this category." />}</div>;
}

function PaymentsReportView({ data }: { data: ReportsData }) {
  const total = data.payments.reduce((sum, row) => sum + Number(row.amount), 0);
  return <Card className="p-5"><h2 className="font-bold">Allocated payments</h2><p className="mt-1 text-sm text-text-muted">Tendered cash and change are excluded.</p>{total ? <div className="mt-6 space-y-6">{data.payments.map((row) => <div key={row.method}><div className="flex justify-between text-sm"><strong>{row.method === "CASH" ? "Cash" : "Card"}</strong><span>{qar(row.amount)} · {row.percentage}%</span></div><div className="mt-2 h-3 overflow-hidden rounded-full bg-surface-secondary"><div className="h-full rounded-full bg-primary" style={{ width: `${row.percentage}%` }} /></div><p className="mt-2 text-xs text-text-muted">{row.payment_count} allocations across {row.sale_count} sales</p></div>)}</div> : <div className="mt-5"><EmptyState title="No payments" description="No allocated payments match this report range." /></div>}</Card>;
}

function CashiersReportView({ data }: { data: ReportsData }) {
  if (!data.cashiers.length) return <EmptyState title="No cashier sales" description="No cashier performance data matches these filters." />;
  return <div className="grid gap-3 lg:grid-cols-2">{data.cashiers.map((row) => <Card key={row.cashier_id} className="p-5"><div className="flex justify-between gap-4"><div><h2 className="font-bold">{row.cashier_name}</h2><p className="mt-1 text-sm text-text-muted">{row.completed_sales_count} completed bills · {row.items_sold} items</p></div><strong>{qar(row.sales_total)}</strong></div><div className="mt-4 border-t border-border pt-3 text-sm">Average bill <strong className="float-right">{qar(row.average_sale_value)}</strong></div></Card>)}</div>;
}

export default function ReportsPage() {
  const [tab, setTab] = useState<ReportTab>("sales");
  const [filters, setFilters] = useState<ReportFilters>(() => defaultReportFilters());
  const [draftFilters, setDraftFilters] = useState<ReportFilters>(() => defaultReportFilters());
  const [data, setData] = useState<ReportsData | null>(null);
  const [cashiers, setCashiers] = useState<DraftCreator[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { const response = await reportsService.get(filters); setData(response.data); }
    catch (loadError) { setError(loadError instanceof ApiError ? loadError.message : "Reports could not be loaded."); }
    finally { setLoading(false); }
  }, [filters]);
  useEffect(() => { queueMicrotask(() => void load()); }, [load]);
  useEffect(() => { void Promise.all([salesService.cashiers(), categoryService.list("", "true")]).then(([users, groups]) => { setCashiers(users.data); setCategories(groups.data.results); }).catch(() => undefined); }, []);
  const updated = useMemo(() => data ? new Intl.DateTimeFormat("en-QA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(data.generated_at)) : null, [data]);
  const activePreset = [1, 7, 30].find((days) => {
    const preset = presetFilters(days);
    return draftFilters.date_from === preset.date_from && draftFilters.date_to === preset.date_to;
  });

  return <div className="page-stack">
    <PageHeader eyebrow="Analytics" title="Reports" description={`Owner operational reports${updated ? ` · Updated ${updated}` : ""}`} action={<Button variant="secondary" loading={loading} onClick={() => void load()} leadingIcon={<RefreshCw className="size-4" />}>Refresh</Button>} />
    <FilterToolbar>
      <div className="mb-3 flex flex-wrap items-center gap-2" aria-label="Report date presets">
        <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-text-muted">Period</span>
        {[["Today", 1], ["7 days", 7], ["30 days", 30]].map(([label, days]) => (
          <button key={label} type="button" aria-pressed={activePreset === Number(days)} className={`min-h-9 rounded-lg border px-3 text-xs font-semibold ${activePreset === Number(days) ? "border-primary bg-primary-soft text-primary" : "border-border hover:bg-surface-secondary"}`} onClick={() => setDraftFilters((current) => ({ ...current, ...presetFilters(Number(days)) }))}>{label}</button>
        ))}
      </div>
      <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-[repeat(5,minmax(0,1fr))_auto]" onSubmit={(event) => { event.preventDefault(); setFilters(draftFilters); }}>
      <Input aria-label="Report date from" type="date" value={draftFilters.date_from} onChange={(event) => setDraftFilters((current) => ({ ...current, date_from: event.target.value }))} />
      <Input aria-label="Report date to" type="date" value={draftFilters.date_to} onChange={(event) => setDraftFilters((current) => ({ ...current, date_to: event.target.value }))} />
      <Select aria-label="Report cashier" value={draftFilters.cashier ?? ""} onChange={(event) => setDraftFilters((current) => ({ ...current, cashier: event.target.value }))}><option value="">All cashiers</option>{cashiers.map((cashier) => <option key={cashier.id} value={cashier.id}>{cashier.full_name}</option>)}</Select>
      <Select aria-label="Report category" value={draftFilters.category ?? ""} onChange={(event) => setDraftFilters((current) => ({ ...current, category: event.target.value }))}><option value="">All categories</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</Select>
      <Select aria-label="Report payment method" value={draftFilters.payment_method ?? ""} onChange={(event) => setDraftFilters((current) => ({ ...current, payment_method: event.target.value as ReportFilters["payment_method"] }))}><option value="">All payments</option><option value="CASH">Cash</option><option value="CARD">Card</option></Select>
      <div className="grid grid-cols-2 gap-2 md:col-span-2 xl:col-span-1">
        <Button type="button" variant="ghost" onClick={() => { const reset = defaultReportFilters(); setDraftFilters(reset); setFilters(reset); }}>Reset</Button>
            <Button type="submit">Apply filters</Button>
      </div>
    </form></FilterToolbar>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" role="tablist" aria-label="Report type">{tabs.map(({ id, label, icon: Icon }) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`min-h-16 rounded-xl border px-3 text-sm font-semibold shadow-[var(--shadow-sm)] transition-colors ${tab === id ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface hover:border-border-strong hover:bg-surface-secondary"}`}><Icon className="mx-auto mb-1 size-4" />{label}</button>)}</div>
    {loading && !data ? <div aria-label="Loading reports" className="space-y-3"><Skeleton className="h-28" /><Skeleton className="h-72" /></div> : null}
    {error && !data ? <ErrorState title="Reports unavailable" description={error} onRetry={() => void load()} /> : null}
    {data ? <>{tab === "sales" ? <SalesReportView data={data} /> : null}{tab === "products" ? <ProductsReportView data={data} /> : null}{tab === "inventory" ? <InventoryReportView data={data} /> : null}{tab === "payments" ? <PaymentsReportView data={data} /> : null}{tab === "cashiers" ? <CashiersReportView data={data} /> : null}</> : null}
  </div>;
}
