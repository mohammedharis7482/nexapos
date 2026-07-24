"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge, PageHeader } from "@/components/ui/display";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Input, Select } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import { salesService } from "@/services/sales.service";
import type { DraftCreator } from "@/types/billing";
import type { SaleHistoryItem, SalesListFilters } from "@/types/sales";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-QA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function salesCollectionState(
  loading: boolean,
  count: number,
  error: string | null,
) {
  if (loading) return "loading";
  if (error) return "error";
  if (count === 0) return "empty";
  return "ready";
}

export default function SalesPage() {
  const { user } = useAuth();
  const owner = user?.role === "OWNER";
  const [sales, setSales] = useState<SaleHistoryItem[]>([]);
  const [cashiers, setCashiers] = useState<DraftCreator[]>([]);
  const [filters, setFilters] = useState<SalesListFilters>({
    ordering: "-completed_at",
  });
  const [searchDraft, setSearchDraft] = useState("");
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await salesService.list({
        ...filters,
        page,
        page_size: 25,
      });
      setSales(response.data.results);
      setCount(response.data.count);
      setHasNext(Boolean(response.data.next));
    } catch (loadError) {
      setError(
        loadError instanceof ApiError
          ? loadError.message
          : "Sales history could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);
  useEffect(() => {
    void salesService.cashiers().then((response) => setCashiers(response.data));
  }, []);

  function updateFilter(key: keyof SalesListFilters, value: string) {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  }

  const state = salesCollectionState(loading, sales.length, error);
  return (
    <div className="space-y-6 pb-4">
      <PageHeader
        title="Sales"
        description={owner ? "Review completed sales across your shop." : "Review sales completed by your account."}
      />
      <Card className="p-4">
        <form
          className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_155px_155px_170px_190px]"
          onSubmit={(event) => {
            event.preventDefault();
            updateFilter("search", searchDraft);
          }}
        >
          <div className="relative">
            <Search className="absolute left-3.5 top-3.5 size-5 text-text-muted" />
            <Input
              className="pl-11"
              aria-label="Search sale number"
              placeholder="Search sale number"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
            />
          </div>
          <Input aria-label="Date from" type="date" value={filters.date_from ?? ""} onChange={(event) => updateFilter("date_from", event.target.value)} />
          <Input aria-label="Date to" type="date" value={filters.date_to ?? ""} onChange={(event) => updateFilter("date_to", event.target.value)} />
          <Select aria-label="Payment method filter" value={filters.payment_method ?? ""} onChange={(event) => updateFilter("payment_method", event.target.value)}>
            <option value="">All payments</option>
            <option value="CASH">Cash</option>
            <option value="CARD">Card</option>
          </Select>
          {owner ? (
            <Select aria-label="Cashier filter" value={filters.created_by ?? ""} onChange={(event) => updateFilter("created_by", event.target.value)}>
              <option value="">All cashiers</option>
              {cashiers.map((cashier) => <option key={cashier.id} value={cashier.id}>{cashier.full_name}</option>)}
            </Select>
          ) : <Button type="submit" variant="secondary">Search</Button>}
        </form>
      </Card>

      {state === "loading" ? <div className="space-y-3"><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div> : null}
      {state === "error" ? <ErrorState title="Sales unavailable" description={error ?? ""} onRetry={() => void load()} /> : null}
      {state === "empty" ? <EmptyState title="No completed sales found" description="Completed payments will appear here." /> : null}
      {state === "ready" ? (
        <>
          <Card className="hidden overflow-hidden md:block">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-surface-secondary text-xs uppercase tracking-wide text-text-muted">
                <tr><th className="px-4 py-3">Sale</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Cashier</th><th className="px-4 py-3">Items</th><th className="px-4 py-3">Payment</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3"><span className="sr-only">View</span></th></tr>
              </thead>
              <tbody>
                {sales.map((sale) => (
                  <tr key={sale.id} className="border-t border-border">
                    <td className="px-4 py-4 font-semibold">{sale.sale_number}</td>
                    <td className="px-4 py-4 text-text-secondary">{formatDate(sale.completed_at)}</td>
                    <td className="px-4 py-4 text-text-secondary">{sale.cashier.full_name}</td>
                    <td className="px-4 py-4">{sale.item_count}</td>
                    <td className="px-4 py-4"><Badge tone="primary">{sale.payment_methods.join(" + ")}</Badge></td>
                    <td className="px-4 py-4 text-right font-bold">QAR {sale.grand_total}</td>
                    <td className="px-4 py-4 text-right"><Link className="font-semibold text-primary" href={`/sales/${sale.id}`}>View</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <div className="space-y-3 md:hidden">
            {sales.map((sale) => (
              <Link key={sale.id} href={`/sales/${sale.id}`} className="block">
                <Card className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div><h2 className="font-semibold">{sale.sale_number}</h2><p className="mt-1 text-xs text-text-muted">{formatDate(sale.completed_at)}</p></div>
                    <p className="font-bold">QAR {sale.grand_total}</p>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-sm text-text-secondary">
                    <span>{sale.cashier.full_name} · {sale.item_count} items</span>
                    <Badge tone="primary">{sale.payment_methods.join(" + ")}</Badge>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-muted">{count} completed sales</p>
            <div className="flex gap-2"><Button variant="secondary" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button variant="secondary" disabled={!hasNext} onClick={() => setPage((value) => value + 1)}>Next</Button></div>
          </div>
        </>
      ) : null}
    </div>
  );
}
