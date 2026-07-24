"use client";

import { ArrowLeft, ReceiptText } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Card } from "@/components/ui/card";
import { Badge, PageHeader } from "@/components/ui/display";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { ApiError } from "@/lib/api-client";
import { salesService } from "@/services/sales.service";
import type { CompletedSale } from "@/types/sales";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-QA", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function SaleDetailPage() {
  const { saleId } = useParams<{ saleId: string }>();
  const [sale, setSale] = useState<CompletedSale | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await salesService.detail(saleId);
      setSale(response.data);
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : "Sale details could not be loaded.");
    }
  }, [saleId]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  if (error) return <ErrorState title="Sale unavailable" description={error} onRetry={() => void load()} />;
  if (!sale) return <div className="space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-80" /></div>;

  return (
    <div className="space-y-6 pb-4">
      <Link href="/sales" className="inline-flex items-center gap-2 text-sm font-semibold text-primary"><ArrowLeft className="size-4" /> Back to sales</Link>
      <PageHeader
        title={sale.sale_number}
        description={`${formatDate(sale.completed_at)} · ${sale.created_by.full_name}`}
        action={<Link href={`/sales/${sale.id}/receipt`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white"><ReceiptText className="size-4" /> View Receipt</Link>}
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="overflow-hidden">
          <header className="border-b border-border p-5"><h2 className="font-bold">Line items</h2></header>
          <div className="divide-y divide-border">
            {sale.items.map((item) => (
              <article key={item.id} className="flex items-start justify-between gap-4 p-5">
                <div><h3 className="font-semibold">{item.product.name}</h3><p className="mt-1 text-xs text-text-muted">{item.product.sku} · {item.quantity} {item.product.unit} × QAR {item.unit_price}</p></div>
                <p className="font-bold">QAR {item.line_total}</p>
              </article>
            ))}
          </div>
        </Card>
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center justify-between"><h2 className="font-bold">Completed sale</h2><Badge tone="success">Completed</Badge></div>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between"><dt className="text-text-muted">Subtotal</dt><dd>QAR {sale.subtotal}</dd></div>
              <div className="flex justify-between"><dt className="text-text-muted">Tax</dt><dd>QAR {sale.tax_total}</dd></div>
              <div className="flex justify-between"><dt className="text-text-muted">Discount</dt><dd>QAR {sale.discount_total}</dd></div>
              <div className="flex justify-between border-t border-border pt-3 text-lg font-bold"><dt>Total</dt><dd>QAR {sale.grand_total}</dd></div>
            </dl>
          </Card>
          <Card className="p-5">
            <h2 className="font-bold">Payments</h2>
            <div className="mt-4 space-y-3">
              {sale.payments.map((payment) => (
                <div key={payment.id} className="flex justify-between text-sm"><span>{payment.method}{payment.reference ? ` · ${payment.reference}` : ""}</span><strong>QAR {payment.amount}</strong></div>
              ))}
              <div className="flex justify-between border-t border-border pt-3 text-sm"><span>Amount received</span><strong>QAR {sale.amount_received}</strong></div>
              <div className="flex justify-between text-sm text-success"><span>Change</span><strong>QAR {sale.change_due}</strong></div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
